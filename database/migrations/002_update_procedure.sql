-- =============================================================================
-- CryptoSpatial-DB: Transaction-Safe Inverse-Transform Sampling Laplace DP
-- =============================================================================

CREATE OR REPLACE PROCEDURE sp_generate_privacy_audit(
    p_geofence_id UUID, 
    p_epsilon FLOAT
) 
LANGUAGE plpgsql AS $$
DECLARE
    v_polygon    GEOMETRY;
    v_true_count INT;
    v_noise      FLOAT;
    v_u          FLOAT;
    v_reported   INT;
BEGIN
    -- 1. Fetch Geofence Spatial Boundary
    SELECT boundary_polygon INTO v_polygon
    FROM geofences 
    WHERE geofence_id = p_geofence_id;

    IF v_polygon IS NULL THEN
        RAISE EXCEPTION 'Geofence ID % not found.', p_geofence_id;
    END IF;

    -- 2. Execute Sub-Linear Point-in-Polygon Evaluation via GiST Index
    SELECT COUNT(*) INTO v_true_count
    FROM spatial_logs
    WHERE ST_Contains(
        v_polygon, 
        ST_SetSRID(ST_PointFromGeoHash(masked_geohash), 4326)
    );

    -- 3. Draw Centered Uniform Random Variable u in (-0.5, 0.5)
    v_u := random() - 0.5;

    -- 4. Inverse Transform Sampling for True Laplace Distribution Laplace(0, 1/epsilon)
    v_noise := -(1.0 / p_epsilon) * SIGN(v_u) 
               * LN(GREATEST(1.0 - 2.0 * ABS(v_u), 1e-12));
    
    -- 5. Calculate & Clamp Perturbed Output
    v_reported := GREATEST(0, ROUND(v_true_count + v_noise));

    -- 6. Persist Immutable Audit Report Entry
    INSERT INTO audit_reports (
        geofence_id, true_count, laplacian_noise, reported_count
    ) VALUES (
        p_geofence_id, v_true_count, v_noise, v_reported
    );

    -- Transaction commit managed externally by caller (SQLAlchemy AsyncSession)
END;
$$;