#!/bin/bash
set -uo pipefail

# ============================================================
# 10,000 Event Load Test Runner (v3)
# Run: sudo bash scripts/run_load_test.sh
# ============================================================

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="$PROJ_DIR/results/$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

DC="docker compose"
NETWORK="$(basename "$PROJ_DIR" | tr '[:upper:]' '[:lower:]')_default"
PROM="http://localhost:9090/api/v1/query"

echo "============================================"
echo " Load Test Runner — $(date)"
echo " Results → $RESULTS_DIR"
echo "============================================"

# ----------------------------------------------------------
# phase 1: ensure backing services are up
# ----------------------------------------------------------
echo ""
echo "[1/7] Building and starting backing services..."
cd "$PROJ_DIR"

# start only the databases and queues first
$DC up --build -d postgres-node postgres-django mongodb redis rabbitmq 2>&1 | tail -5 || true

# fast health check poll (3s intervals, 90s max)
echo "[*] Waiting for health checks..."
for i in $(seq 1 30); do
  NH=$($DC ps postgres-node --format '{{.Health}}' 2>/dev/null || echo "?")
  DH=$($DC ps postgres-django --format '{{.Health}}' 2>/dev/null || echo "?")
  RH=$($DC ps rabbitmq --format '{{.Health}}' 2>/dev/null || echo "?")
  if [[ "$NH" == *"healthy"* ]] && [[ "$DH" == *"healthy"* ]] && [[ "$RH" == *"healthy"* ]]; then
    echo "[*] All backing services healthy!"
    break
  fi
  echo "  (${i}/30) pg-node=$NH pg-django=$DH rmq=$RH"
  sleep 3
done

# ----------------------------------------------------------
# phase 2: reset databases
# ----------------------------------------------------------
echo ""
echo "[2/7] Resetting databases (clean state)..."
bash "$PROJ_DIR/scripts/reset_db.sh"
sleep 2

# ----------------------------------------------------------
# phase 3: start application containers
# ----------------------------------------------------------
echo ""
echo "[3/7] Starting application containers (Fastify, Django, etc)..."
$DC up -d 2>&1 | tail -5 || true
sleep 5

echo "[*] Restarting api-gateway for fresh DNS resolution..."
$DC restart api-gateway 2>&1 | tail -2
sleep 3
$DC ps | tee "$RESULTS_DIR/container_status.txt"

# ----------------------------------------------------------
# phase 4: pre-test snapshot + background collector
# ----------------------------------------------------------
echo ""
echo "[4/7] Capturing pre-test stats..."
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" > "$RESULTS_DIR/docker_stats_pre.txt"

(
  while true; do
    echo "--- $(date +%H:%M:%S) ---" >> "$RESULTS_DIR/docker_stats_live.txt"
    docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" >> "$RESULTS_DIR/docker_stats_live.txt"
    sleep 5
  done
) &
STATS_PID=$!

# ----------------------------------------------------------
# phase 5: k6 load test
# ----------------------------------------------------------
echo ""
echo "[5/7] Firing k6 — 10,000 iterations, 50 VUs..."

docker run --rm -i --network "$NETWORK" \
  grafana/k6 run - < "$PROJ_DIR/scripts/load_test.js" \
  2>&1 | tee "$RESULTS_DIR/k6_full_output.txt"

echo "[*] k6 done."
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" > "$RESULTS_DIR/docker_stats_post.txt"

# ----------------------------------------------------------
# phase 6: wait for queue drain + collect all metrics
# ----------------------------------------------------------
echo ""
echo "[6/7] Waiting for RMQ queues to fully drain..."

for i in $(seq 1 90); do
  READY=$(curl -s "http://localhost:15672/api/queues" -u guest:guest 2>/dev/null \
    | python3 -c "import sys,json; qs=json.load(sys.stdin); print(sum(q.get('messages_ready',0) for q in qs))" 2>/dev/null || echo "?")
  UNACKED=$(curl -s "http://localhost:15672/api/queues" -u guest:guest 2>/dev/null \
    | python3 -c "import sys,json; qs=json.load(sys.stdin); print(sum(q.get('messages_unacknowledged',0) for q in qs))" 2>/dev/null || echo "?")

  if [[ "$READY" == "0" ]] && [[ "$UNACKED" == "0" ]]; then
    echo "[*] Queues drained! (ready=0, unacked=0)"
    break
  fi
  echo "  (${i}/90) ready=$READY unacked=$UNACKED"
  sleep 3
done

kill $STATS_PID 2>/dev/null || true
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" > "$RESULTS_DIR/docker_stats_final.txt"

echo "[*] Capturing Prometheus metrics..."

# node.js / fastify
curl -s "$PROM?query=nodejs_heap_size_used_bytes" | python3 -m json.tool > "$RESULTS_DIR/prom_node_heap_used.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_heap_size_total_bytes" | python3 -m json.tool > "$RESULTS_DIR/prom_node_heap_total.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_external_memory_bytes" | python3 -m json.tool > "$RESULTS_DIR/prom_node_external_mem.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_eventloop_lag_max_seconds" | python3 -m json.tool > "$RESULTS_DIR/prom_node_evloop_lag_max.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_eventloop_lag_p99_seconds" | python3 -m json.tool > "$RESULTS_DIR/prom_node_evloop_lag_p99.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_eventloop_lag_mean_seconds" | python3 -m json.tool > "$RESULTS_DIR/prom_node_evloop_lag_mean.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_active_handles_total" | python3 -m json.tool > "$RESULTS_DIR/prom_node_active_handles.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_active_requests_total" | python3 -m json.tool > "$RESULTS_DIR/prom_node_active_requests.json" 2>/dev/null || true
curl -s "$PROM?query=nodejs_gc_duration_seconds_sum" | python3 -m json.tool > "$RESULTS_DIR/prom_node_gc.json" 2>/dev/null || true

