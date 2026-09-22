import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { ShieldAlert, Radio, Activity, Database, RefreshCw, Zap, Lock, Key, EyeOff, Trash2 } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

const GEOFENCES = [
  {
    name: 'Koramangala Logistics Hub',
    color: '#3B82F6',
    bounds: [
      [12.9280, 77.6150], [12.9280, 77.6350], [12.9420, 77.6350], [12.9420, 77.6150]
    ]
  },
  {
    name: 'Indiranagar Express Zone',
    color: '#10B981',
    bounds: [
      [12.9700, 77.6300], [12.9700, 77.6500], [12.9850, 77.6500], [12.9850, 77.6300]
    ]
  }
];

function decodeGeohash(geohash) {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latInterval = [-90.0, 90.0];
  let lonInterval = [-180.0, 180.0];
  let isEven = true;

  for (let i = 0; i < geohash.length; i++) {
    const cd = base32.indexOf(geohash[i]);
    for (let j = 4; j >= 0; j--) {
      const mask = 1 << j;
      if (isEven) {
        const mid = (lonInterval[0] + lonInterval[1]) / 2;
        if ((cd & mask) !== 0) lonInterval[0] = mid; else lonInterval[1] = mid;
      } else {
        const mid = (latInterval[0] + latInterval[1]) / 2;
        if ((cd & mask) !== 0) latInterval[0] = mid; else latInterval[1] = mid;
      }
      isEven = !isEven;
    }
  }
  return [(latInterval[0] + latInterval[1]) / 2, (lonInterval[0] + lonInterval[1]) / 2];
}

