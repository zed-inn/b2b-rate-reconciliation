#!/bin/bash

# generate_metrics_md.sh
# Finds the latest run in results/ and parses the logs to create a beautifully formatted Markdown report.

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_BASE="$PROJ_DIR/results"

# Find newest directory
LATEST_DIR=$(ls -td "$RESULTS_BASE"/*/ 2>/dev/null | head -n 1)

if [[ -z "$LATEST_DIR" ]]; then
  echo "No results directory found."
  exit 1
fi

echo "Parsing results from $LATEST_DIR"

MD_FILE="${LATEST_DIR}load_test_metrics.md"
K6_FILE="${LATEST_DIR}k6_full_output.txt"
DB_FILE="${LATEST_DIR}db_integrity.txt"
DOCKER_FILE="${LATEST_DIR}docker_stats_final.txt"

# Extracting k6 values safely
TOTAL_REQS=$(grep -m 1 "http_reqs" "$K6_FILE" | awk '{print $2}')
THROUGHPUT=$(grep -m 1 "http_reqs" "$K6_FILE" | awk '{print $3}')
FAILED_PERC=$(grep -m 1 "http_req_failed" "$K6_FILE" | awk '{print $2}')
FAILED_NUM=$(grep -m 1 "http_req_failed" "$K6_FILE" | awk '{print $3}')

DUR_MIN=$(grep -m 1 "http_req_duration" "$K6_FILE" | awk -F'min=' '{print $2}' | awk '{print $1}')
DUR_MED=$(grep -m 1 "http_req_duration" "$K6_FILE" | awk -F'med=' '{print $2}' | awk '{print $1}')
DUR_AVG=$(grep -m 1 "http_req_duration" "$K6_FILE" | awk -F'avg=' '{print $2}' | awk '{print $1}')
DUR_MAX=$(grep -m 1 "http_req_duration" "$K6_FILE" | awk -F'max=' '{print $2}' | awk '{print $1}')
DUR_P90=$(grep -m 1 "http_req_duration" "$K6_FILE" | awk -F'p\\(90\\)=' '{print $2}' | awk '{print $1}')
DUR_P95=$(grep -m 1 "http_req_duration" "$K6_FILE" | awk -F'p\\(95\\)=' '{print $2}' | awk '{print $1}')

DATA_RECV=$(grep -m 1 "data_received" "$K6_FILE" | awk '{print $2 " " $3}')
DATA_SENT=$(grep -m 1 "data_sent" "$K6_FILE" | awk '{print $2 " " $3}')
VUS=$(grep -m 1 "vus\." "$K6_FILE" | awk '{print $2}')

# Extracting DB Integrity values
NODE_BOOKINGS=$(grep -A 2 "total_bookings" "$DB_FILE" | tail -n 1 | awk '{print $1}')
MONGO_SNAPS=$(grep -m 1 "Total Snapshots:" "$DB_FILE" | awk '{print $3}')
DJANGO_AUDITS_LINE=$(grep -A 2 "reconciled |" "$DB_FILE" | tail -n 1)
DJANGO_AUDITS=$(echo "$DJANGO_AUDITS_LINE" | awk -F'|' '{print $1}' | tr -d ' ')
VERIFIED_SNAP=$(echo "$DJANGO_AUDITS_LINE" | awk -F'|' '{print $5}' | tr -d ' ')
SNAP_DISC=$(echo "$DJANGO_AUDITS_LINE" | awk -F'|' '{print $4}' | tr -d ' ')
DUPES=$(grep -A 2 "booking_ref |" "$DB_FILE" | tail -n 1 | awk '{print $1}' | tr -d '()rows')

DUPES_TEXT="**$DUPES**"

# Extracting Prometheus metrics via jq
get_prom_val() {
  local file="${LATEST_DIR}$1.json"
  if [ -f "$file" ]; then
    cat "$file" | jq -r '.data.result[0].value[1]' 2>/dev/null | awk '{printf "%.2f", $1}' || echo "N/A"
  else
    echo "N/A"
  fi
}

FASTIFY_HEAP_MB=$(echo $(get_prom_val "prom_node_heap_used") | awk '{printf "%.2f", $1/1024/1024}')
FASTIFY_EV_MAX_MS=$(echo $(get_prom_val "prom_node_evloop_lag_max") | awk '{printf "%.2f", $1*1000}')
FASTIFY_EV_MEAN_MS=$(echo $(get_prom_val "prom_node_evloop_lag_mean") | awk '{printf "%.2f", $1*1000}')
FASTIFY_HANDLES=$(get_prom_val "prom_node_active_handles" | awk -F. '{print $1}')

RMQ_MEM_MB=$(echo $(get_prom_val "prom_rmq_memory") | awk '{printf "%.2f", $1/1024/1024}')
RMQ_CONN=$(get_prom_val "prom_rmq_connections" | awk -F. '{print $1}')
RMQ_RECV=$(get_prom_val "prom_rmq_msgs_received" | awk -F. '{print $1}')
RMQ_ACKED=$(get_prom_val "prom_rmq_msgs_acked" | awk -F. '{print $1}')
RMQ_QUEUE=$(get_prom_val "prom_rmq_queue_messages" | awk -F. '{print $1}')

# Write MD
cat <<EOF > "$MD_FILE"
# 10,000 Event Load Test: Raw Metrics (Hardened Architecture)

**Date:** $(date)
**Configuration:** $VUS Concurrent Virtual Users (VUs)

---

## 1. K6 HTTP Ingress (API Gateway)
| Metric | Value |
| :--- | :--- |
| **Total Requests** | $TOTAL_REQS |
| **Failure Rate** | $FAILED_PERC |
| **Throughput** | $THROUGHPUT |
| **Minimum Latency** | $DUR_MIN |
| **Median (P50)** | $DUR_MED |
| **Average (Mean)** | $DUR_AVG |
| **P90 Latency** | $DUR_P90 |
| **P95 Latency** | $DUR_P95 |
| **Max Latency** | $DUR_MAX |
| **Network Data** | $DATA_SENT Sent / $DATA_RECV Received |

---

## 2. Database Integrity (Post-Run Audit)
| Datastore | Record Count |
| :--- | :--- |
| **PostgreSQL (Node - Bookings)** | $NODE_BOOKINGS |
| **MongoDB (Snapshots)** | $MONGO_SNAPS |
| **PostgreSQL (Django - Audits)** | $DJANGO_AUDITS |

### Reconciliation Breakdown
*   **Verified at Snapshot:** $VERIFIED_SNAP
*   **Snapshot Discrepancy (Leakage):** $SNAP_DISC
*   **Duplicates Found:** $DUPES_TEXT

---

## 3. Prometheus Telemetry (Peak/Final Values)

### Node.js (Fastify)
*   **Heap Used:** $FASTIFY_HEAP_MB MB
*   **Event Loop Lag (Max):** $FASTIFY_EV_MAX_MS ms
*   **Event Loop Lag (Mean):** $FASTIFY_EV_MEAN_MS ms
*   **Active Handles:** $FASTIFY_HANDLES

### RabbitMQ
*   **Resident Memory:** $RMQ_MEM_MB MB
*   **Active Connections:** $RMQ_CONN
*   **Total Messages Received:** $RMQ_RECV
*   **Total Messages Acked:** $RMQ_ACKED
*   **Final Queue Depth:** $RMQ_QUEUE

---

## 4. Docker Resource Consumption (Final State)
| Container | Peak CPU % | Peak Memory |
| :--- | :--- | :--- |
$(cat "$DOCKER_FILE" 2>/dev/null | awk 'NR>1 { gsub(/^project1-/, "", $1); printf "| **%s** | %s | %s |\n", $1, $2, $3 }')
EOF

echo "Markdown metrics generated successfully at: $MD_FILE"
