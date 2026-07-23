import pika
from pydantic import ValidationError
import time
from core.env import env
import logging
from reconciliation.services.router import route_event

logger = logging.getLogger(__name__)

def callback(ch, method, properties, body):
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
    
    result = channel.queue_declare(queue="django.reconciliation.queue", durable=True)
    queue_name = result.method.queue
    
    channel.queue_bind(exchange="auditsys.events", queue=queue_name, routing_key="booking.created")
    channel.queue_bind(exchange="auditsys.events", queue=queue_name, routing_key="rate.snapshot.captured")
    channel.queue_bind(exchange="auditsys.events", queue=queue_name, routing_key="booking.invoiced")
    
    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    
    logger.info("Django Consumer listening on django.reconciliation.queue")
    channel.start_consuming()
