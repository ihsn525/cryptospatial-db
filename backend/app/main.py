import os
import random
import uuid
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, BigInteger, DateTime, Float, Integer, Boolean, select, text
from pydantic import BaseModel
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:cryptosecretpassword99@localhost:5432/cryptospatial_db")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# --- GEOHASH ENCODER UTILITY ---
def encode_geohash(latitude, longitude, precision=7):
    base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    lat_interval, lon_interval = (-90.0, 90.0), (-180.0, 180.0)
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True
    while len(geohash) < precision:
        if even:
            mid = (lon_interval[0] + lon_interval[1]) / 2
            if longitude > mid:
                ch |= bits[bit]
                lon_interval = (mid, lon_interval[1])
            else:
                lon_interval = (lon_interval[0], mid)
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2
            if latitude > mid:
                ch |= bits[bit]
                lat_interval = (mid, lat_interval[1])
            else:
                lat_interval = (lat_interval[0], mid)
        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(base32[ch])
            bit = 0
            ch = 0
    return ''.join(geohash)

# --- DATABASE MODELS ---
class SpatialLogModel(Base):
    __tablename__ = "spatial_logs"
    log_id = Column(BigInteger, primary_key=True, index=True)
    raw_lat = Column(Float, nullable=True)
    raw_lon = Column(Float, nullable=True)
    masked_geohash = Column(String(12), nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class GeofenceModel(Base):
    __tablename__ = "geofences"
    geofence_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    zone_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

class AuditReportModel(Base):
    __tablename__ = "audit_reports"
    report_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    geofence_id = Column(String, nullable=False)
    true_count = Column(Integer, nullable=False)
    laplacian_noise = Column(Float, nullable=False)
    reported_count = Column(Integer, nullable=False)
    generated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

app = FastAPI(title="CryptoSpatial-DB Middleware Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- API ENDPOINTS ---

@app.get("/")
async def root():
    return {"status": "online", "system": "CryptoSpatial-DB Middleware Engine"}

# 1. Fetch Spatial Logs
@app.get("/api/v1/spatial-logs")
async def get_spatial_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    stmt = select(SpatialLogModel).order_by(SpatialLogModel.log_id.desc()).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return {"count": len(logs), "data": logs}

# 2. Simulate Driver GPS Location Pings
@app.post("/api/v1/simulate-pings")
async def simulate_driver_pings(count: int = 15, db: AsyncSession = Depends(get_db)):
    base_locations = [
        (12.9352, 77.6245), # Koramangala Hub
        (12.9784, 77.6408), # Indiranagar Hub
        (12.9141, 77.6411), # HSR Layout Hub
    ]
    
    new_pings = []
    for _ in range(count):
        lat_base, lon_base = random.choice(base_locations)
        lat = round(lat_base + random.uniform(-0.008, 0.008), 6)
        lon = round(lon_base + random.uniform(-0.008, 0.008), 6)
        
        ghash = encode_geohash(lat, lon, precision=7)
        ping = SpatialLogModel(raw_lat=lat, raw_lon=lon, masked_geohash=ghash)
        db.add(ping)
        new_pings.append({"lat": lat, "lon": lon, "geohash": ghash})
    
    await db.commit()
    return {"status": "success", "generated_pings": len(new_pings), "pings": new_pings}

@app.delete("/api/v1/reset-pings")
async def reset_spatial_pings(db: AsyncSession = Depends(get_db)):
    await db.execute(text("TRUNCATE TABLE spatial_logs, audit_reports RESTART IDENTITY CASCADE;"))
    await db.commit()
    return {"status": "success", "message": "Spatial logs and audit history cleared"}

# 3. Seed Default Geofence Hubs
@app.post("/api/v1/seed-geofences")
async def seed_geofences(db: AsyncSession = Depends(get_db)):
    # Insert Koramangala & Indiranagar Spatial Polygons
    seed_sql = text("""
        INSERT INTO geofences (geofence_id, zone_name, boundary_polygon, is_active)
        VALUES 
        ('11111111-1111-1111-1111-111111111111', 'Koramangala Logistics Hub', 
         ST_GeomFromText('MULTIPOLYGON(((77.6150 12.9280, 77.6350 12.9280, 77.6350 12.9420, 77.6150 12.9420, 77.6150 12.9280)))', 4326), TRUE),
        ('22222222-2222-2222-2222-222222222222', 'Indiranagar Express Zone', 
         ST_GeomFromText('MULTIPOLYGON(((77.6300 12.9700, 77.6500 12.9700, 77.6500 12.9850, 77.6300 12.9850, 77.6300 12.9700)))', 4326), TRUE)
        ON CONFLICT (geofence_id) DO NOTHING;
    """)
    await db.execute(seed_sql)
    await db.commit()
    return {"status": "success", "message": "Geofences seeded into PostGIS successfully"}

# 4. Trigger Differential Privacy Audit
@app.post("/api/v1/trigger-audit")
async def trigger_privacy_audit(epsilon: float = 1.0, db: AsyncSession = Depends(get_db)):
    # Fetch random geofence
    stmt = select(GeofenceModel).limit(1)
    res = await db.execute(stmt)
    geofence = res.scalars().first()
    
    if not geofence:
        raise HTTPException(status_code=400, detail="No geofences found. Please seed geofences first.")
    
    # Execute PostGIS Audit Stored Procedure
    # Updated SQL call with explicit UUID casting
    proc_sql = text("CALL sp_generate_privacy_audit(CAST(:g_id AS uuid), :eps)")
    await db.execute(proc_sql, {"g_id": str(geofence.geofence_id), "eps": float(epsilon)})
    await db.commit()
    
    # Fetch generated report
    rep_stmt = select(AuditReportModel).order_by(AuditReportModel.generated_at.desc()).limit(1)
    rep_res = await db.execute(rep_stmt)
    report = rep_res.scalars().first()
    
    return {
        "status": "audit_completed",
        "geofence_zone": geofence.zone_name,
        "true_count": report.true_count if report else 0,
        "laplacian_noise": report.laplacian_noise if report else 0.0,
        "reported_count": report.reported_count if report else 0
    }

# 5. Fetch Audit History Reports
@app.get("/api/v1/audit-reports")
async def get_audit_reports(db: AsyncSession = Depends(get_db)):
    stmt = select(AuditReportModel).order_by(AuditReportModel.generated_at.desc()).limit(10)
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return {"data": reports}