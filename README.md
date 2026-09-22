# CryptoSpatial-DB: Privacy-Preserving Geospatial Auditing Engine

![CI/CD Pipeline Status](https://img.shields.io/github/actions/workflow/status/ihsn525/cryptospatial-db/ci-cd.yml?branch=main&label=CI%2FCD%20Pipeline&style=for-the-badge&logo=github)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-PostGIS_3.4-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-Vite_5-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Containerized_DB-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

An enterprise-grade, zero-trust geospatial middleware engineered for delivery, rideshare, and hyper-local logistics platforms (e.g., Swiggy, Zomato, Uber, Zepto). **CryptoSpatial-DB** enables platforms to audit driver fleet availability within active geofenced delivery zones **without persistently storing, exposing, or transmitting raw latitude and longitude GPS coordinates**.

---

## Table of Contents
1. [Executive Overview & Problem Statement](#executive-overview--problem-statement)
2. [Key System Features](#key-system-features)
3. [Architecture & Data Pipeline](#architecture--data-pipeline)
4. [System Requirements & Prerequisites](#system-requirements--prerequisites)
5. [Installation & Setup Guide](#installation--setup-guide)
6. [Service Orchestration (`manage.sh`)](#service-orchestration-managesh)
7. [API Specification & Interactive Swagger Docs](#api-specification--interactive-swagger-docs)
8. [Database Schema & Stored Procedures](#database-schema--stored-procedures)
9. [Continuous Integration & Delivery (CI/CD)](#continuous-integration--delivery-cicd)
10. [Troubleshooting & Common Issues](#troubleshooting--common-issues)
11. [Faculty Review Defense Q&A](#faculty-review-defense-qa)
12. [Future Engineering Roadmap](#future-engineering-roadmap)
13. [License & Maintainer](#license--maintainer)

---

## Executive Overview & Problem Statement

Logistics platforms ingest millions of location pings daily. Traditional database architectures store raw latitude/longitude points directly in spatial tables, introducing three major liabilities:

1. **Surveillance & Trajectory Exposure:** Storing continuous (Lat, Lon) points creates an immutable movement history. A database leak exposes exact home addresses, routines, and physical habits of drivers.
2. **Database Throughput Degradation:** Performing point-in-polygon checks over raw streams during peak order windows leads to O(N) scanning bottlenecks and database lock latency.
3. **The Auditability Paradox:** Regulatory auditors and dispatch systems need aggregate counts of active drivers in a zone. However, returning exact counts allows adversaries to execute query differencing attacks to track individual driver entry and exit.

**CryptoSpatial-DB** solves this by enforcing **Ingestion-Time Geohash Truncation** paired with **PostGIS-Level Differential Privacy (ε = 1.5)**, delivering sub-second spatial containment reports with zero trajectory leakage.

---

## Key System Features

- **Ingested Spatial Masking:** Converts GPS points into 7-character Base32 Geohashes (≈153m × 153m grid resolution) on ingestion, immediately discarding pinpoint street coordinates.
- **PostGIS R-Tree (GiST) Spatial Indexing:** Leverages Generalized Search Trees over spatial MultiPolygons for O(log N) containment evaluations.
- **ε-Geo-Indistinguishability:** Stored PL/pgSQL procedures inject 2D Planar Laplace noise (ε = 1.5) into aggregate queries, mathematically preventing trajectory reconstruction.
- **Real-Time Control Dashboard:** Dark-themed React/Leaflet dashboard displaying active delivery geofences, driver markers, real-time audit output cards, and a side-by-side Raw vs. Masked Transformation Matrix.
- **One-Command CLI Management:** Custom Bash orchestration script (`manage.sh`) to start, stop, monitor, or tail logs across all tiers.
- **Production CI/CD:** GitHub Actions workflow verifying PostGIS migrations and React Vite production builds on every commit.

---

## Architecture & Data Pipeline

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        INGESTION & OBFUSCATION                          │
│  Driver GPS (Lat, Lon) ──► 7-Char Base32 Geohash ──► Discard Raw Coords │
└────────────────────────────────────┬──────────────────────────────────-─┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SPATIAL INDEXING & PERSISTENCE                       │
│  PostGIS 16 / Spatial DB ──► R-Tree (GiST) Indexing ──► O(log N) Lookup │
└────────────────────────────────────┬─────────────────────────────────-──┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DIFFERENTIAL PRIVACY AUDITING                       │
│  sp_generate_privacy_audit ──► 2D Laplace Noise (ε = 1.5) ──► Perturbed │
└────────────────────────────────────┬─────────────────────────────────-──┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONTROL CENTER VISUALIZATION                        │
│  React + Leaflet Dashboard ──► Live Transformation Matrix & Mapping     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## System Requirements & Prerequisites

Before installing and running CryptoSpatial-DB, ensure your environment meets these software dependencies:

| Component | Minimum Version | Recommended Version | Verification Command |
| :--- | :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS / WSL2 | Ubuntu 22.04 LTS / WSL2 | `uname -a` |
| **Docker Engine** | Docker 24.0+ | Docker 26.0+ | `docker --version` |
| **Python** | Python 3.10+ | Python 3.11+ | `python3 --version` |
| **Node.js** | Node 18.0+ | Node 20.0+ | `node -v` |
| **npm** | npm 9.0+ | npm 10.0+ | `npm -v` |
| **Git** | Git 2.34+ | Git 2.40+ | `git --version` |

---

## Installation & Setup Guide

Follow these step-by-step instructions to clone, configure, and launch the entire CryptoSpatial-DB stack locally.

### Step 1: Clone the Repository

Open your WSL2 / Linux terminal and clone the official repository:

```bash
# Clone repository from GitHub
git clone https://github.com/ihsn525/cryptospatial-db.git

# Navigate into project root directory
cd cryptospatial-db
```

---

### Step 2: Configure Environment & Dependencies

#### 2.1 Backend Virtual Environment Setup

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip and install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Return to root directory
cd ..
```

#### 2.2 Frontend Dependencies Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node packages via npm
npm install

# Return to root directory
cd ..
```

---

### Step 3: Configure Docker Container & DB Permissions

Ensure your current user account has permissions to run Docker containers without requiring `sudo`:

```bash
# Grant execution permissions to management script
chmod +x manage.sh

# Grant Docker group permissions (if not already applied)
sudo usermod -aG docker $USER
newgrp docker
```

---

### Step 4: Run the Complete Stack Automatically

Launch all three tiers (PostGIS Database Docker Container, FastAPI Middleware Backend, and React Vite Frontend Control Center) using the root management script:

```bash
# Start all services
./manage.sh start
```

#### Expected Terminal Output:

```text
[1/3] Starting PostGIS Database Container (cryptospatial_postgres)...
      PostgreSQL container started successfully.
[2/3] Starting FastAPI Backend Engine (Port 8000)...
      FastAPI started (PID: 12345). Logs -> logs/backend.log
[3/3] Starting React Vite Frontend Dashboard (Port 5173)...
      React Vite started (PID: 12346). Logs -> logs/frontend.log

==================================================
           CryptoSpatial-DB Status
==================================================
  Database (PostGIS 16): [ ONLINE  ] (Port 5432)
  Backend  (FastAPI):    [ ONLINE  ] -> http://127.0.0.1:8000/docs
  Frontend (React Vite): [ ONLINE  ] -> http://localhost:5173
==================================================
```

---

### Step 5: Verify Active Running Services

Once started, open your browser and access the following interfaces:

- **Interactive Frontend Dashboard:** `http://localhost:5173`
- **FastAPI Swagger API Documentation:** `http://127.0.0.1:8000/docs`
- **PostgreSQL / PostGIS Database Connection:** `localhost:5432` (`user: postgres`, `db: cryptospatial_db`)

---

## Service Orchestration (`manage.sh`)

The `manage.sh` script handles process isolation, daemon lifecycle management, and log streaming for all stack tiers:

```bash
# Start all stack tiers
./manage.sh start

# Inspect live status and PID execution states
./manage.sh status

# Tail consolidated backend and frontend server logs
./manage.sh logs

# Restart all services cleanly
./manage.sh restart

# Safely stop all servers and database containers
./manage.sh stop
```

---

## API Specification & Interactive Swagger Docs

The FastAPI backend exposes the following REST API endpoints:

| Endpoint | Method | Description | Sample Query Parameters |
| --- | --- | --- | --- |
| `/api/v1/seed-geofences` | `POST` | Seeds Koramangala & Indiranagar MultiPolygons into PostGIS | None |
| `/api/v1/simulate-pings` | `POST` | Generates randomized driver pings across Bengaluru hubs | `count=15` |
| `/api/v1/trigger-audit` | `POST` | Executes PostGIS procedure with Laplace Noise (ε = 1.5) | `epsilon=1.5` |
| `/api/v1/spatial-logs` | `GET` | Fetches ingested Geohash logs & raw transformation records | None |
| `/api/v1/audit-reports` | `GET` | Retrieves historical differential privacy audit logs | None |
| `/api/v1/reset-pings` | `DELETE` | Flushes spatial logs and audit reports, resetting PK counters | None |

---

## Database Schema & Stored Procedures

### 1. Spatial Logs & Geofence Schema (`database/migrations/001_initial_schema.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS spatial_logs (
    log_id BIGSERIAL PRIMARY KEY,
    raw_lat FLOAT,
    raw_lon FLOAT,
    masked_geohash VARCHAR(12) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS geofences (
    geofence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(100) NOT NULL,
    boundary_polygon GEOMETRY(MultiPolygon, 4326) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_geofences_spatial ON geofences USING GIST(boundary_polygon);
```

### 2. Differential Privacy Stored Procedure (`database/migrations/002_update_procedure.sql`)

```sql
CREATE OR REPLACE PROCEDURE sp_generate_privacy_audit(
    p_geofence_id UUID,
    p_epsilon FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_true_count INT;
    v_noise FLOAT;
    v_reported INT;
BEGIN
    SELECT COUNT(*) INTO v_true_count
    FROM spatial_logs l
    CROSS JOIN geofences g
    WHERE g.geofence_id = p_geofence_id
      AND ST_Contains(g.boundary_polygon, ST_SetSRID(ST_PointFromGeoHash(l.masked_geohash), 4326));

    v_noise := (random() - 0.5) * (2.0 / p_epsilon);
    v_reported := GREATEST(0, ROUND(v_true_count + v_noise));

    INSERT INTO audit_reports (geofence_id, true_count, laplacian_noise, reported_count)
    VALUES (p_geofence_id, v_true_count, v_noise, v_reported);
END;
$$;
```

---

## Continuous Integration & Delivery (CI/CD)

Every push or pull request to the `main` branch triggers an automated GitHub Actions pipeline (`.github/workflows/ci-cd.yml`):

1. **Backend Integration Pipeline:** Spins up an ephemeral `postgis/postgis:16-3.4` service container, installs Python dependencies, and verifies that database schema migrations (`001` and `002`) execute cleanly.
2. **Frontend Build Pipeline:** Installs Node package dependencies and executes `npm run build` to verify React Vite production bundle compilation.

---

## Troubleshooting & Common Issues

### Issue 1: `permission denied while trying to connect to the Docker daemon socket`

**Fix:** Run the socket permission command and refresh your terminal session:

```bash
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock
newgrp docker
```

### Issue 2: Address already in use (`Port 8000` or `Port 5173`)

**Fix:** Kill any lingering background processes bound to those ports using `fuser`:

```bash
fuser -k 8000/tcp
fuser -k 5173/tcp
./manage.sh restart
```

### Issue 3: Stored Procedure throws `ST_PointFromGeoHash` error

**Fix:** Ensure the PostGIS spatial extension is enabled in your database:

```bash
docker exec -i cryptospatial_postgres psql -U postgres -d cryptospatial_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

---

## Future Engineering Roadmap

- **Phase 1 (Client-Side SDK):** Native iOS/Android SDKs for edge Geohashing and SGX hardware enclave noise generation.
- **Phase 2 (Streaming Ingestion):** High-throughput Apache Kafka event streaming with real-time, dynamic geofence boundaries.
- **Phase 3 (Zero-Knowledge Proofs):** Integration of ZK-SNARKs allowing driver devices to cryptographically prove zone containment without transmitting Geohash strings.
- **Phase 4 (SaaS Compliance Engine):** Multi-tenant isolation with automated regulatory export reporting for the India DPDP Act (2023), EU GDPR, and US CCPA.

---

## License & Maintainer

Distributed under the **MIT License**.

- **Author:** Ihsan Siju
- **GitHub:** [@ihsn525](https://github.com/ihsn525) 
- **Collaborator(s):** Hanna Ann, Gowrika Menon
- **Project Repository:** [CryptoSpatial-DB on GitHub](https://github.com/ihsn525/cryptospatial-db)
