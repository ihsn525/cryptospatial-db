#!/usr/bin/env bash

# ==============================================================================
# CryptoSpatial-DB Engine - Real-Time PostgreSQL / PostGIS Showcase Script
# ==============================================================================

# Database Connection Defaults (Override via ENV vars if needed)
DB_NAME="${DB_NAME:-cryptospatial_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

# Terminal Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper Function to Run SQL
run_sql() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -X -c "$1" 2>/dev/null
}

# Auto-detect PostgreSQL Connection (Local or Docker)
check_connection() {
    if run_sql "SELECT 1;" > /dev/null 2>&1; then
        return 0
    elif command -v docker >/dev/null 2>&1 && docker ps | grep -q "postgres\|cryptospatial"; then
        CONTAINER_ID=$(docker ps --format '{{.ID}}\t{{.Names}}' | grep -i "postgres\|cryptospatial" | head -n 1 | awk '{print $1}')
        run_sql() {
            docker exec -i "$CONTAINER_ID" psql -U "$DB_USER" -d "$DB_NAME" -X -c "$1"
        }
        return 0
    else
        echo -e "${RED}${BOLD}✖ Error: Unable to connect to PostgreSQL database '$DB_NAME' at $DB_HOST:$DB_PORT.${NC}"
        echo -e "Ensure PostgreSQL or your Docker container is running."
        exit 1
    fi
}

clear
echo -e "${CYAN}${BOLD}======================================================================${NC}"
echo -e "${BLUE}${BOLD}   🛡️  CRYPTOSPATIAL-DB ENGINE - LIVE DATABASE INSPECTOR  🛡️   ${NC}"
echo -e "${CYAN}${BOLD}======================================================================${NC}"
echo -e "  Target Database : ${GREEN}${DB_NAME}${NC}"
echo -e "  Timestamp       : ${YELLOW}$(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
echo -e "${CYAN}----------------------------------------------------------------------${NC}\n"

check_connection

# ------------------------------------------------------------------------------
# SECTION 1: DATABASE OVERVIEW & ROW COUNTS
# ------------------------------------------------------------------------------
echo -e "${GREEN}${BOLD}[1/6] DATABASE TABLE OVERVIEW & ROW COUNTS${NC}"
run_sql "
SELECT 
    schemaname || '.' || relname AS table_name,
    n_live_tup AS total_records,
    pg_size_pretty(pg_total_relation_size(relid)) AS disk_usage
FROM pg_stat_user_tables
WHERE relname IN ('sdk_api_keys', 'geofences', 'driver_telemetry_logs', 'spatial_audit_reports')
ORDER BY n_live_tup DESC;
"

# ------------------------------------------------------------------------------
# SECTION 2: MIDDLEWARE API KEYS (SHA-256 HASHED)
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}[2/6] MIDDLEWARE API KEYS (sdk_api_keys)${NC}"
echo -e "${MAGENTA}Note: Raw API keys are hashed with SHA-256; only prefixes are stored.${NC}"
run_sql "
SELECT 
    key_id,
    client_name,
    key_prefix,
    SUBSTRING(key_hash, 1, 16) || '...' AS sha256_hash_preview,
    is_active,
    created_at
FROM sdk_api_keys
ORDER BY created_at DESC;
"

# ------------------------------------------------------------------------------
# SECTION 3: POSTGIS DELIVERY GEOFENCES & SPATIAL BOUNDS
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}[3/6] POSTGIS DELIVERY ZONES & HUB GEOFENCES (geofences)${NC}"
run_sql "
SELECT 
    geofence_id,
    zone_name,
    ST_GeometryType(geom) AS geom_type,
    ST_SRID(geom) AS srid,
    ST_AsText(geom) AS polygon_wkt
FROM geofences
ORDER BY geofence_id ASC;
"

# ------------------------------------------------------------------------------
# SECTION 4: LIVE INGESTED TELEMETRY & EDGE MASKING LOGS
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}[4/6] RECENT TELEMETRY LOGS (driver_telemetry_logs)${NC}"
echo -e "${MAGENTA}Note: Raw coordinates are purged at the edge; only 153m Base32 tiles are stored.${NC}"
run_sql "
SELECT 
    log_id,
    driver_id,
    masked_geohash AS base32_tile,
    'RAW PURGED AT EDGE' AS raw_coordinate_status,
    created_at
FROM driver_telemetry_logs
ORDER BY log_id DESC
LIMIT 10;
"

# ------------------------------------------------------------------------------
# SECTION 5: DIFFERENTIAL PRIVACY AUDIT REPORTS (LAPLACE NOISE)
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}[5/6] DIFFERENTIAL PRIVACY AUDIT REPORTS (spatial_audit_reports)${NC}"
run_sql "
SELECT 
    report_id,
    geofence_zone,
    true_count,
    ROUND(laplacian_noise::numeric, 3) AS laplace_noise_added,
    reported_count AS noisy_output,
    auto_tuned_epsilon AS epsilon_budget,
    generated_at
FROM spatial_audit_reports
ORDER BY report_id DESC
LIMIT 5;
"

# ------------------------------------------------------------------------------
# SECTION 6: POSTGIS GiST INDEX PROFILER & CATALOG PERFORMANCE
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}[6/6] POSTGIS GiST INDEX PROFILER & SYSTEM CATALOG STATS${NC}"
run_sql "
SELECT 
    indexrelname AS index_name,
    relname AS table_name,
    idx_scan AS total_index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname IN ('driver_telemetry_logs', 'geofences')
ORDER BY idx_scan DESC;
"

echo -e "\n${CYAN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}✓ Showcase Inspection Complete! Database is operating in Zero-Trust Mode.${NC}"
echo -e "${CYAN}${BOLD}======================================================================${NC}\n"