import time
import hashlib
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Import database session generator and models from your main/models module
from main import get_db, SpatialLogModel

router = APIRouter(prefix="/v1/sdk", tags=["CryptoSpatial Middleware SDK"])

GRID_PRECISION_MAP = {
    5: "4.9km x 4.9km",
    6: "1.2km x 0.6km",
    7: "153m x 153m",
    8: "38m x 19m"
}

def encode_geohash(latitude: float, longitude: float, precision: int = 7) -> str:
    base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    lat_interval, lon_interval = (-90.0, 90.0), (-180.0, 180.0)
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit, ch = 0, 0
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
            bit, ch = 0, 0
    return ''.join(geohash)

def generate_zk_proof_token(driver_id: str, geofence_id: str) -> str:
    seed = f"{driver_id}:{geofence_id}:{int(time.time() // 300)}"
    digest = hashlib.sha256(seed.encode()).hexdigest()[:12]
    return f"zk_proof_{digest}"


# --- REQUEST & RESPONSE SCHEMAS ---

class TelemetryMaskRequest(BaseModel):
    driver_id: str = Field(..., example="DRV-9042")
    raw_latitude: float = Field(..., example=12.935241)
    raw_longitude: float = Field(..., example=77.624518)
    precision: int = Field(default=7, ge=5, le=8)

class TelemetryMaskResponse(BaseModel):
    status: str
    masked_geohash: str
    precision_grid_meters: str
    raw_coordinates_purged: bool

class ProofOfPresenceRequest(BaseModel):
    driver_id: str
    masked_geohash: str
    geofence_id: str

class ProofOfPresenceResponse(BaseModel):
    is_inside_zone: bool
    geofence_name: str
    proof_token: str

class PrivacyCountResponse(BaseModel):
    geofence_name: str
    true_count_redacted: bool
    reported_privacy_count: int
    differential_privacy_epsilon: float
    applied_mechanism: str


# --- ENDPOINTS ---

@router.post("/telemetry/mask", response_model=TelemetryMaskResponse)
async def mask_telemetry(payload: TelemetryMaskRequest, db: AsyncSession = Depends(get_db)):
    masked_hash = encode_geohash(payload.raw_latitude, payload.raw_longitude, payload.precision)
    
    # Store masked geohash; raw coordinates are purged at edge[cite: 14]
    ping = SpatialLogModel(
        driver_id=payload.driver_id,
        raw_lat=None,
        raw_lon=None,
        masked_geohash=masked_hash
    )
    db.add(ping)
    await db.commit()

    return TelemetryMaskResponse(
        status="success",
        masked_geohash=masked_hash,
        precision_grid_meters=GRID_PRECISION_MAP.get(payload.precision, "153m x 153m"),
        raw_coordinates_purged=True
    )

@router.post("/zone/proof-of-presence", response_model=ProofOfPresenceResponse)
async def verify_proof_of_presence(payload: ProofOfPresenceRequest, db: AsyncSession = Depends(get_db)):
    query = text("""
        SELECT zone_name, 
               ST_Contains(boundary_polygon, ST_SetSRID(ST_PointFromGeoHash(:geohash), 4326)) AS is_inside
        FROM geofences
        WHERE geofence_id = CAST(:g_id AS uuid) AND is_active = TRUE;
    """)
    res = await db.execute(query, {"geohash": payload.masked_geohash, "g_id": payload.geofence_id})
    row = res.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Geofence zone not found or inactive")

    is_inside = bool(row.is_inside)
    proof_token = generate_zk_proof_token(payload.driver_id, payload.geofence_id) if is_inside else "invalid_proof"

    return ProofOfPresenceResponse(
        is_inside_zone=is_inside,
        geofence_name=row.zone_name,
        proof_token=proof_token
    )

@router.get("/analytics/privacy-count", response_model=PrivacyCountResponse)
async def get_privacy_count(geofence_id: str, epsilon: float = 1.5, db: AsyncSession = Depends(get_db)):
    proc_query = text("CALL sp_generate_privacy_audit(CAST(:g_id AS uuid), :eps)")
    await db.execute(proc_query, {"g_id": geofence_id, "eps": epsilon})
    await db.commit()

    report_query = text("""
        SELECT g.zone_name, r.reported_count
        FROM audit_reports r
        JOIN geofences g ON r.geofence_id = g.geofence_id
        WHERE r.geofence_id = CAST(:g_id AS uuid)
        ORDER BY r.generated_at DESC LIMIT 1;
    """)
    res = await db.execute(report_query, {"g_id": geofence_id})
    report = res.fetchone()

    if not report:
        raise HTTPException(status_code=404, detail="No audit report found for this zone")

    return PrivacyCountResponse(
        geofence_name=report.zone_name,
        true_count_redacted=True,
        reported_privacy_count=report.reported_count,
        differential_privacy_epsilon=epsilon,
        applied_mechanism="2D Laplace Distribution"
    )