# fastify http metrics
curl -s "$PROM?query=http_request_duration_seconds_count" | python3 -m json.tool > "$RESULTS_DIR/prom_http_req_count.json" 2>/dev/null || true
curl -s "$PROM?query=http_request_duration_seconds_sum" | python3 -m json.tool > "$RESULTS_DIR/prom_http_req_duration_sum.json" 2>/dev/null || true
curl -s "$PROM?query=http_request_summary_seconds" | python3 -m json.tool > "$RESULTS_DIR/prom_http_req_summary.json" 2>/dev/null || true

# process memory (all services)
curl -s "$PROM?query=process_resident_memory_bytes" | python3 -m json.tool > "$RESULTS_DIR/prom_rss_all.json" 2>/dev/null || true

# rabbitmq
curl -s "$PROM?query=rabbitmq_process_resident_memory_bytes" | python3 -m json.tool > "$RESULTS_DIR/prom_rmq_memory.json" 2>/dev/null || true
curl -s "$PROM?query=rabbitmq_connections" | python3 -m json.tool > "$RESULTS_DIR/prom_rmq_connections.json" 2>/dev/null || true
curl -s "$PROM?query=rabbitmq_queue_messages" | python3 -m json.tool > "$RESULTS_DIR/prom_rmq_queue_messages.json" 2>/dev/null || true
curl -s "$PROM?query=rabbitmq_global_messages_received_total" | python3 -m json.tool > "$RESULTS_DIR/prom_rmq_msgs_received.json" 2>/dev/null || true
curl -s "$PROM?query=rabbitmq_global_messages_acknowledged_total" | python3 -m json.tool > "$RESULTS_DIR/prom_rmq_msgs_acked.json" 2>/dev/null || true

# django / python
curl -s "$PROM?query=python_gc_objects_collected_total" | python3 -m json.tool > "$RESULTS_DIR/prom_python_gc.json" 2>/dev/null || true
curl -s "$PROM?query=django_http_requests_total_by_method_total" | python3 -m json.tool > "$RESULTS_DIR/prom_django_http_total.json" 2>/dev/null || true

echo "[*] Prometheus done."

# ----------------------------------------------------------
# phase 7: database integrity (after full drain)
# ----------------------------------------------------------
echo ""
echo "[7/7] Database integrity checks..."

{
  echo "=== NODE POSTGRES (BOOKINGS) ==="
  $DC exec -T postgres-node psql -U node_user -d booking_ledger -c \
    "SELECT COUNT(*) AS total_bookings FROM bookings;" 2>&1

  echo ""
  echo "=== DJANGO POSTGRES (AUDIT RECORDS) ==="
  $DC exec -T postgres-django psql -U django_user -d audit_db -c "
  SELECT
    COUNT(*) AS total_audits,
    COUNT(*) FILTER (WHERE status = 'RECONCILED') AS reconciled,
    COUNT(*) FILTER (WHERE status = 'INVOICE_DISCREPANCY') AS invoice_discrepancy,
    COUNT(*) FILTER (WHERE status = 'SNAPSHOT_DISCREPANCY') AS snapshot_discrepancy,
    COUNT(*) FILTER (WHERE status = 'VERIFIED_AT_SNAPSHOT') AS verified_at_snapshot,
    COUNT(*) FILTER (WHERE status = 'CREATED') AS still_pending,
    COUNT(*) FILTER (WHERE leakage_amount != 0) AS flagged_leakage
  FROM reconciliation_auditrecord;" 2>&1

  echo ""
  echo "=== SUPPLIER RISK ==="
  $DC exec -T postgres-django psql -U django_user -d audit_db -c \
    "SELECT supplier_code, total_audits, failed_audits, risk_score FROM anomalies_supplierrisk;" 2>&1

  echo ""
  echo "=== MONGODB (SNAPSHOTS) ==="
  $DC exec -T mongodb mongosh booking_ledger --quiet --eval \
    "print('Total Snapshots: ' + db.ratesnapshots.countDocuments({}));" 2>&1 || echo "MongoDB query failed"

  echo ""
  echo "=== DUPLICATE CHECK ==="
  $DC exec -T postgres-django psql -U django_user -d audit_db -c "
  SELECT booking_ref, COUNT(*) AS dupes
  FROM reconciliation_auditrecord
  GROUP BY booking_ref HAVING COUNT(*) > 1 LIMIT 10;" 2>&1

} 2>&1 | tee "$RESULTS_DIR/db_integrity.txt"

# ----------------------------------------------------------
# done
# ----------------------------------------------------------
echo ""
echo "============================================"
echo " LOAD TEST COMPLETE — $RESULTS_DIR"
echo "============================================"
echo ""
echo "Files:"
ls -lh "$RESULTS_DIR"
echo ""
echo "Prometheus:"
find "$RESULTS_DIR" -name "prom_*.json" -size +0 -printf "  ✓ %f\n"
find "$RESULTS_DIR" -name "prom_*.json" -empty -printf "  ✗ %f (EMPTY)\n"

# Run the automatic markdown generation
bash "$PROJ_DIR/scripts/generate_metrics_md.sh"

echo ""
echo "======================================================"
echo " The Markdown metric summary has been generated at:"
echo " -> $RESULTS_DIR/load_test_metrics.md"
echo "======================================================"
