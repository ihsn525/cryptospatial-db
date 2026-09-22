# CryptoSpatial-DB: Privacy-Preserving Geospatial Auditing Engine

An enterprise-grade, privacy-preserving geospatial auditing platform built for logistics and delivery applications. CryptoSpatial-DB allows platforms to verify delivery hub coverage and perform spatial queries **without storing or exposing raw latitude/longitude driver coordinates**.

---

## Architecture & Privacy Model

The platform employs a multi-layered privacy and indexing architecture:

1. **Spatial Geohashing (Base32):**
   Incoming raw GPS coordinates `(Latitude, Longitude)` are converted at ingest time into a 7-character Base32 Geohash (e.g., `tdr1wb3`). This discards pinpoint street address precision while preserving neighborhood-level spatial proximity.

2. **2D Planar Laplace Noise Injection ($\epsilon$-Geo-Indistinguishability):**
   Audit queries executed via PostGIS stored procedures inject differential noise sampled from a continuous 2D Laplace distribution ($\epsilon = 1.5$). This satisfies $\epsilon$-Geo-Indistinguishability, making individual trajectory reconstruction mathematically impossible.

3. **High-Performance PostGIS R-Tree (GiST) Indexing:**
   Geofence boundary evaluations compute in $O(\log N)$ time using PostGIS `ST_Contains` over spatial bounding polygons directly on decoded Geohash points.

---

## Tech Stack

* **Database:** PostgreSQL 16 + PostGIS 3.4 (Dockerized)
* **Backend:** FastAPI, AsyncIO, SQLAlchemy 2.0, AsyncPG, Pydantic v2
* **Frontend:** React (Vite), Leaflet, React-Leaflet, Lucide-React, Axios
* **Infrastructure:** WSL2 / Ubuntu 22.04 LTS, Bash Automation

---

## Quick Start Guide

### Prerequisites
* Docker Engine & Docker Compose
* Python 3.10+
* Node.js 18+ & npm

### Automated Service Management
Use the root management script to control all tiers simultaneously:

```bash
# Start all tiers (PostGIS, FastAPI, React Vite)
./manage.sh start

# Check real-time service health & ports
./manage.sh status

# Stream live backend & frontend logs
./manage.sh logs

# Stop all services cleanly
./manage.sh stop