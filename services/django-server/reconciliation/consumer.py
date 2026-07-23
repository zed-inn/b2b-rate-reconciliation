import pika
from pydantic import ValidationError
import time
import signal
import sys
from core.env import env
import logging
from reconciliation.services.router import route_event
from django.db import connections
from django.db import close_old_connections

logger = logging.getLogger(__name__)

def callback(ch, method, properties, body):
    close_old_connections()

    try:
        route_event(method.routing_key, body)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except ValidationError as e:
        logger.error(f"[Consumer] Contract Validation Error: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        logger.error(f"[Consumer] Unexpected Error: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def start_consumer(retries=10, delay=5):
    params = pika.URLParameters(env.rabbitmq_url)
    
    for i in range(retries):
        try:
            connection = pika.BlockingConnection(params)
            break
        except pika.exceptions.AMQPConnectionError:
            logger.warning(f"RabbitMQ connection failed, retrying in {delay}s... ({i + 1}/{retries})")
            time.sleep(delay)
    else:
        raise Exception("Failed to connect to RabbitMQ after multiple retries")
        
    channel = connection.channel()
    
    # limit batch size to 50 so we don't blow up ram under heavy load
    channel.basic_qos(prefetch_count=50)
    
    channel.exchange_declare(exchange="auditsys.events", exchange_type="topic", durable=True)
    channel.exchange_declare(exchange="auditsys.dlx", exchange_type="direct", durable=True)
    channel.queue_declare(queue="dead_letter_queue", durable=True)
    channel.queue_bind(exchange="auditsys.dlx", queue="dead_letter_queue", routing_key="dlq")
    
    result = channel.queue_declare(
        queue="django.reconciliation.queue", 
        durable=True,
        arguments={
            'x-dead-letter-exchange': 'auditsys.dlx',
            'x-dead-letter-routing-key': 'dlq'
        }
    )
    queue_name = result.method.queue
    
    channel.queue_bind(exchange="auditsys.events", queue=queue_name, routing_key="booking.created")
    channel.queue_bind(exchange="auditsys.events", queue=queue_name, routing_key="rate.snapshot.captured")
    channel.queue_bind(exchange="auditsys.events", queue=queue_name, routing_key="booking.invoiced")
    
    def graceful_shutdown(sig, frame):
        logger.info("Received shutdown signal. Requesting graceful stop...")
        # ignore subsequent signals to prevent nested shutdown loops
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        
        try:
            if connection.is_open and channel.is_open:
                # use threadsafe callback to wake up the select() loop instantly
                connection.add_callback_threadsafe(channel.stop_consuming)
        except Exception as e:
            logger.error(f"Error during shutdown hook: {e}")

    signal.signal(signal.SIGINT, graceful_shutdown)
    signal.signal(signal.SIGTERM, graceful_shutdown)
    
    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    
    logger.info("Django Consumer listening on django.reconciliation.queue")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        pass

    logger.info("Closing active connections...")
    
    try:
        if connection.is_open:
            connection.close()
    except Exception as e:
        logger.error(f"Error closing RMQ connection: {e}")
        
    try:
        connections.close_all()
    except Exception as e:
        logger.error(f"Error closing DB connections: {e}")
        
    sys.exit(0)
