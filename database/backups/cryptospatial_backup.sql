--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.users DROP CONSTRAINT users_role_id_fkey;
ALTER TABLE ONLY public.system_audit_logs DROP CONSTRAINT system_audit_logs_user_id_fkey;
ALTER TABLE ONLY public.spatial_logs DROP CONSTRAINT spatial_logs_user_id_fkey;
ALTER TABLE ONLY public.privacy_budgets DROP CONSTRAINT privacy_budgets_user_id_fkey;
ALTER TABLE ONLY public.geofences DROP CONSTRAINT geofences_created_by_fkey;
ALTER TABLE ONLY public.geofences DROP CONSTRAINT geofences_category_id_fkey;
ALTER TABLE ONLY public.audit_reports DROP CONSTRAINT audit_reports_geofence_id_fkey;
DROP TRIGGER trg_after_user_insert ON public.users;
DROP INDEX public.idx_spatial_logs_geohash;
DROP INDEX public.idx_geofences_gist;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_key;
ALTER TABLE ONLY public.system_audit_logs DROP CONSTRAINT system_audit_logs_pkey;
ALTER TABLE ONLY public.spatial_logs DROP CONSTRAINT spatial_logs_pkey;
ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_role_name_key;
ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_pkey;
ALTER TABLE ONLY public.privacy_budgets DROP CONSTRAINT privacy_budgets_pkey;
ALTER TABLE ONLY public.geofences DROP CONSTRAINT geofences_pkey;
ALTER TABLE ONLY public.geofence_categories DROP CONSTRAINT geofence_categories_pkey;
ALTER TABLE ONLY public.audit_reports DROP CONSTRAINT audit_reports_pkey;
ALTER TABLE public.system_audit_logs ALTER COLUMN audit_id DROP DEFAULT;
ALTER TABLE public.spatial_logs ALTER COLUMN log_id DROP DEFAULT;
ALTER TABLE public.roles ALTER COLUMN role_id DROP DEFAULT;
ALTER TABLE public.geofence_categories ALTER COLUMN category_id DROP DEFAULT;
DROP VIEW public.vw_active_geofence_metrics;
DROP TABLE public.users;
DROP SEQUENCE public.system_audit_logs_audit_id_seq;
DROP TABLE public.system_audit_logs;
DROP SEQUENCE public.spatial_logs_log_id_seq;
DROP TABLE public.spatial_logs;
DROP SEQUENCE public.roles_role_id_seq;
DROP TABLE public.roles;
DROP TABLE public.privacy_budgets;
DROP TABLE public.geofences;
DROP SEQUENCE public.geofence_categories_category_id_seq;
DROP TABLE public.geofence_categories;
DROP TABLE public.audit_reports;
DROP PROCEDURE public.sp_generate_privacy_audit(IN p_geofence_id uuid, IN p_epsilon double precision);
DROP FUNCTION public.fn_log_user_registration();
DROP EXTENSION postgis_topology;
DROP EXTENSION postgis_tiger_geocoder;
DROP EXTENSION postgis;
DROP EXTENSION fuzzystrmatch;
DROP SCHEMA topology;
DROP SCHEMA tiger_data;
DROP SCHEMA tiger;
--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO postgres;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO postgres;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO postgres;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: fn_log_user_registration(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_log_user_registration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO system_audit_logs (user_id, action_performed) VALUES (NEW.user_id, 'NEW_USER_REGISTERED');
    RETURN NEW;
END; $$;


ALTER FUNCTION public.fn_log_user_registration() OWNER TO postgres;

--
-- Name: sp_generate_privacy_audit(uuid, double precision); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.sp_generate_privacy_audit(IN p_geofence_id uuid, IN p_epsilon double precision)
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


ALTER PROCEDURE public.sp_generate_privacy_audit(IN p_geofence_id uuid, IN p_epsilon double precision) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_reports (
    report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    geofence_id uuid,
    true_count integer NOT NULL,
    laplacian_noise double precision NOT NULL,
    reported_count integer NOT NULL,
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_reports OWNER TO postgres;

--
-- Name: geofence_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.geofence_categories (
    category_id integer NOT NULL,
    category_name character varying(50) NOT NULL,
    risk_level character varying(20) DEFAULT 'MEDIUM'::character varying,
    CONSTRAINT geofence_categories_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[])))
);


ALTER TABLE public.geofence_categories OWNER TO postgres;

