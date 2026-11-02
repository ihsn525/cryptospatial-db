-- DDL Schema Specification (Table 2 in Paper)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS spatial_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id VARCHAR(64) NOT NULL,
    masked_geohash VARCHAR(7) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_lat DOUBLE PRECISION NULL,
    raw_lon DOUBLE PRECISION NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_PointFromGeoHash(masked_geohash), 4326)
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_spatial_logs_gist ON spatial_logs USING GIST (geom);

-- Fast CSV Import Command
-- \copy spatial_logs(log_id, driver_id, masked_geohash, recorded_at, raw_lat, raw_lon) FROM 'data/dataset_100k.csv' WITH (FORMAT csv, HEADER true);