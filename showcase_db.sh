#!/usr/bin/env bash

# ==============================================================================
# CryptoSpatial-DB: Faculty Database Demonstration Script
# Target Evaluator: Dr. Deepika J
# Purpose: Step-by-step execution of PostGIS schema, spatial indexes, 
#          PL/pgSQL differential privacy procedures, and live data logs.
# ==============================================================================

# ANSI Color Codes for Visual Hierarchy
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to pause between presentation steps
pause_prompt() {
    echo -e "${YELLOW}\n[Press ENTER to proceed to the next step...]${NC}"
    read -r
}

# Clear screen and display banner
clear
echo -e "${CYAN}${BOLD}"
echo "================================================================================"
echo "          CRYPTOSPATIAL-DB: DATABASE ENGINE & POSTGIS SHOWCASE          "
echo "================================================================================"
echo -e "${NC}"
echo -e "Target Database: ${GREEN}cryptospatial_db${NC} | Container: ${GREEN}cryptospatial_postgres${NC}"
echo -e "Spatial Engine:  ${GREEN}PostGIS 3.4 / PostgreSQL 16${NC}"
echo "--------------------------------------------------------------------------------"

# Check if Docker container is running
if ! docker ps | grep -q "cryptospatial_postgres"; then
    echo -e "${PURPLE}[ERROR] Docker container 'cryptospatial_postgres' is not running.${NC}"
    echo -e "Please start the stack first using: ${GREEN}./manage.sh start${NC}"
    exit 1
fi

pause_prompt

# ------------------------------------------------------------------------------
# STEP 1: PostGIS Extension Verification
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 1: POSTGIS SPATIAL EXTENSION VERIFICATION${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${BLUE}Status:${NC} PostGIS spatial extension is active in PostgreSQL."
echo ""

docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "\dx"

pause_prompt

# ------------------------------------------------------------------------------
# STEP 2: Database Schema & Relational Tables
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 2: RELATIONAL TABLES & SCHEMA OVERVIEW${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${BLUE}Content:${NC} 3 core tables: spatial_logs (telemetry), geofences (delivery zones), and audit_reports (privacy logs)."
echo ""

docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "\dt"

pause_prompt

# ------------------------------------------------------------------------------
# STEP 3: Attribute & Index Inspection
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 3: TABLE ATTRIBUTES & GiST SPATIAL INDEXING${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"

echo -e "${GREEN}${BOLD}[3.1] Ingested Spatial Telemetry Table (spatial_logs):${NC}"
docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "\d spatial_logs"
echo ""

echo -e "${GREEN}${BOLD}[3.2] Geofenced Hubs Table (geofences) — Note GiST Spatial Index:${NC}"
echo -e "${BLUE}Content:${NC} 'The idx_geofences_spatial GiST index. This builds an R-Tree for O(log N) bounding box searches.'"
docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "\d geofences"
echo ""

echo -e "${GREEN}${BOLD}[3.3] Audit Reports Table (audit_reports):${NC}"
docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "\d audit_reports"

pause_prompt

# ------------------------------------------------------------------------------
# STEP 4: PL/pgSQL Stored Procedure Code Inspection
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 4: DIFFERENTIAL PRIVACY STORED PROCEDURE (sp_generate_privacy_audit)${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${BLUE}Content:${NC} 'This PL/pgSQL procedure decodes Geohashes via ST_PointFromGeoHash, evaluates containment, and injects continuous 2D Laplace noise (ε = 1.5).'"
echo ""

docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'sp_generate_privacy_audit';"

pause_prompt

# ------------------------------------------------------------------------------
# STEP 5: Live Records & Masked Geohash Verification
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 5: LIVE INGESTED TELEMETRY LOGS (RAW VS. MASKED GEOHASH)${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${BLUE}Content:${NC} Here are the recent pings. Notice how raw coordinates are converted into 7-character Base32 Geohashes (masked_geohash)."
echo ""

docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "SELECT log_id, raw_lat, raw_lon, masked_geohash, recorded_at FROM spatial_logs ORDER BY log_id DESC LIMIT 5;"

pause_prompt

# ------------------------------------------------------------------------------
# STEP 6: Active Geofences & Polygons
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 6: ACTIVE GEOFENCE ZONES (Koramangala & Indiranagar Hubs)${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${BLUE}Content:${NC} 'These MultiPolygons represent delivery hubs stored in EPSG:4326 format.'"
echo ""

docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "SELECT geofence_id, zone_name, is_active, ST_AsText(ST_Centroid(boundary_polygon)) AS centroid_point FROM geofences;"

pause_prompt

# ------------------------------------------------------------------------------
# STEP 7: Live Differential Privacy Audit Output
# ------------------------------------------------------------------------------
clear
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${CYAN}${BOLD} STEP 7: DIFFERENTIAL PRIVACY AUDIT REPORTS (LAPLACIAN PERTURBATION)${NC}"
echo -e "${CYAN}${BOLD}================================================================================${NC}"
echo -e "${BLUE}Content:${NC} 'These are the generated audit reports. Compare true_count against reported_count to see Laplace noise in action.'"
echo ""

docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "SELECT report_id, true_count, round(laplacian_noise::numeric, 2) AS laplace_noise, reported_count, generated_at FROM audit_reports ORDER BY generated_at DESC LIMIT 5;"

echo ""
echo -e "${GREEN}${BOLD}================================================================================"
echo "                   DATABASE DEMONSTRATION COMPLETE                    "
echo "================================================================================"${NC}
echo ""