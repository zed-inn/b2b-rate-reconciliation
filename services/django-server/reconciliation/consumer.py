import pika
from pydantic import ValidationError
from core.env import env
from reconciliation.services.router import route_event

def callback(ch, method, properties, body):
    try:
        route_event(method.routing_key, body)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except ValidationError as e:
        print(f"[Consumer] Contract Validation Error: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        print(f"[Consumer] Unexpected Error: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def start_consumer():
    params = pika.URLParameters(env.rabbitmq_url)
    connection = pika.BlockingConnection(params)
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
    
    print("Django Consumer listening on django.reconciliation.queue")
    channel.start_consuming()
