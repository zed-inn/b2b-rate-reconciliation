# 10,000 Event Load Test: Raw Metrics (Hardened Architecture)

**Date:** July 23, 2026
**Architecture:** Node.js (Fastify) -> Redis/BullMQ -> RabbitMQ -> Django Consumers (x5) -> Postgres/Mongo
**Configuration:** 50 Concurrent Virtual Users (VUs) / 0ms artificial sleep.

---

## 1. K6 HTTP Ingress (API Gateway)
| Metric | Value |
| :--- | :--- |
| **Total Requests** | 10,000 |
| **Success Rate** | 100.00% (0 dropped, 0 HTTP 5xx) |
| **Throughput** | 47.43 req/sec |
| **Minimum Latency** | 179.91 ms |
| **Median (P50)** | 823.46 ms |
| **Average (Mean)** | 1.05 s |
| **P90 Latency** | 1.92 s |
| **P95 Latency** | 2.38 s |
| **Max Latency** | 5.60 s |
| **Network Data** | 3.2 MB Sent / 2.4 MB Received |

---

## 2. Database Integrity (Post-Run Audit)
| Datastore | Record Count |
| :--- | :--- |
| **PostgreSQL (Node - Bookings)** | 10,000 |
| **MongoDB (Snapshots)** | 10,000 |
| **PostgreSQL (Django - Audits)** | 10,000 |

### Reconciliation Breakdown
*   **Verified at Snapshot:** 8,475
*   **Snapshot Discrepancy (Leakage):** 1,525
*   **Duplicates Found:** **0** (Row-level locking successful)

---

## 3. Prometheus Telemetry (Peak/Final Values)

### Node.js (Fastify)
*   **Heap Used:** 51.10 MB
*   **Total Resident Set Size (RSS):** 109.86 MB
*   **Event Loop Lag (Max):** 11.63 ms *(Non-blocking)*
*   **Event Loop Lag (Mean):** 10.33 ms
*   **Active Handles:** 24

### RabbitMQ
*   **Resident Memory:** 59.26 MB
*   **Active Connections:** 6
*   **Total Messages Received:** 40,005
*   **Total Messages Acked:** 60,005
*   **Final Queue Depth:** 0

### Django (Python Consumers)
*   **Total Resident Set Size (RSS):** 32.50 MB
*   **GC Objects (Gen 0):** 4,716
*   **GC Objects (Gen 1):** 1,773

---

## 4. Docker Resource Consumption (Peak Snapshot)
| Container | Peak CPU % | Peak Memory |
| :--- | :--- | :--- |
| **fastify-server** | 36.25% | 157.4 MB |
| **django-consumer (x5)** | ~6.21% (each) | 55.3 MB (each) |
| **django-web** | 1.19% | 49.2 MB |
| **rabbitmq** | ~10.0% | 59.2 MB |
| **postgres-django** | ~20.0% | ~80.0 MB |
| **postgres-node** | ~15.0% | ~60.0 MB |

---

## 5. Summary Analysis
- **Throughput:** ~47 req/s is the current ceiling for synchronous database inserts + BullMQ scheduling + RMQ publishing on a single Fastify thread.
- **Resilience:** Fastify's Event Loop Lag maxed out at only 11.6ms. Backpressure was safely pushed out to the Nginx TCP queue (causing the 2.38s P95 latency).
- **Concurrency:** 5 Django replicas processed the RMQ backlog concurrently. PostgreSQL `select_for_update()` strictly enforced row-level locks, yielding exactly 0 race conditions.
