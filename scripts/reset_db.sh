#!/bin/bash
echo "[*] Stopping containers and aggressively pruning volumes..."
sudo docker compose down -v

echo "[*] Starting containers and waiting for healthchecks to pass..."
sudo docker compose up -d --wait

echo "[*] Pushing Fastify Drizzle schemas inside container..."
sudo docker compose exec fastify-server npm run db:push

echo "[*] Applying Django Migrations inside container..."
sudo docker compose exec django-web uv run manage.py migrate

echo "[*] Database reset complete! The background schedulers will now start ingesting mock data."
