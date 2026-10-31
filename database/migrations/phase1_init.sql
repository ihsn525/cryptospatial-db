-- ============================================================================
-- Phase 1: In-Database Engineering Migration Script
-- Target Engine: PostgreSQL 16 + PostGIS 3.4 (Docker)
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Geofences Reference Table (If not already present)
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    boundary_polygon GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Spatial Logs (Active Live Telemetry Table)
CREATE TABLE IF NOT EXISTS spatial_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id VARCHAR(64) NOT NULL,
    masked_geohash VARCHAR(12) NOT NULL,
    raw_lat DOUBLE PRECISION DEFAULT NULL, -- Enforce NULL at edge ingestion
    raw_lon DOUBLE PRECISION DEFAULT NULL, -- Enforce NULL at edge ingestion
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    -- Stored Generated Geometry Column pointing to Geohash Tile Centroid
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_PointFromGeoHash(masked_geohash), 4326)
    ) STORED
);

-- Create GiST Index on Tile Centroid Geometry Column
CREATE INDEX IF NOT EXISTS idx_spatial_logs_geom_gist 
ON spatial_logs USING GIST (geom);

-- 4. Create Per-Analyst Budget Accounts Table
CREATE TABLE IF NOT EXISTS budget_accounts (
    analyst_id VARCHAR(64) PRIMARY KEY,
    dataset_scope VARCHAR(128) NOT NULL DEFAULT 'global',
    eps_spent DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    eps_cap DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Append-Only Privacy Budget Ledger
CREATE TABLE IF NOT EXISTS privacy_budget_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyst_id VARCHAR(64) NOT NULL REFERENCES budget_accounts(analyst_id),
    dataset_scope VARCHAR(128) NOT NULL DEFAULT 'global',
    query_id UUID UNIQUE NOT NULL, -- Replay protection
    epsilon_cost DOUBLE PRECISION NOT NULL,
    release_status VARCHAR(20) NOT NULL, -- 'ACCEPTED' or 'REJECTED_BUDGET'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Cryptographic Audit Hash-Chain Table
CREATE TABLE IF NOT EXISTS audit_reports (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID UNIQUE NOT NULL,
    geofence_id UUID REFERENCES geofences(id),
    released_count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    previous_hash VARCHAR(64) DEFAULT 'GENESIS_HASH',
    row_hash VARCHAR(64) NOT NULL
);

-- 7. Create Audit Hash-Chain Trigger Function
CREATE OR REPLACE FUNCTION generate_audit_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_hash VARCHAR(64);
BEGIN
    -- Retrieve the row_hash of the most recent audit entry
    SELECT row_hash INTO v_prev_hash
    FROM audit_reports
    ORDER BY created_at DESC, audit_id DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.previous_hash := v_prev_hash;
    -- Compute SHA-256 over: query_id || geofence_id || released_count || created_at || previous_hash
    NEW.row_hash := encode(
        digest(
            COALESCE(NEW.query_id::TEXT, '') ||
            COALESCE(NEW.geofence_id::TEXT, '') ||
            COALESCE(NEW.released_count::TEXT, '') ||
            COALESCE(NEW.created_at::TEXT, '') ||
            v_prev_hash,
            'sha256'
        ),
        'hex'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_hash_chain ON audit_reports;
CREATE TRIGGER trg_audit_hash_chain
BEFORE INSERT ON audit_reports
FOR EACH ROW
EXECUTE FUNCTION generate_audit_hash_chain();

-- 8. Privatized Laplace Zone-Count Release Stored Procedure
CREATE OR REPLACE FUNCTION release_zone_count(
    p_g_id UUID,
    p_analyst_id VARCHAR(64),
    p_query_id UUID
) RETURNS TABLE(status_code INT, released_count INT) AS $$
DECLARE
    v_spent DOUBLE PRECISION;
    v_cap DOUBLE PRECISION;
    v_eps_sel CONSTANT DOUBLE PRECISION := 0.1;
    v_eps_rho DOUBLE PRECISION;
    v_total_cost DOUBLE PRECISION;
    v_true_N INT;
    v_noisy_N DOUBLE PRECISION;
    v_u_sel DOUBLE PRECISION;
    v_x_sel DOUBLE PRECISION;
    v_u_rel DOUBLE PRECISION;
    v_x_rel DOUBLE PRECISION;
    v_polygon GEOMETRY;
    v_final_Y INT;
    v_varsigma CONSTANT DOUBLE PRECISION := 1e-15;
BEGIN
    -- A. Row-level Lock on Analyst Account (Prevents Race Conditions)
    SELECT eps_spent, eps_cap INTO v_spent, v_cap
    FROM budget_accounts
    WHERE analyst_id = p_analyst_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Analyst account % does not exist.', p_analyst_id;
    END IF;

    -- B. Budget Gate Check (Ensure capacity for selector + worst-case dense regime)
    IF (v_spent + v_eps_sel + 2.0) > v_cap THEN
        INSERT INTO privacy_budget_ledger (analyst_id, dataset_scope, query_id, epsilon_cost, release_status)
        VALUES (p_analyst_id, 'global', p_query_id, 0.0, 'REJECTED_BUDGET');
        
        -- Return HTTP 429 payload without raising an exception (prevents transaction rollback)
        RETURN QUERY SELECT 429, NULL::INT;
        RETURN;
    END IF;

    -- C. Query True Count
    SELECT boundary_polygon INTO v_polygon FROM geofences WHERE id = p_g_id;
    SELECT COUNT(*)::INT INTO v_true_N FROM spatial_logs WHERE ST_Contains(v_polygon, geom);

    -- D. Privatized Selector: Ñ = N + Lap(1 / eps_sel)
    v_u_sel := random() - 0.5;
    v_x_sel := -(1.0 / v_eps_sel) * sign(v_u_sel) * ln(GREATEST(1.0 - 2.0 * abs(v_u_sel), v_varsigma));
    v_noisy_N := v_true_N + v_x_sel;

    -- Regime decision based ONLY on noisy estimate Ñ
    IF v_noisy_N < 5.0 THEN
        v_eps_rho := 0.5; -- Sparse regime
    ELSE
        v_eps_rho := 2.0; -- Dense regime
    END IF;

    -- E. Primary Laplace Release: X = Lap(1 / eps_rho)
    v_u_rel := random() - 0.5;
    v_x_rel := -(1.0 / v_eps_rho) * sign(v_u_rel) * ln(GREATEST(1.0 - 2.0 * abs(v_u_rel), v_varsigma));
    v_final_Y := GREATEST(0, round(v_true_N + v_x_rel))::INT;

    -- F. Deduct Budget & Log Ledger Status
    v_total_cost := v_eps_sel + v_eps_rho;
    UPDATE budget_accounts SET eps_spent = eps_spent + v_total_cost WHERE analyst_id = p_analyst_id;

    INSERT INTO privacy_budget_ledger (analyst_id, dataset_scope, query_id, epsilon_cost, release_status)
    VALUES (p_analyst_id, 'global', p_query_id, v_total_cost, 'ACCEPTED');

    -- G. Audit Report Insertion (Stores ONLY released count Y; omit N, Ñ, and noise)
    INSERT INTO audit_reports (query_id, geofence_id, released_count, created_at)
    VALUES (p_query_id, p_g_id, v_final_Y, NOW());

    RETURN QUERY SELECT 200, v_final_Y;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Role-Based Access Control Setup
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'analyst_user') THEN
        CREATE ROLE analyst_user WITH LOGIN PASSWORD 'analyst_secure_pass';
    END IF;
END $$;

-- Revoke all direct permissions on underlying tables from analyst_user
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM analyst_user;

-- Grant EXECUTE privileges strictly to release_zone_count
GRANT EXECUTE ON FUNCTION release_zone_count(UUID, VARCHAR, UUID) TO analyst_user;

-- Grant SELECT access on ledger for self-accounting via Row-Level Security (RLS)
ALTER TABLE privacy_budget_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analyst_ledger_policy ON privacy_budget_ledger;
CREATE POLICY analyst_ledger_policy ON privacy_budget_ledger
    FOR SELECT
    TO analyst_user
    USING (analyst_id = current_user);

GRANT SELECT ON privacy_budget_ledger TO analyst_user;