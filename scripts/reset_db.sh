#!/bin/bash
echo "[*] Wiping databases without restarting backing services (Fast Mode)..."

echo "[*] Wiping Postgres (Node)..."
sudo docker compose exec -T postgres-node psql -U node_user -d booking_ledger -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[*] Wiping Postgres (Django)..."
sudo docker compose exec -T postgres-django psql -U django_user -d audit_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[*] Wiping MongoDB..."
sudo docker compose exec -T mongodb mongosh booking_ledger --eval "db.dropDatabase()"

echo "[*] Wiping Redis (BullMQ Jobs)..."
sudo docker compose exec -T redis redis-cli FLUSHALL

echo "[*] Purging RabbitMQ Queues..."
sudo docker compose exec -T rabbitmq rabbitmqadmin purge queue name=fastify.scheduler.queue 2>/dev/null || true
sudo docker compose exec -T rabbitmq rabbitmqadmin purge queue name=django.reconciliation.queue 2>/dev/null || true

echo "[*] Pushing Fastify Drizzle schemas inside container..."
sudo docker compose exec -T fastify-server npm run db:push -- --force

echo "[*] Applying Django Migrations inside container..."
sudo docker compose exec -T django-web uv run manage.py migrate

echo "[*] Database reset complete! The background schedulers will now start ingesting mock data."
