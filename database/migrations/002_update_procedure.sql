-- Update stored procedure to dynamically decode Geohashes to Points with SRID 4326
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