--
-- Name: geofence_categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.geofence_categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.geofence_categories_category_id_seq OWNER TO postgres;

--
-- Name: geofence_categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.geofence_categories_category_id_seq OWNED BY public.geofence_categories.category_id;


--
-- Name: geofences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.geofences (
    geofence_id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_name character varying(100) NOT NULL,
    category_id integer,
    boundary_polygon public.geometry(MultiPolygon,4326) NOT NULL,
    created_by uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.geofences OWNER TO postgres;

--
-- Name: privacy_budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.privacy_budgets (
    budget_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    epsilon_value double precision DEFAULT 1.0 NOT NULL,
    remaining_budget double precision DEFAULT 10.0 NOT NULL,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT privacy_budgets_epsilon_value_check CHECK ((epsilon_value > (0)::double precision))
);


ALTER TABLE public.privacy_budgets OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    role_id integer NOT NULL,
    role_name character varying(30) NOT NULL,
    description text,
    CONSTRAINT roles_role_name_check CHECK (((role_name)::text = ANY ((ARRAY['ADMIN'::character varying, 'AUDITOR'::character varying, 'DRIVER'::character varying])::text[])))
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_role_id_seq OWNER TO postgres;

--
-- Name: roles_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_role_id_seq OWNED BY public.roles.role_id;


--
-- Name: spatial_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.spatial_logs (
    log_id bigint NOT NULL,
    user_id uuid,
    masked_geohash character varying(12) NOT NULL,
    recorded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    raw_lat double precision,
    raw_lon double precision
);


ALTER TABLE public.spatial_logs OWNER TO postgres;

--
-- Name: spatial_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.spatial_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.spatial_logs_log_id_seq OWNER TO postgres;

--
-- Name: spatial_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.spatial_logs_log_id_seq OWNED BY public.spatial_logs.log_id;


--
-- Name: system_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_audit_logs (
    audit_id bigint NOT NULL,
    user_id uuid,
    action_performed character varying(100) NOT NULL,
    ip_address character varying(45),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_audit_logs OWNER TO postgres;

--
-- Name: system_audit_logs_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_audit_logs_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_audit_logs_audit_id_seq OWNER TO postgres;

--
-- Name: system_audit_logs_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_audit_logs_audit_id_seq OWNED BY public.system_audit_logs.audit_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vw_active_geofence_metrics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_active_geofence_metrics AS
 SELECT g.geofence_id,
    g.zone_name,
    c.category_name,
    c.risk_level,
    count(r.report_id) AS total_audits
   FROM ((public.geofences g
     LEFT JOIN public.geofence_categories c ON ((g.category_id = c.category_id)))
     LEFT JOIN public.audit_reports r ON ((g.geofence_id = r.geofence_id)))
  WHERE (g.is_active = true)
  GROUP BY g.geofence_id, g.zone_name, c.category_name, c.risk_level;


ALTER VIEW public.vw_active_geofence_metrics OWNER TO postgres;

--
-- Name: geofence_categories category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofence_categories ALTER COLUMN category_id SET DEFAULT nextval('public.geofence_categories_category_id_seq'::regclass);


--
-- Name: roles role_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN role_id SET DEFAULT nextval('public.roles_role_id_seq'::regclass);


--
-- Name: spatial_logs log_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spatial_logs ALTER COLUMN log_id SET DEFAULT nextval('public.spatial_logs_log_id_seq'::regclass);


--
-- Name: system_audit_logs audit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_audit_logs ALTER COLUMN audit_id SET DEFAULT nextval('public.system_audit_logs_audit_id_seq'::regclass);


--
-- Data for Name: audit_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_reports (report_id, geofence_id, true_count, laplacian_noise, reported_count, generated_at) FROM stdin;
\.


--
-- Data for Name: geofence_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.geofence_categories (category_id, category_name, risk_level) FROM stdin;
\.


--
-- Data for Name: geofences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.geofences (geofence_id, zone_name, category_id, boundary_polygon, created_by, is_active, created_at) FROM stdin;
11111111-1111-1111-1111-111111111111	Koramangala Logistics Hub	\N	0106000020E610000001000000010300000001000000050000008FC2F5285C6753404260E5D022DB2940713D0AD7A36853404260E5D022DB2940713D0AD7A3685340FCA9F1D24DE229408FC2F5285C675340FCA9F1D24DE229408FC2F5285C6753404260E5D022DB2940	\N	t	2026-09-22 16:18:35.265828+00
22222222-2222-2222-2222-222222222222	Indiranagar Express Zone	\N	0106000020E61000000100000001030000000100000005000000B81E85EB51685340713D0AD7A3F029409A99999999695340713D0AD7A3F029409A99999999695340B81E85EB51F82940B81E85EB51685340B81E85EB51F82940B81E85EB51685340713D0AD7A3F02940	\N	t	2026-09-22 16:18:35.265828+00
\.


--
-- Data for Name: privacy_budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.privacy_budgets (budget_id, user_id, epsilon_value, remaining_budget, last_updated) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (role_id, role_name, description) FROM stdin;
1	ADMIN	System Administrator
2	AUDITOR	Privacy Compliance Auditor
3	DRIVER	Delivery Partner / Field Operator
\.


--
-- Data for Name: spatial_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_logs (log_id, user_id, masked_geohash, recorded_at, raw_lat, raw_lon) FROM stdin;
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: system_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_audit_logs (audit_id, user_id, action_performed, ip_address, "timestamp") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, full_name, email, password_hash, role_id, created_at) FROM stdin;
\.


--
-- Data for Name: geocode_settings; Type: TABLE DATA; Schema: tiger; Owner: postgres
--

COPY tiger.geocode_settings (name, setting, unit, category, short_desc) FROM stdin;
\.


--
-- Data for Name: pagc_gaz; Type: TABLE DATA; Schema: tiger; Owner: postgres
--

COPY tiger.pagc_gaz (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_lex; Type: TABLE DATA; Schema: tiger; Owner: postgres
--

COPY tiger.pagc_lex (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_rules; Type: TABLE DATA; Schema: tiger; Owner: postgres
--

COPY tiger.pagc_rules (id, rule, is_custom) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: topology; Owner: postgres
--

COPY topology.topology (id, name, srid, "precision", hasz) FROM stdin;
\.


--
-- Data for Name: layer; Type: TABLE DATA; Schema: topology; Owner: postgres
--

COPY topology.layer (topology_id, layer_id, schema_name, table_name, feature_column, feature_type, level, child_id) FROM stdin;
\.


--
-- Name: geofence_categories_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.geofence_categories_category_id_seq', 1, false);


--
-- Name: roles_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_role_id_seq', 3, true);


--
-- Name: spatial_logs_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.spatial_logs_log_id_seq', 1, false);


--
-- Name: system_audit_logs_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_audit_logs_audit_id_seq', 1, false);


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: postgres
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- Name: audit_reports audit_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_reports
    ADD CONSTRAINT audit_reports_pkey PRIMARY KEY (report_id);


--
-- Name: geofence_categories geofence_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofence_categories
    ADD CONSTRAINT geofence_categories_pkey PRIMARY KEY (category_id);


--
-- Name: geofences geofences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofences
    ADD CONSTRAINT geofences_pkey PRIMARY KEY (geofence_id);


--
-- Name: privacy_budgets privacy_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.privacy_budgets
    ADD CONSTRAINT privacy_budgets_pkey PRIMARY KEY (budget_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: spatial_logs spatial_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spatial_logs
    ADD CONSTRAINT spatial_logs_pkey PRIMARY KEY (log_id);


--
-- Name: system_audit_logs system_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_pkey PRIMARY KEY (audit_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_geofences_gist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_geofences_gist ON public.geofences USING gist (boundary_polygon);


--
-- Name: idx_spatial_logs_geohash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_spatial_logs_geohash ON public.spatial_logs USING btree (masked_geohash);


--
-- Name: users trg_after_user_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_after_user_insert AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_log_user_registration();


--
-- Name: audit_reports audit_reports_geofence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_reports
    ADD CONSTRAINT audit_reports_geofence_id_fkey FOREIGN KEY (geofence_id) REFERENCES public.geofences(geofence_id) ON DELETE CASCADE;


--
-- Name: geofences geofences_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofences
    ADD CONSTRAINT geofences_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.geofence_categories(category_id);


--
-- Name: geofences geofences_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofences
    ADD CONSTRAINT geofences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: privacy_budgets privacy_budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.privacy_budgets
    ADD CONSTRAINT privacy_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: spatial_logs spatial_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spatial_logs
    ADD CONSTRAINT spatial_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: system_audit_logs system_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

