# CryptoSpatial-DB: A Privacy-Accounted Spatial Query Architecture

![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/ihsn525/cryptospatial-db/ci-cd.yml?branch=main&label=CI%2FCD%20Pipeline&style=for-the-badge&logo=github)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-PostGIS_3.4.1-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-Vite_5-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![IEEE Access](https://img.shields.io/badge/Paper-IEEE_Access_Draft-blue?style=for-the-badge)

**CryptoSpatial-DB** is a high-throughput, privacy-accounted spatial database middleware built for PostgreSQL 16 with the PostGIS 3.4 extension. Designed for hyper-local logistics, delivery dispatch engines, intelligent transportation networks, and telecommunications geofencing, it resolves the fundamental conflict between spatial indexing utility, differential privacy guarantees, and ephemeral record lifecycle enforcement.

Coordinates are quantized into precision-7 Base32 Geohash tiles ($153\,\text{m} \times 153\,\text{m}$ at the equator) before database persistence, setting raw latitude and longitude to `NULL`. A generated tile-centroid column carries a Generalized Search Tree (GiST) R-Tree index to maintain $O(\log N)$ spatial containment queries. Zone-count releases are handled via an in-database procedure that samples Laplace noise via inverse cumulative distribution function (CDF) transformation and charges an atomic, row-locked per-analyst privacy-budget ledger.

---

## Key System Features

* **Ingestion-Time Coordinate Discretization:** Automatically converts $(\phi, \lambda)$ GPS streams into 7-character Geohash tile IDs (`masked_geohash`). Raw coordinate fields are rendered `NULL` upon insert to protect against physical database snapshot leaks (Storage Adversary A1).
* **GiST Centroid Indexing:** Generates stored tile-centroid point geometries (`geom = ST_SetSRID(ST_PointFromGeoHash(masked_geohash), 4326)`) indexed via PostGIS GiST R-Trees, bypassing the encryption performance wall.
* **Privatized Adaptive Budget Selector:** Eliminates threshold leakage by picking privacy regimes ($\epsilon_\rho \in \{0.5, 2.0\}$) using a privatized noisy estimate ($\epsilon_{\text{sel}} = 0.1$), guaranteeing pure $\epsilon$-differential privacy ($\epsilon_{\text{total}} \le 2.1$).
* **Atomic Budget Ledger:** Enforces sequential composition ($\sum \epsilon_i \le \epsilon_{\text{cap}} = 5.0$) using row-level `FOR UPDATE` locking on analyst records (`privacy_budget_ledger`) to prevent concurrent budget overspending.
* **Bounded Boundary Classification:** Geometrically bounds containment misclassification to a boundary strip of $\delta \le 108.18\,\text{m}$. Achieves zero false positives/negatives beyond $108\,\text{m}$.
* **Server-Clock Ephemeral Record Lifecycle:** Automatically purges operational pings older than $T_{\text{eph}} = 90\,\text{s}$ using server-clock atomic Common Table Expressions (CTEs), transferring coarse tile strings to cold archive tables while discarding point geometries.
* **2-of-3 Key Quorum Break-Glass Unmasking:** Requires a minimum threshold quorum of 2 valid keys from `{K_admin, K_police, K_auditor}` to authorize emergency unmasking, returning tile centroids rather than exact points.
* **Tamper-Evident Audit Logging & Attestation:** Maintains SHA-256 hash-chained audit reports (`audit_reports`) and issues 300-second rotating HMAC-SHA256 presence attestation tokens.

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             MIDDLEWARE INGESTION LAYER                           │
│  Client GPS Stream (φ, λ) ──► Base32 Geohash (p=7) ──► Raw Lat/Lon Set to NULL   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL 16 / POSTGIS 3.4 ENGINE                        │
│  Generated Geometry Column ──► GiST R-Tree Indexing ──► O(log N) Centroid Search │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      IN-DATABASE PRIVACY & LEDGER ENGINE                         │
│  FOR UPDATE Row Lock ──► Privatized Selector ──► Laplace Noise ──► Budget Ledger  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     EPHEMERAL LIFECYCLE & AUDIT SERVICES                         │
│  Atomic CTE Purge (90s) ──► 2-of-3 Quorum Break-Glass ──► SHA-256 Hash Chaining  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```text
cryptospatial-db/
├── backend/                  # FastAPI Middleware (Python 3.12, asyncpg, SQLAlchemy 2.0)
│   ├── app/
│   │   ├── main.py           # API routes, DP release endpoints, break-glass handler
│   │   └── routers/          # Modular API routing controllers
│   ├── Dockerfile            # Container build specification for backend API
│   └── requirements.txt      # Python dependencies
├── database/                 # PostGIS Database Layer
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # Operational, ledger, audit, & archive tables
│   │   └── 002_update_procedure.sql # In-database DP release & budget ledger stored procedures
│   └── backups/              # Seed SQL data dumps
├── frontend/                 # Primary Web Control Center (React 18 + Vite 5)
├── db-inspector/             # Database Inspection & Real-time Visualizer
├── fooddash-app/             # Delivery Logistics Demo Client Application
├── cryptospatial_sdk.py      # Python Client SDK for API integration
├── manage.sh                 # Unified CLI management & process lifecycle script
├── docker-compose.yml        # Docker composition setup for PostgreSQL/PostGIS
└── test_security_guards.py   # Security test matrix & concurrency test suite
```

---

## System Requirements & Tech Stack

* **Database Engine:** PostgreSQL 16.4 with PostGIS 3.4.1 extension (Docker containerized)
* **Middleware Framework:** FastAPI (Python 3.12), `asyncpg`, `SQLAlchemy 2.0 AsyncSession`
* **Frontend Dashboard:** React 18, Vite 5, Tailwind CSS, Leaflet.js
* **Operating System:** Ubuntu 22.04 LTS / 24.04 LTS / WSL2 Linux kernel 6.6+
* **Prerequisites:** Docker 24.0+, Python 3.10+, Node.js 18+

---

## Quick Start & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ihsn525/cryptospatial-db.git
cd cryptospatial-db
```

### 2. Configure Execution Permissions

```bash
chmod +x manage.sh showcase_db.sh
```

### 3. Start the Full Application Stack

Launch all services (PostGIS Docker container, FastAPI backend daemon, and React frontend dashboard) using the unified management CLI:

```bash
./manage.sh start
```

### 4. Service Dashboard Access

Once started, open your browser to access:

* **React Control Center Dashboard:** `http://localhost:5173`
* **FastAPI Swagger API Documentation:** `http://127.0.0.1:8000/docs`
* **Database Connection:** `localhost:5432` (`user: postgres`, `pass: postgres`, `db: cryptospatial_db`)

---

## Service Orchestration CLI (`manage.sh`)

The `manage.sh` management script handles daemon process control, container execution, and log streaming:

```bash
./manage.sh start     # Start PostGIS container, backend FastAPI server, and frontend Vite server
./manage.sh status    # Inspect live status, running ports, and process PIDs
./manage.sh logs      # Stream consolidated backend and frontend logs
./manage.sh restart   # Perform a clean service restart
./manage.sh stop      # Terminate background services and stop Docker containers
```

---

## Experimental Benchmarks & Performance Metrics

System benchmarks evaluated on an Intel Core i5-12450HX host (WSL2, 6 vCPUs, 11 GB RAM) using Dockerized PostgreSQL 16 / PostGIS 3.4.1 over $100{,}000$ synthetic GPS pings:

### 1. Scalability & Latency Comparison ($N=10^5$ Records)

| System Architecture | $p50$ Latency (ms) | $p95$ Latency (ms) | Throughput (QPS) | Memory (MB) |
| --- | --- | --- | --- | --- |
| **System A** (Exact PostGIS, GiST on raw points) | 4.12 | 8.45 | 235 | 14.8 |
| **System B** (Geohash/GiST, No DP) | 0.98 | 2.10 | 9,210 | 8.6 |
| **System C** (Full CryptoSpatial-DB) | **1.12** | **2.34** | **8,620** | **11.2** |
| **AES-256 Column Encryption Baseline** | 210.80 | 420.50 | 95 | 32.0 |

*CryptoSpatial-DB delivers a **$176\times$ throughput advantage** and **$462\times$ latency reduction** over AES-256 column encryption while eliminating raw coordinate storage.*

### 2. Concurrency Scaling Sweep ($C=1$ to $50$ Clients)

| Concurrent Clients ($C$) | Peak Throughput (QPS) | $p50$ Latency (ms) | $p95$ Latency (ms) | Status |
| --- | --- | --- | --- | --- |
| 1 | 236 | 4.06 | 5.17 | Normal |
| **5** | **243** | **13.92** | **50.14** | **Peak Throughput** |
| 10 | 226 | 30.14 | 114.79 | Normal |
| 20 | 205 | 63.77 | 279.08 | Lock Contention |
| 50 | 184 | 149.94 | 837.33 | High Load |

### 3. Spatial Classification Error Bounds (Proposition 2)

| Distance Band to Boundary ($d$) | False Positive Rate (FPR) | False Negative Rate (FNR) | Misclassification Risk |
| --- | --- | --- | --- |
| $0\,\text{m} - 25\,\text{m}$ | 0.431 | 0.456 | Bounded ($\le 108.18\,\text{m}$) |
| $25\,\text{m} - 50\,\text{m}$ | 0.326 | 0.340 | Bounded ($\le 108.18\,\text{m}$) |
| $50\,\text{m} - 108\,\text{m}$ | 0.140 | 0.117 | Bounded ($\le 108.18\,\text{m}$) |
| **$> 108.18\,\text{m}$** | **0.000** | **0.000** | **Zero Error Guaranteed** |

## Dataset & Reproducibility

The repository includes the synthetic GPS telemetry dataset representing location observations in the Vellore region (12.96°N to 12.98°N, 79.13°E to 79.16°E), as described in Section VII-A of the IEEE Access manuscript.

- **Baseline Dataset (100,000 records):** `data/dataset_100k.csv`
- **Scalability Dataset (1,000,000 records):** `data/dataset_1m.csv`
- **Dataset Generator Script:** `scripts/generate_dataset.py`

### Regenerating Datasets
To regenerate the datasets from scratch using fixed seed `42`:

```bash
python scripts/generate_dataset.py --records 100000 --output data/dataset_100k.csv --seed 42
python scripts/generate_dataset.py --records 1000000 --output data/dataset_1m.csv --seed 42
```
---

## Security Verification Matrix

Run the security guardrail verification test suite:

```bash
python3 test_security_guards.py
```

| Attack Vector | Attacker Model | Expected Defense | Observed Result | Status |
| --- | --- | --- | --- | --- |
| **Direct Table Read** | Storage Adversary (A1) | SQL RBAC Denial | Permission Denied on raw tables | **PASS** |
| **Threshold Leakage** | Querying Analyst (A2) | Privatized Budget Selector | Smooth regime selection probability | **PASS** |
| **Budget Exhaustion** | Querying Analyst (A2) | Cumulative Ledger Cap ($5.0$) | 4th sequential release rejected (HTTP 429) | **PASS** |
| **Concurrent Spend** | Querying Analyst (A2) | `FOR UPDATE` Row Lock | 1 accepted (200), 49 denied (429) out of 50 | **PASS** |
| **Unilateral Unmask** | Insider Adversary (A3) | 2-of-3 Key Quorum | Single key blocked (HTTP 403) | **PASS** |
| **Audit Log Edit** | Storage Adversary (A1) | SHA-256 Hash Chain | Direct SQL edit breaks chain continuity | **PASS** |

---

## Citation & Publication

If you use CryptoSpatial-DB in academic research, please cite our manuscript:

```bibtex
@article{siju2026cryptospatial,
  title={CryptoSpatial-DB: A Privacy-Accounted Spatial Query Architecture with In-Database Differential Privacy and Ephemeral Lifecycle Enforcement},
  author={Siju, Ihsan and Deepika, J. and Lalu, Hanna Ann and Menon, Gowrika},
  journal={IEEE Access},
  year={2026},
  publisher={IEEE}
}
```

---

## Authors & License

* **Ihsan Siju** - School of Computer Science and Engineering, VIT Vellore
* **Dr. Deepika J** *(Corresponding Author)* - Assistant Professor Senior, School of Computer Science and Engineering, VIT Vellore (`deepika.j@vit.ac.in`)
* **Hanna Ann Lalu** - School of Computer Science and Engineering, VIT Vellore
* **Gowrika Menon** - School of Computer Science and Engineering, VIT Vellore

Distributed under the **MIT License**. See `LICENSE` for details.
