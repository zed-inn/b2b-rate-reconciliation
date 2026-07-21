from django.core.management.base import BaseCommand
from reconciliation.consumer import start_consumer

class Command(BaseCommand):
    help = "Starts the RabbitMQ event consumer for the reconciliation engine"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting RabbitMQ consumer..."))
        start_consumer()
