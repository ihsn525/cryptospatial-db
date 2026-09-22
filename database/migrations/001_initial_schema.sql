-- Enable PostGIS spatial extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. ROLES Table
CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(30) UNIQUE NOT NULL CHECK (role_name IN ('ADMIN', 'AUDITOR', 'DRIVER')),
    description TEXT
);

-- 2. USERS Table (SINGLE TABLE MANDATORY REQUIREMENT)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. GEOFENCE_CATEGORIES Table
CREATE TABLE geofence_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- 4. GEOFENCES Table (Spatial Polygon Geometry)
CREATE TABLE geofences (
    geofence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(100) NOT NULL,
    category_id INT REFERENCES geofence_categories(category_id),
    boundary_polygon GEOMETRY(MultiPolygon, 4326) NOT NULL,
    created_by UUID REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. SPATIAL_LOGS Table
CREATE TABLE spatial_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    masked_geohash VARCHAR(12) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. PRIVACY_BUDGETS Table
CREATE TABLE privacy_budgets (
    budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    epsilon_value FLOAT NOT NULL DEFAULT 1.0 CHECK (epsilon_value > 0),
    remaining_budget FLOAT NOT NULL DEFAULT 10.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUDIT_REPORTS Table
CREATE TABLE audit_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geofence_id UUID REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    true_count INT NOT NULL,
    laplacian_noise FLOAT NOT NULL,
    reported_count INT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. SYSTEM_AUDIT_LOGS Table
CREATE TABLE system_audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action_performed VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Spatial R-Tree (GiST) Indexing for O(log N) Performance
CREATE INDEX idx_geofences_gist ON geofences USING GIST(boundary_polygon);
CREATE INDEX idx_spatial_logs_geohash ON spatial_logs(masked_geohash);

-- View: Active Geofence Metrics
CREATE VIEW vw_active_geofence_metrics AS
SELECT 
    g.geofence_id, g.zone_name, c.category_name, c.risk_level, COUNT(r.report_id) AS total_audits
FROM geofences g
LEFT JOIN geofence_categories c ON g.category_id = c.category_id
LEFT JOIN audit_reports r ON g.geofence_id = r.geofence_id
WHERE g.is_active = TRUE
GROUP BY g.geofence_id, g.zone_name, c.category_name, c.risk_level;

-- Stored Procedure: Generate Privacy Audit Report
CREATE OR REPLACE PROCEDURE sp_generate_privacy_audit(p_geofence_id UUID, p_epsilon FLOAT)
LANGUAGE plpgsql AS $$
DECLARE 
    v_true_count INT; 
    v_noise FLOAT; 
    v_reported INT;
BEGIN
    SELECT COUNT(*) INTO v_true_count FROM spatial_logs l JOIN geofences g ON g.geofence_id = p_geofence_id
    WHERE ST_Contains(g.boundary_polygon, ST_SetSRID(ST_Point(0,0), 4326));
    
    v_noise := (random() - 0.5) * (2.0 / p_epsilon);
    v_reported := GREATEST(0, ROUND(v_true_count + v_noise));
    
    INSERT INTO audit_reports (geofence_id, true_count, laplacian_noise, reported_count)
    VALUES (p_geofence_id, v_true_count, v_noise, v_reported);
END; $$;

-- Trigger: Audit User Registration
CREATE OR REPLACE FUNCTION fn_log_user_registration() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO system_audit_logs (user_id, action_performed) VALUES (NEW.user_id, 'NEW_USER_REGISTERED');
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_user_insert AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION fn_log_user_registration();

-- Seed Default Roles
INSERT INTO roles (role_name, description) VALUES 
('ADMIN', 'System Administrator'),
('AUDITOR', 'Privacy Compliance Auditor'),
('DRIVER', 'Delivery Partner / Field Operator');