export default function App() {
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastAudit, setLastAudit] = useState(null);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/spatial-logs`);
      setLogs(res.data.data);
    } catch (err) {
      console.error('Failed to fetch spatial logs:', err);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/audit-reports`);
      setReports(res.data.data);
    } catch (err) {
      console.error('Failed to fetch audit reports:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchReports();
    axios.post(`${API_BASE}/seed-geofences`).catch(() => { });
  }, []);

  const handleSimulatePings = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/simulate-pings?count=15`);
      await fetchLogs();
    } catch (err) {
      alert('Error simulating pings');
    }
    setLoading(false);
  };

  const handleTriggerAudit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/trigger-audit?epsilon=1.5`);
      setLastAudit(res.data);
      await fetchReports();
    } catch (err) {
      alert('Ensure geofences are seeded and pings exist before triggering audit');
    }
    setLoading(false);
  };

  const handleResetPings = async () => {
    if (!window.confirm("Are you sure you want to clear all driver pings and audit reports?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/reset-pings`);
      setLastAudit(null);
      await fetchLogs();
      await fetchReports();
    } catch (err) {
      alert('Failed to reset pings');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <ShieldAlert color="#60A5FA" size={28} />
          <div>
            <h1 style={styles.title}>CryptoSpatial-DB Engine</h1>
            <p style={styles.subtitle}>Privacy-Preserving Geospatial Auditing • Context-Aware Geo-Indistinguishability</p>
          </div>
        </div>
        <div style={styles.statusBadge}>
          <span style={styles.statusDot}></span>
          <span>SYSTEM ACTIVE (PostGIS R-Tree GiST)</span>
        </div>
      </header>

      {/* TOP WORKSPACE: MAP & CONTROLS */}
      <div style={styles.mainGrid}>
        <div style={styles.sidebar}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}><Zap size={18} /> Simulation Controls</h3>
            <button onClick={handleSimulatePings} disabled={loading} style={styles.btnPrimary}>
              <Radio size={16} /> Simulate 15 Driver Pings
            </button>
            <button onClick={handleTriggerAudit} disabled={loading} style={styles.btnDanger}>
              <ShieldAlert size={16} /> Trigger Privacy Noise Audit
            </button>
            <button onClick={fetchLogs} style={styles.btnSecondary}>
              <RefreshCw size={16} /> Refresh Telemetry
            </button>
            <button onClick={handleResetPings} disabled={loading} style={styles.btnOutlineDanger}>
              <Trash2 size={16} /> Reset Driver Pings
            </button>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Total Ingested Pings</p>
              <h2 style={styles.statValue}>{logs.length}</h2>
            </div>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Active Geofences</p>
              <h2 style={styles.statValue}>2</h2>
            </div>
          </div>

          {lastAudit && (
            <div style={styles.auditResultCard}>
              <h4 style={styles.auditTitle}><Activity size={16} /> Audit Query Output</h4>
              <p style={styles.auditText}><b>Target Zone:</b> {lastAudit.geofence_zone}</p>
              <div style={styles.noiseComparison}>
                <div>
                  <span style={styles.badgeLabel}>True Count</span>
                  <p style={styles.trueCount}>{lastAudit.true_count}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.badgeLabel}>Perturbed Audit Output</span>
                  <p style={styles.noisyCount}>{lastAudit.reported_count}</p>
                </div>
              </div>
              <p style={styles.noiseDetail}>
                Added Laplace Noise: <b>{lastAudit.laplacian_noise.toFixed(2)}</b> (ε = 1.5)
              </p>
            </div>
          )}
        </div>

        <div style={styles.mapContainer}>
          <MapContainer center={[12.9550, 77.6320]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {GEOFENCES.map((geo, idx) => (
              <Polygon key={idx} positions={geo.bounds} pathOptions={{ color: geo.color, fillColor: geo.color, fillOpacity: 0.2, weight: 2 }}>
                <Popup><b>{geo.name}</b></Popup>
              </Polygon>
            ))}
            {logs.map((log) => {
              const coords = log.raw_lat && log.raw_lon ? [log.raw_lat, log.raw_lon] : decodeGeohash(log.masked_geohash);
              return (
                <CircleMarker key={log.log_id} center={coords} radius={6} pathOptions={{ color: '#60A5FA', fillColor: '#3B82F6', fillOpacity: 0.8 }}>
                  <Popup>
                    <b>Geohash:</b> {log.masked_geohash}<br />
                    <b>Raw Lat:</b> {log.raw_lat || 'Masked'}<br />
                    <b>Raw Lon:</b> {log.raw_lon || 'Masked'}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* LOWER WORKSPACE: RAW VS ENCRYPTED INSPECTION MATRIX */}
      <div style={styles.bottomSection}>
        {/* ENCRYPTION METHODOLOGY EXPLANATION CARD */}
        <div style={styles.methodCard}>
          <h3 style={styles.methodTitle}><Key size={18} color="#60A5FA" /> Applied Obfuscation & Privacy Architecture</h3>
          <div style={styles.methodGrid}>
            <div style={styles.methodBox}>
              <h4 style={styles.boxTitle}><Lock size={14} /> 1. Spatial Geohashing (Base32)</h4>
              <p style={styles.boxDesc}>
                Raw GPS coordinates <b>(Lat, Lon)</b> are instantly converted into a 7-character Base32 spatial code block, discarding pinpoint street level accuracy while retaining neighborhood grid spatial proximity.
              </p>
            </div>
            <div style={styles.methodBox}>
              <h4 style={styles.boxTitle}><EyeOff size={14} /> 2. 2D Planar Laplace Noise Injection</h4>
              <p style={styles.boxDesc}>
                During audit reporting, PostGIS adds differential noise following a continuous 2D Laplace distribution <b>(ε = 1.5)</b>. This satisfies <b>ε-Geo-Indistinguishability</b>, rendering trajectory tracking mathematically impossible.
              </p>
            </div>
            <div style={styles.methodBox}>
              <h4 style={styles.boxTitle}><Database size={14} /> 3. PostGIS R-Tree (GiST) Spatial Index</h4>
              <p style={styles.boxDesc}>
                Boundary evaluations are computed in <b>O(log N)</b> time using PostGIS <code>ST_Contains</code> over spatial bounding boxes directly on the encoded spatial representations.
              </p>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE TABLE */}
        <div style={styles.tableCard}>
          <h3 style={styles.cardTitle}><EyeOff size={18} /> Live Ingested Location Transformation Matrix</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ping ID</th>
                  <th style={styles.th}>Original Raw Latitude</th>
                  <th style={styles.th}>Original Raw Longitude</th>
                  <th style={styles.th}>Encrypted / Masked Geohash</th>
                  <th style={styles.th}>Applied Protection Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={styles.emptyTd}>No driver pings ingested yet. Click 'Simulate 15 Driver Pings' above.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.log_id} style={styles.tr}>
                      <td style={styles.tdMonospace}>#{log.log_id}</td>
                      <td style={styles.tdRaw}>{log.raw_lat ? log.raw_lat.toFixed(6) : 'Hidden'}° N</td>
                      <td style={styles.tdRaw}>{log.raw_lon ? log.raw_lon.toFixed(6) : 'Hidden'}° E</td>
                      <td style={styles.tdEncrypted}><code>{log.masked_geohash}</code></td>
                      <td style={styles.tdPill}>
                        <span style={styles.pillActive}>Masked & Differential Privacy Protected</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// STYLES
const styles = {
  container: { backgroundColor: '#0B0F17', color: '#F3F4F6', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', backgroundColor: '#111827', borderBottom: '1px solid #1F2937' },
  brand: { display: 'flex', alignItems: 'center', gap: '14px' },
  title: { fontSize: '20px', fontWeight: '700', margin: 0, color: '#F9FAFB' },
  subtitle: { fontSize: '12px', color: '#9CA3AF', margin: 0 },
  statusBadge: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#064E3B', color: '#34D399', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  statusDot: { width: '8px', height: '8px', backgroundColor: '#10B981', borderRadius: '50%' },
  mainGrid: { display: 'grid', gridTemplateColumns: '360px 1fr', height: '480px', borderBottom: '1px solid #1F2937' },
  sidebar: { backgroundColor: '#111827', padding: '16px', borderRight: '1px solid #1F2937', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { backgroundColor: '#1F2937', padding: '14px', borderRadius: '10px', border: '1px solid #374151' },
  cardTitle: { fontSize: '14px', fontWeight: '600', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#60A5FA' },
  btnPrimary: { width: '100%', padding: '9px', backgroundColor: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnDanger: { width: '100%', padding: '9px', backgroundColor: '#DC2626', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnSecondary: { width: '100%', padding: '8px', backgroundColor: '#374151', color: '#D1D5DB', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnOutlineDanger: { width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#F87171', border: '1px solid #EF4444', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  statBox: { backgroundColor: '#1F2937', padding: '10px', borderRadius: '8px', border: '1px solid #374151' },
  statLabel: { fontSize: '11px', color: '#9CA3AF', margin: 0 },
  statValue: { fontSize: '20px', fontWeight: '700', margin: '2px 0 0 0', color: '#F3F4F6' },
  auditResultCard: { backgroundColor: '#1E1B4B', padding: '12px', borderRadius: '10px', border: '1px solid #4338CA' },
  auditTitle: { fontSize: '12px', color: '#A5B4FC', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' },
  auditText: { fontSize: '11px', margin: '0 0 8px 0', color: '#E0E7FF' },
  noiseComparison: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  badgeLabel: { fontSize: '10px', color: '#818CF8', textTransform: 'uppercase' },
  trueCount: { fontSize: '16px', fontWeight: '700', color: '#F3F4F6', margin: 0 },
  noisyCount: { fontSize: '16px', fontWeight: '700', color: '#34D399', margin: 0 },
  noiseDetail: { fontSize: '10px', color: '#C7D2FE', margin: 0, borderTop: '1px solid #3730A3', paddingTop: '4px' },
  mapContainer: { height: '100%', width: '100%' },
  bottomSection: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' },
  methodCard: { backgroundColor: '#111827', padding: '18px', borderRadius: '10px', border: '1px solid #1F2937' },
  methodTitle: { fontSize: '15px', fontWeight: '600', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#F3F4F6' },
  methodGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' },
  methodBox: { backgroundColor: '#1F2937', padding: '12px', borderRadius: '8px', border: '1px solid #374151' },
  boxTitle: { fontSize: '12px', color: '#60A5FA', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' },
  boxDesc: { fontSize: '11px', color: '#9CA3AF', margin: 0, lineHeight: '1.4' },
  tableCard: { backgroundColor: '#111827', padding: '18px', borderRadius: '10px', border: '1px solid #1F2937' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' },
  th: { padding: '10px 14px', backgroundColor: '#1F2937', color: '#9CA3AF', borderBottom: '1px solid #374151', fontWeight: '600' },
  tr: { borderBottom: '1px solid #1F2937' },
  tdMonospace: { padding: '10px 14px', fontFamily: 'monospace', color: '#9CA3AF' },
  tdRaw: { padding: '10px 14px', fontFamily: 'monospace', color: '#F87171' },
  tdEncrypted: { padding: '10px 14px', fontFamily: 'monospace', color: '#60A5FA', fontWeight: '600' },
  tdPill: { padding: '10px 14px' },
  pillActive: { backgroundColor: '#064E3B', color: '#34D399', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: '600' },
  emptyTd: { padding: '20px', textAlign: 'center', color: '#6B7280' }
};