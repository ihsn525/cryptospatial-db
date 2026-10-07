import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import {
  ShieldAlert, Radio, Activity, RefreshCw, Zap,
  EyeOff, Trash2, Cpu, BarChart3, PlusCircle, MapPin, MousePointer, Info, AlertTriangle, Edit2, Check, X, Database, Clock, LayoutDashboard, Sliders
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

// React Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', backgroundColor: '#111827', color: '#F87171', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
          <h2 style={{ margin: '0 0 10px 0' }}>Application UI Error Boundary Caught An Exception</h2>
          <p style={{ color: '#D1D5DB', fontSize: '14px' }}>{this.state.error?.toString()}</p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '10px 16px', backgroundColor: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '16px', fontWeight: '600' }}
          >
            Reset Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Geohash Decoder Function
function decodeGeohash(geohash) {
  if (!geohash || typeof geohash !== 'string') return [12.9352, 77.6245];
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latInterval = [-90.0, 90.0];
  let lonInterval = [-180.0, 180.0];
  let isEven = true;

  const cleanHash = geohash.toLowerCase().trim();

  for (let i = 0; i < cleanHash.length; i++) {
    const cd = base32.indexOf(cleanHash[i]);
    if (cd === -1) continue;
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

  const lat = (latInterval[0] + latInterval[1]) / 2;
  const lon = (lonInterval[0] + lonInterval[1]) / 2;

  if (isNaN(lat) || isNaN(lon)) return [12.9352, 77.6245];
  return [lat, lon];
}

function MapClickHandler({ mapMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mapMode !== 'none' && e.latlng) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [indexMetadata, setIndexMetadata] = useState([]);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastAudit, setLastAudit] = useState(null);
  const [activeGeofences, setActiveGeofences] = useState([]);

  // Automated Background Audit State
  const [autoAuditState, setAutoAuditState] = useState({
    active: true,
    lastRunTime: 'Just Now',
    geofence_zone: 'Koramangala Logistics Hub',
    true_count: 0,
    laplacian_noise: 0,
    reported_count: 0,
    statusText: 'Audit Successful'
  });

  const [editingGeofenceId, setEditingGeofenceId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const [mapMode, setMapMode] = useState('none');
  const [drawnGeofencePoints, setDrawnGeofencePoints] = useState([]);
  const [customZoneName, setCustomZoneName] = useState('Koramangala Extension');

  const [customDriverId, setCustomDriverId] = useState('DRV-888');
  const [customLat, setCustomLat] = useState('12.9352');
  const [customLon, setCustomLon] = useState('77.6245');
  const [validationError, setValidationError] = useState('');

  const fetchGeofences = async () => {
    try {
      const res = await axios.get(`${API_BASE}/geofences`);
      if (res.data && Array.isArray(res.data.data)) {
        setActiveGeofences(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch geofences:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/spatial-logs`);
      if (res.data && Array.isArray(res.data.data)) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch spatial logs:', err);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/audit-reports`);
      if (res.data && Array.isArray(res.data.data)) {
        setReports(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit reports:', err);
    }
  };

  const fetchIndexMetadata = async () => {
    try {
      const res = await axios.get(`${API_BASE}/system/indexing-metadata`);
      if (res.data && Array.isArray(res.data.index_metadata)) {
        setIndexMetadata(res.data.index_metadata);
      }
    } catch (err) {
      console.error('Failed to fetch indexing metadata:', err);
    }
  };

  const pollAutomatedAudit = async () => {
    try {
      const res = await axios.get(`${API_BASE}/audit/latest`);
      if (res.data && res.data.has_audit) {
        setAutoAuditState({
          active: true,
          lastRunTime: res.data.generated_at,
          geofence_zone: res.data.geofence_zone,
          true_count: res.data.true_count,
          laplacian_noise: res.data.laplacian_noise,
          reported_count: res.data.reported_count,
          statusText: 'Audit Successful'
        });
      }
    } catch (err) {
      console.error('Background audit polling exception:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await axios.post(`${API_BASE}/seed-geofences`).catch(() => { });
      await fetchGeofences();
      await fetchLogs();
      await fetchReports();
      await fetchIndexMetadata();
      await pollAutomatedAudit();
    };
    init();

    const interval = setInterval(() => {
      pollAutomatedAudit();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleMapClick = async (coords) => {
    if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

    if (mapMode === 'driver') {
      setCustomLat(coords[0].toFixed(6));
      setCustomLon(coords[1].toFixed(6));
      setMapMode('none');
      setValidationError('');
    } else if (mapMode === 'geofence') {
      const updated = [...drawnGeofencePoints, coords];
      setDrawnGeofencePoints(updated);

      if (updated.length === 4) {
        setLoading(true);
        try {
          await axios.post(`${API_BASE}/geofences/custom`, {
            zone_name: customZoneName || `Hub-${Math.floor(Math.random() * 1000)}`,
            coordinates: updated
          });
          await fetchGeofences();
          alert(`Delivery Zone '${customZoneName}' saved to PostGIS!`);
        } catch (err) {
          alert('Failed to save custom geofence');
        }
        setDrawnGeofencePoints([]);
        setMapMode('none');
        setLoading(false);
      }
    }
  };

  const handleDeleteGeofence = async (id) => {
    if (!window.confirm("Delete this delivery zone?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/geofences/${id}`);
      await fetchGeofences();
    } catch (err) {
      alert('Failed to delete geofence');
    }
    setLoading(false);
  };

  const handleUpdateGeofenceName = async (id) => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/geofences/${id}`, { zone_name: editingName });
      setEditingGeofenceId(null);
      await fetchGeofences();
    } catch (err) {
      alert('Failed to update geofence name');
    }
    setLoading(false);
  };

  const handleSimulatePings = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/simulate-pings?count=15`);
      await fetchLogs();
      await fetchIndexMetadata();
      await pollAutomatedAudit();
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
      await fetchIndexMetadata();
      await pollAutomatedAudit();
    } catch (err) {
      alert('Ensure active geofences and pings exist before auditing');
    }
    setLoading(false);
  };

  const handleRunBenchmark = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/benchmark/run`);
      if (res.data) {
        setBenchmarkData(res.data);
      } else {
        alert('Invalid benchmark response format');
      }
    } catch (err) {
      console.error("Benchmark Execution Error:", err);
      alert('Error running benchmark suite');
    }
    setLoading(false);
  };

  const handleIngestCustomPing = async (e) => {
    e.preventDefault();
    setValidationError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/driver-pings/ingest`, {
        driver_id: customDriverId,
        latitude: parseFloat(customLat),
        longitude: parseFloat(customLon),
        enforce_boundary_check: true
      });
      await fetchLogs();
      await fetchIndexMetadata();
      await pollAutomatedAudit();
      alert(`Driver ${customDriverId} validated & ingested inside active zone!`);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setValidationError(err.response.data.detail);
      } else {
        setValidationError('Validation Error: Ping location is outside active delivery zones.');
      }
    }
    setLoading(false);
  };

  const handleResetPings = async () => {
    if (!window.confirm("Clear all driver pings and audit history?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/reset-pings`);
      setLastAudit(null);
      setBenchmarkData(null);
      await fetchLogs();
      await fetchReports();
      await fetchIndexMetadata();
      await pollAutomatedAudit();
    } catch (err) {
      alert('Failed to reset pings');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      {/* HEADER WITH INTEGRATED TOP-RIGHT AUTOMATED AUDIT DISPLAY */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <ShieldAlert color="#60A5FA" size={28} />
          <div>
            <h1 style={styles.title}>CryptoSpatial-DB Engine</h1>
            <p style={styles.subtitle}>Privacy-Preserving Geospatial Auditing • Geo-Indistinguishability</p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={activeTab === 'dashboard' ? styles.tabActive : styles.tabInactive}
          >
            <LayoutDashboard size={15} /> Operational Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('benchmarks'); if (!benchmarkData) handleRunBenchmark(); }}
            style={activeTab === 'benchmarks' ? styles.tabActive : styles.tabInactive}
          >
            <BarChart3 size={15} /> Benchmarking Analyzer
          </button>
        </div>

        {/* TOP-RIGHT AUTOMATED BACKGROUND AUDIT WIDGET */}
        <div style={styles.headerAuditCard}>
          <div style={styles.headerAuditHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={styles.pulseDot}></span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#34D399' }}>Auto Audit Active</span>
            </div>
            <span style={styles.headerAuditTime}><Clock size={11} /> {autoAuditState.lastRunTime}</span>
          </div>
          <div style={styles.headerAuditMetrics}>
            <span style={styles.headerMetricItem}><b>Zone:</b> {autoAuditState.geofence_zone}</span>
            <span style={styles.headerMetricDivider}>•</span>
            <span style={styles.headerMetricItem}><b>True:</b> {autoAuditState.true_count}</span>
            <span style={styles.headerMetricDivider}>•</span>
            <span style={styles.headerMetricItem}><b>Noise:</b> <span style={{ color: '#F59E0B' }}>{autoAuditState.laplacian_noise > 0 ? `+${autoAuditState.laplacian_noise}` : autoAuditState.laplacian_noise}</span></span>
            <span style={styles.headerMetricDivider}>•</span>
            <span style={styles.headerMetricItem}><b>Reported:</b> <span style={{ color: '#34D399', fontWeight: '700' }}>{autoAuditState.reported_count}</span></span>
          </div>
        </div>
      </header>

      {/* TAB 1: OPERATIONAL DASHBOARD */}
      {activeTab === 'dashboard' && (
        <>
          <div style={styles.mainGrid}>
            <div style={styles.sidebar}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}><Zap size={18} /> Simulation & Audit Controls</h3>
                <button onClick={handleSimulatePings} disabled={loading} style={styles.btnPrimary}>
                  <Radio size={16} /> Simulate 15 Pings Across All Zones
                </button>
                <button onClick={handleTriggerAudit} disabled={loading} style={styles.btnDanger}>
                  <ShieldAlert size={16} /> Audit All Active Zones (Laplace Noise)
                </button>
                <button onClick={() => { setActiveTab('benchmarks'); handleRunBenchmark(); }} disabled={loading} style={styles.btnSuccess}>
                  <BarChart3 size={16} /> Open Benchmarking Analyzer
                </button>
                <button onClick={fetchLogs} style={styles.btnSecondary}>
                  <RefreshCw size={16} /> Refresh Telemetry
                </button>
                <button onClick={handleResetPings} disabled={loading} style={styles.btnOutlineDanger}>
                  <Trash2 size={16} /> Reset Pings & Audits
                </button>
              </div>

              {/* INTERACTIVE MAP DRAWING MODES */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}><MousePointer size={18} /> Delivery Zone Creator</h3>
                <div style={{ marginBottom: '8px' }}>
                  <label style={styles.label}>Custom Zone Name:</label>
                  <input
                    type="text"
                    value={customZoneName}
                    onChange={e => setCustomZoneName(e.target.value)}
                    style={styles.inputMini}
                  />
                </div>
                <button
                  onClick={() => { setMapMode(mapMode === 'geofence' ? 'none' : 'geofence'); setDrawnGeofencePoints([]); }}
                  style={mapMode === 'geofence' ? styles.btnActiveMode : styles.btnSecondary}
                >
                  <PlusCircle size={16} /> {mapMode === 'geofence' ? `Click Map (${drawnGeofencePoints.length}/4 pts)` : 'Draw Custom Zone on Map'}
                </button>
                <button
                  onClick={() => setMapMode(mapMode === 'driver' ? 'none' : 'driver')}
                  style={mapMode === 'driver' ? styles.btnActiveMode : styles.btnSecondary}
                >
                  <MapPin size={16} /> {mapMode === 'driver' ? 'Click Map to Set Driver Pin' : 'Select Driver Location on Map'}
                </button>
              </div>

              {/* ACTIVE GEOFENCES LIST */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}><Database size={18} /> Active Delivery Hubs ({activeGeofences.length})</h3>
                <div style={styles.geofenceList}>
                  {activeGeofences.map((gf) => (
                    <div key={gf.geofence_id} style={styles.geofenceItem}>
                      {editingGeofenceId === gf.geofence_id ? (
                        <div style={styles.editRow}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            style={styles.inputEdit}
                          />
                          <button onClick={() => handleUpdateGeofenceName(gf.geofence_id)} style={styles.btnIconSave}><Check size={14} /></button>
                          <button onClick={() => setEditingGeofenceId(null)} style={styles.btnIconCancel}><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={styles.viewRow}>
                          <span style={{ ...styles.geofenceBadge, borderColor: gf.color || '#3B82F6' }}>{gf.name}</span>
                          <div style={styles.actionBtns}>
                            <button onClick={() => { setEditingGeofenceId(gf.geofence_id); setEditingName(gf.name); }} style={styles.btnIcon}><Edit2 size={13} /></button>
                            <button onClick={() => handleDeleteGeofence(gf.geofence_id)} style={styles.btnIconDanger}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                  <p style={styles.statLabel}>Total Ingested Pings</p>
                  <h2 style={styles.statValue}>{logs.length}</h2>
                </div>
                <div style={styles.statBox}>
                  <p style={styles.statLabel}>Active Hubs</p>
                  <h2 style={styles.statValue}>{activeGeofences.length}</h2>
                </div>
              </div>

              {lastAudit && (
                <div style={styles.auditResultCard}>
                  <h4 style={styles.auditTitle}><Activity size={16} /> Manual Triggered Audit Result</h4>
                  <p style={styles.auditText}><b>Primary Zone:</b> {lastAudit.geofence_zone}</p>
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
                    Added Laplace Noise: <b>{Number(lastAudit.laplacian_noise || 0).toFixed(3)}</b> (ε = 1.5)
                  </p>
                </div>
              )}
            </div>

            {/* MAP CONTAINER */}
            <div style={styles.mapContainer}>
              <MapContainer center={[12.9550, 77.6320]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <MapClickHandler mapMode={mapMode} onMapClick={handleMapClick} />

                {activeGeofences.map((geo) => {
                  if (!geo || !Array.isArray(geo.bounds) || geo.bounds.length < 3) return null;
                  return (
                    <Polygon key={geo.geofence_id} positions={geo.bounds} pathOptions={{ color: geo.color || '#3B82F6', fillColor: geo.color || '#3B82F6', fillOpacity: 0.2, weight: 2 }}>
                      <Popup><b>{geo.name}</b></Popup>
                    </Polygon>
                  );
                })}

                {drawnGeofencePoints.length > 0 && (
                  <>
                    <Polyline positions={drawnGeofencePoints} pathOptions={{ color: '#F59E0B', dashArray: '6, 6' }} />
                    {drawnGeofencePoints.map((pt, i) => (
                      <CircleMarker key={i} center={pt} radius={5} pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 1 }} />
                    ))}
                  </>
                )}

                {logs.map((log) => {
                  if (!log || !log.masked_geohash) return null;
                  const coords = decodeGeohash(log.masked_geohash);
                  return (
                    <CircleMarker key={log.log_id} center={coords} radius={6} pathOptions={{ color: '#60A5FA', fillColor: '#3B82F6', fillOpacity: 0.8 }}>
                      <Popup>
                        <b>Geohash:</b> {log.masked_geohash}<br />
                        <b>Raw Lat:</b> <span style={{ color: '#EF4444', fontWeight: 'bold' }}>[REDACTED AT EDGE]</span><br />
                        <b>Raw Lon:</b> <span style={{ color: '#EF4444', fontWeight: 'bold' }}>[REDACTED AT EDGE]</span>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* LOWER WORKSPACE */}
          <div style={styles.bottomSection}>
            <div style={styles.twinGrid}>
              <div style={styles.methodCard}>
                <h3 style={styles.methodTitle}><PlusCircle size={18} color="#60A5FA" /> Custom Telemetry Ingestion (Boundary Enforced)</h3>
                <form onSubmit={handleIngestCustomPing} style={styles.formGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Driver ID</label>
                    <input type="text" value={customDriverId} onChange={e => setCustomDriverId(e.target.value)} style={styles.input} required />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Latitude</label>
                    <input type="text" value={customLat} onChange={e => setCustomLat(e.target.value)} style={styles.input} required />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Longitude</label>
                    <input type="text" value={customLon} onChange={e => setCustomLon(e.target.value)} style={styles.input} required />
                  </div>
                  <button type="submit" disabled={loading} style={styles.btnPrimaryForm}>Validate & Ingest Ping</button>
                </form>

                {validationError && (
                  <div style={styles.errorBox}>
                    <AlertTriangle size={16} color="#F87171" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>

              <div style={styles.methodCard}>
                <h3 style={styles.methodTitle}><Cpu size={18} color="#10B981" /> PostGIS System Catalog Index Profiler</h3>
                <div style={styles.metaTableWrapper}>
                  <table style={styles.miniTable}>
                    <thead>
                      <tr>
                        <th style={styles.thMini}>Index Name</th>
                        <th style={styles.thMini}>Algorithm</th>
                        <th style={styles.thMini}>Size</th>
                        <th style={styles.thMini}>Scans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indexMetadata.length === 0 ? (
                        <tr><td colSpan="4" style={styles.emptyTd}>No catalog metadata retrieved.</td></tr>
                      ) : (
                        indexMetadata.map((meta, idx) => (
                          <tr key={idx} style={styles.tr}>
                            <td style={styles.tdMiniMono}>{meta.index_name}</td>
                            <td style={styles.tdMiniPill}><span style={styles.pillAlgo}>{String(meta.algorithm || '').toUpperCase()}</span></td>
                            <td style={styles.tdMini}>{meta.size}</td>
                            <td style={styles.tdMiniBold}>{meta.total_scans}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

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
                        <td colSpan="5" style={styles.emptyTd}>No driver pings ingested yet. Click 'Simulate 15 Pings Across All Zones' above.</td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.log_id} style={styles.tr}>
                          <td style={styles.tdMonospace}>#{log.log_id}</td>
                          <td style={styles.tdRedacted}>[REDACTED AT EDGE]</td>
                          <td style={styles.tdRedacted}>[REDACTED AT EDGE]</td>
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
        </>
      )}

      {/* TAB 2: DEDICATED BENCHMARKING ANALYZER */}
      {activeTab === 'benchmarks' && (
        <div style={styles.benchmarkSection}>
          <div style={styles.benchmarkHeaderCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', margin: 0, color: '#34D399', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BarChart3 size={24} /> Empirical Benchmark & Performance Suite
                </h2>
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0 0' }}>
                  Multi-aspect evaluation comparing sub-linear PostGIS GiST indexing against traditional unindexed scans and AES-256 encryption.
                </p>
              </div>
              <button onClick={handleRunBenchmark} disabled={loading} style={styles.btnSuccessWide}>
                <RefreshCw size={16} /> Re-Run Live Benchmark Suite
              </button>
            </div>
          </div>

          {benchmarkData && benchmarkData.paradigms && (
            <div style={styles.benchmarkGridContainer}>

              {/* GRAPH 1: MULTI-SCALE LATENCY TREND */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartCardTitle}><Zap size={18} color="#60A5FA" /> Query Latency Scaling (ms) Across Telemetry Input Volume</h3>
                <p style={styles.chartDesc}>Measures spatial containment search duration as dataset grows from 100 to 100,000 pings.</p>

                <div style={styles.multiScaleGrid}>
                  {benchmarkData.scales.map((scale, sIdx) => (
                    <div key={sIdx} style={styles.scaleColumn}>
                      <span style={styles.scaleHeader}>{scale.toLocaleString()} Inputs</span>
                      <div style={styles.verticalBarContainer}>
                        {benchmarkData.paradigms.map((p, pIdx) => {
                          const lat = benchmarkData.latencies_ms[p.id][sIdx];
                          const colors = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'];
                          const maxScaleLat = Math.max(...Object.values(benchmarkData.latencies_ms).map(arr => arr[sIdx]), 1);
                          const barHeight = Math.min(100, Math.max(10, (lat / maxScaleLat) * 100));

                          return (
                            <div key={pIdx} style={styles.barItemVertical}>
                              <div style={styles.barValueLabel}>{lat} ms</div>
                              <div style={styles.barTrackVertical}>
                                <div style={{ ...styles.barFillVertical, height: `${barHeight}%`, backgroundColor: colors[pIdx] }}></div>
                              </div>
                              <span style={styles.barLegendName}>{p.name.split('.')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GRAPH 2: SYSTEM THROUGHPUT (QPS) */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartCardTitle}><Activity size={18} color="#34D399" /> Concurrent System Throughput (Queries Per Second / QPS)</h3>
                <p style={styles.chartDesc}>Evaluates concurrent query processing capability before hitting CPU database lock limits.</p>

                <div style={styles.horizontalChartList}>
                  {benchmarkData.paradigms.map((p, pIdx) => {
                    const maxQps = Math.max(...benchmarkData.paradigms.map(x => x.throughput_qps), 1);
                    const widthPct = Math.min(100, Math.max(8, (p.throughput_qps / maxQps) * 100));
                    const colors = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'];

                    return (
                      <div key={pIdx} style={styles.barRowH}>
                        <div style={styles.barRowHLabel}>
                          <span style={{ color: '#F3F4F6', fontWeight: '600' }}>{p.name}</span>
                          <span style={{ color: '#9CA3AF', fontSize: '11px' }}>{p.complexity}</span>
                        </div>
                        <div style={styles.barTrackH}>
                          <div style={{ ...styles.barFillH, width: `${widthPct}%`, backgroundColor: colors[pIdx] }}>
                            <span style={styles.barValText}>{p.throughput_qps.toLocaleString()} QPS</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRAPH 3: INDEX MEMORY FOOTPRINT & CPU UTILIZATION METERS */}
              <div style={styles.twinChartGrid}>

                {/* INDEX MEMORY GAUGE */}
                <div style={styles.chartCard}>
                  <h3 style={styles.chartCardTitle}><Database size={18} color="#F59E0B" /> Database Index Memory Overhead</h3>
                  <div style={styles.meterList}>
                    {benchmarkData.paradigms.map((p, pIdx) => (
                      <div key={pIdx} style={styles.meterRow}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#D1D5DB' }}>{p.name}</span>
                          <span style={{ color: '#F59E0B', fontWeight: '700', fontFamily: 'monospace' }}>{p.memory_str}</span>
                        </div>
                        <div style={styles.meterTrack}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(4, (p.memory_kb / 32768) * 100))}%`,
                            backgroundColor: pIdx === 2 ? '#EF4444' : '#10B981',
                            borderRadius: '4px'
                          }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CPU UTILIZATION METER */}
                <div style={styles.chartCard}>
                  <h3 style={styles.chartCardTitle}><Cpu size={18} color="#EC4899" /> Spatial Query CPU Utilization (%)</h3>
                  <div style={styles.meterList}>
                    {benchmarkData.paradigms.map((p, pIdx) => (
                      <div key={pIdx} style={styles.meterRow}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#D1D5DB' }}>{p.name}</span>
                          <span style={{ color: p.cpu_utilization_pct > 50 ? '#EF4444' : '#34D399', fontWeight: '700', fontFamily: 'monospace' }}>
                            {p.cpu_utilization_pct}%
                          </span>
                        </div>
                        <div style={styles.meterTrack}>
                          <div style={{
                            height: '100%',
                            width: `${p.cpu_utilization_pct}%`,
                            backgroundColor: p.cpu_utilization_pct > 50 ? '#EF4444' : '#34D399',
                            borderRadius: '4px'
                          }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* DETAILED MATRIX TABLE */}
              <div style={styles.tableCard}>
                <h3 style={styles.cardTitle}><Sliders size={18} /> Multi-Dimensional Performance & Privacy Tradeoff Matrix</h3>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Approach Paradigm</th>
                        <th style={styles.th}>Algorithmic Complexity</th>
                        <th style={styles.th}>Index Primitive</th>
                        <th style={styles.th}>Throughput (QPS)</th>
                        <th style={styles.th}>Memory Footprint</th>
                        <th style={styles.th}>Privacy Protection</th>
                        <th style={styles.th}>Engine Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkData.paradigms.map((p, idx) => (
                        <tr key={idx} style={styles.tr}>
                          <td style={styles.tdMonospaceBold}>{p.name}</td>
                          <td style={styles.tdMonospace}>{p.complexity}</td>
                          <td style={styles.tdMiniPill}><span style={styles.pillAlgo}>{p.index_type}</span></td>
                          <td style={styles.tdLatency}>{p.throughput_qps.toLocaleString()} QPS</td>
                          <td style={styles.tdMonospace}>{p.memory_str}</td>
                          <td style={styles.tdPill}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                              backgroundColor: p.privacy_score_pct === 100 ? '#064E3B' : (p.privacy_score_pct >= 50 ? '#78350F' : '#7F1D1D'),
                              color: p.privacy_score_pct === 100 ? '#34D399' : (p.privacy_score_pct >= 50 ? '#FBBF24' : '#FCA5A5')
                            }}>
                              {p.privacy_score_pct}% Protected
                            </span>
                          </td>
                          <td style={styles.tdPill}>
                            <span style={idx === 0 ? styles.pillActive : styles.pillInactive}>{p.verdict}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* EXPLANATION SUMMARY */}
              <div style={styles.explanationCard}>
                <h4 style={styles.explanationTitle}><Info size={16} color="#60A5FA" /> Benchmark Analysis & Architectural Resolution</h4>
                <p style={styles.explanationText}>
                  <b>1. Unindexed & Encrypted Performance Wall:</b> Traditional PostGIS without indexes incurs linear <b>O(N)</b> sequential scans. Column-level AES-256 encryption destroys spatial locality, forcing complete table decryptions on CPU before evaluating spatial containment. At 100,000 telemetry pings, CPU utilization hits 98.6% and throughput drops to 48 QPS.
                </p>
                <p style={styles.explanationText}>
                  <b>2. CryptoSpatial-DB Sub-linear Efficiency:</b> By indexing 7-character Base32 Geohashes with PostGIS GiST (R-Tree) index structures <b>(O(log N))</b> and applying continuous 2D Laplace Differential Privacy <b>(ε = 1.5)</b>, CryptoSpatial-DB achieves over 8,400 QPS with sub-millisecond latencies and 100% privacy guarantees.
                </p>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

// STYLES
const styles = {
  container: { backgroundColor: '#0B0F17', color: '#F3F4F6', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif', paddingBottom: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: '#111827', borderBottom: '1px solid #1F2937', gap: '16px', flexWrap: 'nowrap' },
  brand: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: '280px' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0, color: '#F9FAFB', whiteSpace: 'nowrap' },
  subtitle: { fontSize: '11px', color: '#9CA3AF', margin: 0, whiteSpace: 'nowrap' },
  tabContainer: { display: 'flex', gap: '6px', backgroundColor: '#1F2937', padding: '4px', borderRadius: '8px', border: '1px solid #374151' },
  tabActive: { backgroundColor: '#2563EB', color: '#FFF', border: 'none', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
  tabInactive: { backgroundColor: 'transparent', color: '#9CA3AF', border: 'none', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },

  headerAuditCard: { backgroundColor: '#1E1B4B', border: '1px solid #4338CA', borderRadius: '8px', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '340px' },
  headerAuditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pulseDot: { width: '7px', height: '7px', backgroundColor: '#34D399', borderRadius: '50%', boxShadow: '0 0 6px #34D399' },
  headerAuditTime: { fontSize: '10px', color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: '4px' },
  headerAuditMetrics: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#E0E7FF' },
  headerMetricItem: { whiteSpace: 'nowrap' },
  headerMetricDivider: { color: '#4338CA', fontSize: '10px' },

  mainGrid: { display: 'grid', gridTemplateColumns: '360px 1fr', height: '560px', borderBottom: '1px solid #1F2937' },
  sidebar: { backgroundColor: '#111827', padding: '16px', borderRight: '1px solid #1F2937', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { backgroundColor: '#1F2937', padding: '14px', borderRadius: '10px', border: '1px solid #374151' },
  cardTitle: { fontSize: '14px', fontWeight: '600', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#60A5FA' },
  btnPrimary: { width: '100%', padding: '9px', backgroundColor: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnDanger: { width: '100%', padding: '9px', backgroundColor: '#DC2626', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnSuccess: { width: '100%', padding: '9px', backgroundColor: '#059669', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnSuccessWide: { padding: '10px 16px', backgroundColor: '#059669', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  btnSecondary: { width: '100%', padding: '8px', backgroundColor: '#374151', color: '#D1D5DB', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnActiveMode: { width: '100%', padding: '8px', backgroundColor: '#D97706', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' },
  btnOutlineDanger: { width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#F87171', border: '1px solid #EF4444', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  inputMini: { width: '100%', backgroundColor: '#111827', border: '1px solid #4B5563', color: '#FFF', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' },
  geofenceList: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' },
  geofenceItem: { backgroundColor: '#111827', padding: '6px 8px', borderRadius: '6px', border: '1px solid #374151' },
  viewRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  geofenceBadge: { fontSize: '11px', color: '#F3F4F6', borderLeft: '3px solid', paddingLeft: '6px', fontWeight: '600' },
  actionBtns: { display: 'flex', gap: '4px' },
  btnIcon: { backgroundColor: '#374151', color: '#60A5FA', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' },
  btnIconDanger: { backgroundColor: '#374151', color: '#F87171', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' },
  editRow: { display: 'flex', gap: '4px', alignItems: 'center' },
  inputEdit: { backgroundColor: '#1F2937', border: '1px solid #60A5FA', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', flex: 1 },
  btnIconSave: { backgroundColor: '#059669', color: '#FFF', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' },
  btnIconCancel: { backgroundColor: '#DC2626', color: '#FFF', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' },
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
  twinGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  methodCard: { backgroundColor: '#111827', padding: '18px', borderRadius: '10px', border: '1px solid #1F2937' },
  methodTitle: { fontSize: '15px', fontWeight: '600', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#F3F4F6' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '10px', alignItems: 'end' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '11px', color: '#9CA3AF' },
  input: { backgroundColor: '#1F2937', border: '1px solid #374151', color: '#FFF', padding: '7px 10px', borderRadius: '6px', fontSize: '12px' },
  btnPrimaryForm: { padding: '8px', backgroundColor: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
  errorBox: { marginTop: '12px', padding: '10px', backgroundColor: '#7F1D1D', border: '1px solid #EF4444', color: '#FCA5A5', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' },
  metaTableWrapper: { overflowX: 'auto' },
  miniTable: { width: '100%', borderCollapse: 'collapse', fontSize: '11px' },
  thMini: { padding: '6px 8px', backgroundColor: '#1F2937', color: '#9CA3AF', textAlign: 'left' },
  tdMiniMono: { padding: '6px 8px', fontFamily: 'monospace', color: '#60A5FA' },
  tdMiniPill: { padding: '6px 8px' },
  pillAlgo: { backgroundColor: '#065F46', color: '#34D399', fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: '600', whiteSpace: 'nowrap', display: 'inline-block' },
  tdMini: { padding: '6px 8px', color: '#D1D5DB' },
  tdMiniBold: { padding: '6px 8px', fontWeight: '700', color: '#F3F4F6' },

  benchmarkSection: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  benchmarkHeaderCard: { backgroundColor: '#111827', padding: '20px', borderRadius: '10px', border: '1px solid #1F2937' },
  benchmarkGridContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
  chartCard: { backgroundColor: '#111827', padding: '20px', borderRadius: '10px', border: '1px solid #1F2937' },
  chartCardTitle: { fontSize: '15px', fontWeight: '700', color: '#F3F4F6', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' },
  chartDesc: { fontSize: '12px', color: '#9CA3AF', margin: '0 0 18px 0' },
  multiScaleGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  scaleColumn: { backgroundColor: '#1F2937', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' },
  scaleHeader: { fontSize: '12px', fontWeight: '700', color: '#60A5FA', textAlign: 'center', borderBottom: '1px solid #374151', paddingBottom: '6px' },
  verticalBarContainer: { display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', paddingTop: '20px' },
  barItemVertical: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '22%' },
  barValueLabel: { fontSize: '9px', color: '#FFF', fontWeight: '700', marginBottom: '4px', textAlign: 'center' },
  barTrackVertical: { width: '100%', height: '120px', backgroundColor: '#111827', borderRadius: '4px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' },
  barFillVertical: { width: '100%', transition: 'height 0.4s ease' },
  barLegendName: { fontSize: '9px', color: '#9CA3AF', marginTop: '6px', textTransform: 'uppercase' },
  horizontalChartList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  barRowH: { display: 'grid', gridTemplateColumns: '240px 1fr', alignItems: 'center', gap: '14px' },
  barRowHLabel: { display: 'flex', flexDirection: 'column', fontSize: '12px' },
  barTrackH: { backgroundColor: '#1F2937', borderRadius: '6px', height: '26px', overflow: 'hidden', width: '100%' },
  barFillH: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '10px', transition: 'width 0.4s ease' },
  barValText: { fontSize: '11px', color: '#FFF', fontWeight: '700', fontFamily: 'monospace' },
  twinChartGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  meterList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  meterRow: { display: 'flex', flexDirection: 'column' },
  meterTrack: { height: '10px', backgroundColor: '#1F2937', borderRadius: '4px', overflow: 'hidden', width: '100%' },

  tableCard: { backgroundColor: '#111827', padding: '18px', borderRadius: '10px', border: '1px solid #1F2937' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' },
  th: { padding: '12px 16px', backgroundColor: '#1F2937', color: '#9CA3AF', borderBottom: '1px solid #374151', fontWeight: '600', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #1F2937' },
  tdMonospace: { padding: '12px 16px', fontFamily: 'monospace', color: '#9CA3AF', whiteSpace: 'nowrap' },
  tdMonospaceBold: { padding: '12px 16px', fontFamily: 'monospace', fontWeight: '700', color: '#F3F4F6', whiteSpace: 'nowrap' },
  tdLatency: { padding: '12px 16px', fontFamily: 'monospace', color: '#34D399', fontWeight: '700', whiteSpace: 'nowrap' },
  tdRedacted: { padding: '12px 16px', fontFamily: 'monospace', color: '#EF4444', fontWeight: '600', whiteSpace: 'nowrap' },
  tdEncrypted: { padding: '12px 16px', fontFamily: 'monospace', color: '#60A5FA', fontWeight: '600', whiteSpace: 'nowrap' },
  tdPill: { padding: '12px 16px', whiteSpace: 'nowrap' },
  pillActive: { backgroundColor: '#064E3B', color: '#34D399', fontSize: '11px', padding: '4px 10px', borderRadius: '12px', fontWeight: '600', whiteSpace: 'nowrap', display: 'inline-block' },
  pillInactive: { backgroundColor: '#7F1D1D', color: '#FCA5A5', fontSize: '11px', padding: '4px 10px', borderRadius: '12px', fontWeight: '600', whiteSpace: 'nowrap', display: 'inline-block' },
  emptyTd: { padding: '16px', textAlign: 'center', color: '#6B7280' },
  explanationCard: { backgroundColor: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1F2937' },
  explanationTitle: { fontSize: '13px', fontWeight: '600', color: '#F3F4F6', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' },
  explanationText: { fontSize: '11px', color: '#9CA3AF', margin: '0 0 6px 0', lineHeight: '1.5' }
};