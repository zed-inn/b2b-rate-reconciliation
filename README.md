# Polyglot Supplier Rate Reconciliation & Booking Audit Engine

![Node.js](https://img.shields.io/badge/Node.js-Fastify-339933?style=flat-square&logo=node.js)
![Python](https://img.shields.io/badge/Python-Django-3776AB?style=flat-square&logo=python)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-Event_Driven-FF6600?style=flat-square&logo=rabbitmq)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-ACID-4169E1?style=flat-square&logo=postgresql)

A real-time, event-driven system designed to detect and flag rate discrepancies in B2B travel bookings. Built as a polyglot microservice architecture (Node.js + Python/Django), this project is modeled directly after the operational challenges and strict data consistency requirements of modern travel aggregation platforms.

---

## Key Features

- **High-Throughput Ingestion**: Non-blocking Node.js/Fastify gateway capable of handling massive event spikes.
- **Strict Data Integrity**: Row-level locking in PostgreSQL guarantees 100% ACID compliance across concurrent Python consumers.
- **Idempotent Scheduling**: BullMQ and Redis ensure reliable, deduplicated delayed job execution for supplier API fetching.
- **Graceful Degradation**: HTTP 207 Multi-Status pattern mitigates the dual-write problem between database commits and event broker publishes.
- **Comprehensive Observability**: Pre-configured Prometheus and Grafana stack for deep telemetry.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [System Architecture](#system-architecture)
- [Reconciliation Lifecycle](#reconciliation-lifecycle)
- [Tech Stack & Engineering Decisions](#tech-stack--engineering-decisions)
- [Concurrency & Data Integrity](#concurrency--data-integrity)
- [Performance & Load Testing](#performance--load-testing)
  - [Phase 1: Throttled Baseline](#phase-1-throttled-baseline)
  - [Phase 2: 10,000 Event Stress Spike](#phase-2-10000-event-stress-spike)
- [Design Tradeoffs](#design-tradeoffs)
- [Observability](#observability)
- [Quick Start](#quick-start)

---

## Problem Statement

In B2B travel aggregation, platforms source hotel inventory from dozens of upstream suppliers and expose it to thousands of downstream travel agents. The financial lifecycle of a booking is highly volatile:

1. **Search Time (T=0):** The supplier quotes a rate. The agent books at this rate.
2. **Pre-Arrival (T-48h):** The supplier's underlying rate may drift due to dynamic pricing or currency fluctuations. The platform has no visibility into this unless it actively captures a snapshot.
3. **Post-Checkout:** The supplier sends a final settlement invoice. The invoiced amount frequently differs from the originally quoted amount.

The delta between the **quoted rate**, the **snapshot rate**, and the **invoiced rate** is a primary source of revenue leakage. An unchecked 5% discrepancy rate across high-volume daily bookings leads to compounding financial losses.

This project solves this problem via an automated 3-way matching engine: high-speed ingestion of booking events, automated pre-arrival rate snapshots, financial anomaly flagging, and a supplier risk scoring dashboard — all connected through a durable asynchronous event pipeline.

---

## System Architecture

The system runs as 13 containerized services orchestrated by Docker Compose. Each service owns its respective data store and communicates exclusively via RabbitMQ events, enforcing strict domain isolation.

```text
                                ┌───────────────┐
                                │   Client      │
                                │  (Agent/API)  │
                                └──────┬────────┘
                                       │ HTTP
                                       ▼
                              ┌──────────────────┐
                              │   Nginx          │
                              │   API Gateway    │
                              └────┬────────┬────┘
                    ┌──────────────┘        └──────────────┐
                    ▼                                      ▼
         ┌──────────────────┐                     ┌──────────────────┐
         │ Fastify Server   │                     │ Django Server    │
         │ (Node.js)        │                     │ (Python 3.12)    │
         │                  │                     │                  │
         │ Roles:           │                     │ Roles:           │
         │ - API Gateway    │                     │ - Audit REST API │
         │ - Event Producer │                     │ - Background     │
         │ - BullMQ Worker  │                     │   RMQ Consumer   │
         └──┬──┬──┬──┬──────┘                     └──┬──┬───────┬────┘
            │  │  │  │                               │  │       │
            │  │  │  └─── MongoDB ◄─── raw JSON ─────┘  │       │
            │  │  └────── Redis ◄───── delayed jobs     │       │
            │  │                                        │       │
            │  └──────────► RabbitMQ ◄──────────────────┘       │
            │               (events)                            │
            ▼                                                   ▼
      PostgreSQL (Node)                                  PostgreSQL (Django)
      (Booking Ledger)                                  (Reconciliation State)
```

---

## Project Structure

This is a polyglot monorepo utilizing npm workspaces to share domain contracts across services.

```text
.
├── docker-compose.yml       # Full infrastructure orchestration
├── packages/
│   └── shared/              # Shared Zod schemas (API & Event contracts)
├── services/
│   ├── django-server/       # Python Audit & Reconciliation Engine
│   ├── fastify-server/      # Node.js Ingestion & Scheduling Service
│   ├── mock-supplier-api/   # Express.js server simulating flaky upstream APIs
│   └── react-admin/         # Vite + React Dashboard for anomaly visualization
└── scripts/                 # Automated k6 load testing and metrics parsing
```

---

## Reconciliation Lifecycle

The pipeline is split into three chronological phases, each triggered by external inputs and processed asynchronously.

### Phase 1: Booking Created (T=0)
1. **Ingestion:** A booking payload hits the Fastify API (`POST /api/bookings`).
2. **Validation & Persistence:** Fastify validates the payload using Zod, inserts a canonical record into PostgreSQL via Drizzle ORM, and returns `201 Created`.
3. **Event Publishing:** A `booking.created` event is published to RabbitMQ.
4. **Consumption:** 
   - The Django consumer creates an initial `AuditRecord` in its separate PostgreSQL database.
   - A Fastify BullMQ worker schedules a delayed snapshot job in Redis (e.g., `check_in_date - 48 hours`).

### Phase 2: Pre-Arrival Snapshot (T-48h)
1. **Fetch:** The BullMQ delayed job fires. A worker fetches the current rate from the simulated Supplier API.
2. **Evidence Vaulting:** The raw, nested JSON response is saved to MongoDB (with a 90-day TTL) for non-repudiable forensic evidence.
3. **Event Publishing:** The worker normalizes the rate and publishes a `rate.snapshot.captured` event to RabbitMQ.
4. **Reconciliation:** The Django consumer receives the event, updates the `AuditRecord`, and calculates intermediate leakage.

### Phase 3: Invoice Settlement (Post-Checkout)
1. **Ingestion:** Supplier uploads batch invoices (`POST /api/invoices`).
2. **Atomic Batching:** The batch is processed within a single PostgreSQL transaction. If any invoice fails, the entire batch rolls back, preventing partial data corruption.
3. **Event Publishing:** Fastify publishes a `booking.invoiced` event for each successful invoice only after the database transaction commits.
4. **Final 3-Way Match:** Django performs the definitive reconciliation:
   - If `invoiced == quoted`, status is set to `RECONCILED`.
   - If they differ, status is set to `INVOICE_DISCREPANCY`.
   - The financial delta is logged, and the `SupplierRisk` score (failed audits / total audits) is recalculated.

---

## Tech Stack & Engineering Decisions

| Technology | Role | Rationale |
|:---|:---|:---|
| **Fastify (Node.js)** | Ingestion Gateway | Fastify's radix-tree router and non-blocking I/O make it ideal for a high-throughput, write-heavy ingestion gateway. |
| **Django (Python)** | Audit Engine | Django's ORM is the industry standard for complex relational business logic, cursor pagination, and analytical JSONB filtering. |
| **RabbitMQ** | Event Bus | Decouples ingestion from reconciliation. Durable queues and a Dead Letter Exchange (DLX) prevent message loss from crashes or poisoned payloads. |
| **BullMQ + Redis** | Job Scheduling | Deterministic `jobId`-based deduplication prevents duplicate snapshot jobs from being scheduled for the same booking, combined with automated exponential backoff retries for resilient supplier API fetching. |
| **Drizzle ORM** | Node SQL Builder | Type-safe, zero-overhead SQL builder. Unlike heavy runtime ORMs, Drizzle compiles to raw SQL, optimizing insert throughput. |
| **MongoDB** | Evidence Vault | Supplier APIs return variable-schema JSON blobs. MongoDB's document model with TTL indices natively handles arbitrary forensic evidence. |
| **Zod & Pydantic** | Contract Validation | Shared schemas ensure payloads are strictly validated on both ends of the wire. Malformed events are instantly rejected. |

---

## Concurrency & Data Integrity

With 5 horizontally scaled Django consumers reading from the same RabbitMQ queue, race conditions are a primary concern (e.g., an invoice event and a snapshot event for the same booking arriving simultaneously).

This is mitigated entirely at the database layer using **Row-Level Locking**:
```python
with transaction.atomic():
    audit_record = AuditRecord.objects.select_for_update().get(booking_ref=event.booking_ref)
    # Apply business logic
    audit_record.save()
```
This guarantees that concurrent events for the same booking are processed sequentially by the database engine, ensuring mathematical accuracy without requiring distributed locking mechanisms like Redis Redlock.

---

## Performance, Load Testing & Evolution

To prove the system's resilience, it was subjected to multiple 10,000-event stress tests (`k6` firing 50 concurrent Virtual Users with zero artificial delay). The evolution between these tests highlights the core engineering tradeoffs made to reach production readiness.

### Test 1: The Initial Architecture (Pre-Hardening)
In the initial design, Fastify dumped events into RabbitMQ, and a single Django consumer processed them. 

*   **Ingestion Throughput:** `60.50 req/sec`
*   **Total Time:** 2 minutes 44 seconds
*   **Fastify Event Loop Lag:** `1.8 ms` 
*   **The Problem:** While Fastify's ingestion was blazingly fast, the single Django consumer couldn't keep up with the database writes. Furthermore, simultaneous `booking.invoiced` and `rate.snapshot.captured` events for the same booking caused race conditions, threatening financial data integrity.

### Test 2: The Hardened Architecture (Production Ready)
To solve the race conditions, I implemented strict **Row-Level Locking** (`select_for_update()`) in PostgreSQL and horizontally scaled the Django consumers to **5 replicas** to drain the RabbitMQ backlog concurrently. 

*   **Ingestion Throughput:** `47.43 req/sec`
*   **Total Time:** 3 minutes 30 seconds
*   **P95 Latency:** `2.38s` (Nginx TCP queuing due to backpressure)
*   **Fastify Event Loop Lag:** `11.6 ms` (Node remained completely unblocked)
*   **Data Integrity:** **100%** (0 dropped events, 0 duplicates)

#### The Engineering Tradeoff
The hardened architecture processed the 10,000 events about 20% slower than the initial architecture. **This was a deliberate tradeoff.** By enforcing row-level locks across 5 concurrent Python workers, database contention increased, slightly slowing down the pipeline. However, this guarantee of absolute ACID compliance and zero race conditions is non-negotiable for a financial reconciliation engine.

### Peak Resource Footprint
During the hardened 10k stress test, the distributed pipeline proved incredibly lightweight:
*   **Fastify Server:** Peaked at `36.25% CPU` and `157.4 MB RAM`. 
*   **Django Consumers (x5):** Peaked at `~6.2% CPU` and `55.3 MB RAM` per replica.
*   **RabbitMQ:** Effectively buffered the massive ingestion spike, peaking at just `59.2 MB RAM` while seamlessly routing 40,000+ messages.

---

## Design Tradeoffs

1. **Polyglot Complexity vs. Specialized Performance:** 
   Operating Node.js and Python together increases operational overhead. The payoff is architectural correctness: Node.js excels at non-blocking I/O ingestion, while Python/Django excels at complex relational financial logic.
2. **Eventual Consistency vs. Synchronous Verification:** 
   The Fastify API returns `201 Created` before the booking is fully reconciled. For an ingestion-heavy workload, this is the correct tradeoff. Forcing the client to wait synchronously for a distributed 3-way database match would inevitably bottleneck the entire platform.
3. **Database Isolation vs. JOIN Simplicity:** 
   Node and Django each own a separate PostgreSQL instance. While this prevents simple cross-domain `JOIN` queries, it guarantees strict service isolation, allowing the ingestion and audit domains to be scaled or migrated independently.
4. **The Dual-Write Problem & Graceful Degradation:**
   Writing to PostgreSQL and publishing to RabbitMQ are sequential, non-atomic actions. To mitigate the dual-write window where a database commit succeeds but the broker publish fails (e.g., due to a socket drop), the system implements an **HTTP 207 Multi-Status** pattern. For example, during invoice batching, if the atomic database transaction commits but the event bus drops certain messages, the API catches the broker exceptions and returns a `207` response, detailing exactly which records persisted versus which events failed to publish. This elegantly handles partial distributed failures without requiring the infrastructural overhead of a full Debezium/Kafka Transactional Outbox.
5. **Drizzle ORM Bulk Updates:**
   Drizzle ORM currently lacks a native bulk-update API for modifying multiple rows with varying data. While it is possible to construct a single SQL query using complex raw `CASE` statements, we opted for executing concurrent `.update()` statements wrapped within a single PostgreSQL transaction block. This prioritizes codebase readability and maintainability without sacrificing atomic integrity.

---

## Recent Infrastructure Hardening

To ensure absolute production resilience, the following deep-cut infrastructure vulnerabilities were recently audited and patched:
- **Django ORM Connection Leaks:** Long-running RabbitMQ workers bypass Django's HTTP request cycle, causing idle connections to eventually drop. Fixed by explicitly calling `django.db.close_old_connections()` at the top of the RabbitMQ callback.
- **Node.js Unhandled Panics:** Bound Node's global `uncaughtException` and `unhandledRejection` hooks directly to the V8 graceful shutdown handler, ensuring database locks and sockets are safely torn down even during a catastrophic async panic.
- **BullMQ Exponential Backoff:** Configured native BullMQ `attempts: 3` and exponential backoff strategies to handle temporary supplier API outages resiliently.
- **Dead Letter Exchanges (DLX):** Both Django and Fastify consumers now utilize a dedicated `auditsys.dlx` exchange to trap poisoned payloads for forensic inspection.

---

## Future Architecture Considerations

While the current architecture handles the 10,000-event stress spike seamlessly, the following iterations would be required for a 100x scale-up:

1. **DLQ Replay Mechanism (Event Sourcing):** 
   Currently, the `POST /api/invoices` endpoint returns an HTTP `207 Multi-Status` when the database commits successfully but the RabbitMQ publish fails. Failed publishes are securely logged but not persisted. The next architectural iteration would introduce a persistent `failed_events` table and a manual Admin API endpoint to replay these stranded events, fully closing the Dual-Write gap.
2. **Kubernetes (K8s) Migration via Helm:** 
   Transitioning from `docker-compose` to K8s to enable Horizontal Pod Autoscaling (HPA) for the Django consumers based on RabbitMQ queue depth.

---

## Observability

The project includes a fully configured Prometheus and Grafana stack, scraping metrics every 5 seconds.

| Target | Exporter | Insight Provided |
|:---|:---|:---|
| **Fastify** | `fastify-metrics` | V8 heap size, GC pauses, Event Loop Lag, HTTP histograms. |
| **Django** | `django-prometheus` | Python garbage collection, DRF request latencies, ORM query counts. |
| **RabbitMQ** | Native Plugin | Queue depths, unacknowledged messages, connection counts. |

---

## Quick Start

**Prerequisites:** Docker and Docker Compose.

```bash
# 1. Boot the infrastructure (13 containers)
docker compose up --build -d

# 2. Access the services
# React Audit Dashboard:  http://localhost
# Grafana Dashboards:     http://localhost:3001  (admin / admin)
# RabbitMQ Management:    http://localhost:15672 (guest / guest)
# Prometheus:             http://localhost:9090

# 3. Run the automated 10k stress test
# Note: Linux/macOS only. Requires bash.
sudo bash scripts/run_load_test.sh
```
