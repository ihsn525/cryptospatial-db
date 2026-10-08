import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import {
  ShieldCheck, Key, Lock, PhoneCall,
  AlertTriangle, Terminal, RefreshCw, Eye,
  ChevronDown, ChevronUp, Sliders, X,
  Minimize2, Maximize2, MapPin, UserPlus, Wifi, WifiOff, Grid,
  Database, Play, Square, Pause, CheckCircle2
} from 'lucide-react';

const SDK_BASE = 'http://127.0.0.1:8000/v1/sdk';

// Calculate exact 153m x 153m Base32 Geohash Bounding Box [[latMin, lonMin], [latMax, lonMax]]
function decodeGeohashBounds(geohash) {
  if (!geohash || typeof geohash !== 'string') {
    return [[12.9345, 77.6240], [12.9358, 77.6252]];
  }
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
  return [[latInterval[0], lonInterval[0]], [latInterval[1], lonInterval[1]]];
}

// Generate a 153m x 153m Bounding Box around arbitrary Lat/Lon coordinates
function createPointBounds(coords) {
  const latDelta = 0.0007;
  const lonDelta = 0.0007;
  return [
    [coords[0] - latDelta, coords[1] - lonDelta],
    [coords[0] + latDelta, coords[1] + lonDelta]
  ];
}

function getGeohashCenter(bounds) {
  return [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2
  ];
}

// Smooth single-panning Map Recenter
function MapRecenter({ center }) {
  const map = useMap();
  const prevCenterRef = useRef(null);

  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      const prev = prevCenterRef.current;
      if (!prev || Math.abs(prev[0] - center[0]) > 0.0001 || Math.abs(prev[1] - center[1]) > 0.0001) {
        map.setView(center, map.getZoom(), { animate: true, duration: 0.8 });
        prevCenterRef.current = center;
      }
    }
  }, [center, map]);

  return null;
}

function MapClickHandler({ pickMode, onLocationPicked }) {
  useMapEvents({
    click(e) {
      if (pickMode !== 'none' && e.latlng) {
        onLocationPicked([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

async function fetchOSRMRoadRoute(start, end) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await axios.get(url);
    if (res.data && res.data.routes && res.data.routes[0]) {
      return res.data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }
  } catch (err) {
    console.warn("OSRM routing fallback", err);
  }
  const path = [];
  for (let i = 0; i <= 8; i++) {
    path.push([
      start[0] + (end[0] - start[0]) * (i / 8),
      start[1] + (end[1] - start[1]) * (i / 8)
    ]);
  }
  return path;
}

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [keyValidated, setKeyValidated] = useState(false);
  const [activeTab, setActiveTab] = useState('sdk');
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [cardMinimized, setCardMinimized] = useState(false);

  // Fleet & Driver State
  const [driverId, setDriverId] = useState('DRV-9042');
  const [driverName, setDriverName] = useState('Ramesh Kumar');
  const [vehicleDetails, setVehicleDetails] = useState('White Volkswagen Polo');

  // Dynamic Route Locations
  const [restaurantCoords, setRestaurantCoords] = useState([12.9352, 77.6245]);
  const [customerCoords, setCustomerCoords] = useState([12.9280, 77.6380]);
  const [pickMode, setPickMode] = useState('none');

  const [routePath, setRoutePath] = useState([[12.9352, 77.6245], [12.9280, 77.6380]]);
  const [privacyMode, setPrivacyMode] = useState('legacy');

  // Explicit Delivery Lifecycle: 'idle' | 'delivering' | 'paused' | 'completed'
  const [deliveryState, setDeliveryState] = useState('idle');
  const [simStep, setSimStep] = useState(0);
  const [proofToken, setProofToken] = useState(null);
  const [sdkLogs, setSdkLogs] = useState([]);

  const currentRawPos = routePath[simStep] || routePath[0];
  const [maskedGeohash, setMaskedGeohash] = useState('tdr1w67');

  const geohashTileBounds = decodeGeohashBounds(maskedGeohash);
  const tileCenterPos = getGeohashCenter(geohashTileBounds);

  const restaurantZoneBounds = createPointBounds(restaurantCoords);
  const customerZoneBounds = createPointBounds(customerCoords);

  useEffect(() => {
    if (!keyValidated && privacyMode === 'cryptospatial') {
      setPrivacyMode('legacy');
    }
  }, [keyValidated, privacyMode]);

  useEffect(() => {
    fetchOSRMRoadRoute(restaurantCoords, customerCoords).then(path => {
      setRoutePath(path);
      setSimStep(0);
      setDeliveryState('idle');
    });
  }, [restaurantCoords, customerCoords]);

  const handleConnectApiKey = async () => {
    if (!apiKey.trim()) {
      alert("Please enter a valid Middleware API Key (e.g., cs_live_...)");
      return;
    }
    try {
      const res = await axios.post(`${SDK_BASE}/telemetry/mask`, {
        driver_id: driverId,
        raw_latitude: restaurantCoords[0],
        raw_longitude: restaurantCoords[1],
        precision: 7
      }, {
        headers: { "X-API-Key": apiKey }
      });
      if (res.data && res.data.status === 'success') {
        setKeyValidated(true);
        setPrivacyMode('cryptospatial');
        addSdkLog('AUTH', 'API Key validated via SHA-256. CryptoSpatial Shield Unlocked!', '200 OK');
      }
    } catch (err) {
      alert("Invalid or Revoked API Key! Generate a key on Port 5173.");
      setKeyValidated(false);
    }
  };

  const handleTogglePrivacyMode = (targetMode) => {
    if (targetMode === 'cryptospatial' && !keyValidated) {
      alert("🔒 API Key Required!\n\nConnect an active CryptoSpatial API Key to unlock Zero-Trust Edge Shielding.");
      setShowControlPanel(true);
      setActiveTab('sdk');
      return;
    }
    setPrivacyMode(targetMode);
  };

  // Delivery Controls: Start, Pause, Stop
  const handleStartDelivery = () => {
    if (deliveryState === 'completed') {
      setSimStep(0);
    }
    setDeliveryState('delivering');
    addSdkLog('DELIVERY_START', `Delivery initiated for ${driverName} (${driverId})`, 'ACTIVE');
  };

  const handlePauseDelivery = () => {
    setDeliveryState('paused');
    addSdkLog('DELIVERY_PAUSE', `Delivery paused at step ${simStep + 1}/${routePath.length}`, 'PAUSED');
  };

  const handleStopDelivery = () => {
    setDeliveryState('idle');
    setSimStep(0);
    setProofToken(null);
    addSdkLog('DELIVERY_STOP', 'Delivery simulation stopped and reset to pickup hub.', 'RESET');
  };

  const handleUpdateDriver = async () => {
    if (!keyValidated) {
      alert("🔒 API Key Required!\n\nConnect an API key to sync driver fleet updates directly to the engine database.");
      setShowControlPanel(true);
      setActiveTab('sdk');
      return;
    }
    try {
      await axios.post(`${SDK_BASE}/telemetry/mask`, {
        driver_id: driverId,
        raw_latitude: currentRawPos[0],
        raw_longitude: currentRawPos[1],
        precision: 7
      }, {
        headers: { "X-API-Key": apiKey }
      });
      addSdkLog('FLEET_SYNC', `Driver metadata [${driverName} (${driverId})] synced to DB`, '200 OK');
      alert(`✓ Fleet metadata for ${driverName} (${driverId}) synced to central DB!`);
    } catch (err) {
      alert("Failed to sync driver details to backend.");
    }
  };

  const handleMapLocationPicked = async (coords) => {
    if (pickMode === 'restaurant') {
      setRestaurantCoords(coords);
      setPickMode('none');
    } else if (pickMode === 'customer') {
      setCustomerCoords(coords);
      setPickMode('none');
    }

    if (keyValidated) {
      try {
        await axios.post(`${SDK_BASE}/telemetry/mask`, {
          driver_id: driverId,
          raw_latitude: coords[0],
          raw_longitude: coords[1],
          precision: 7
        }, {
          headers: { "X-API-Key": apiKey }
        });
        addSdkLog('ROUTE_SYNC', `New route endpoint [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}] synced to DB`, '200 OK');
      } catch (err) { }
    }
  };

  const addSdkLog = (type, detail, status) => {
    const timestamp = new Date().toLocaleTimeString();
    setSdkLogs(prev => [{ id: Date.now(), timestamp, type, detail, status }, ...prev.slice(0, 9)]);
  };

  // Controlled Telemetry Simulation Loop
  useEffect(() => {
    if (deliveryState !== 'delivering') return;

    const interval = setInterval(async () => {
      setSimStep(prev => {
        if (prev >= routePath.length - 1) {
          setDeliveryState('completed');
          addSdkLog('DELIVERY_COMPLETE', `Order delivered to customer zone by ${driverId}`, 'ARRIVED');
          return prev;
        }

        const nextStep = prev + 1;
        const [nextLat, nextLon] = routePath[nextStep];

        if (privacyMode === 'cryptospatial' && keyValidated) {
          axios.post(`${SDK_BASE}/telemetry/mask`, {
            driver_id: driverId,
            raw_latitude: nextLat,
            raw_longitude: nextLon,
            precision: 7
          }, {
            headers: { "X-API-Key": apiKey }
          }).then(res => {
            if (res.data && res.data.masked_geohash) {
              setMaskedGeohash(res.data.masked_geohash);
              addSdkLog('SDK_MASK', `Edge Purge -> Masked Tile [${res.data.masked_geohash}]`, '200 OK');
            }
          }).catch(() => {
            setMaskedGeohash('tdr1w67');
          });
        } else {
          addSdkLog('LEGACY', `Raw GPS Expose [${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}]`, 'UNPROTECTED');
        }

        if (nextStep === routePath.length - 1 && keyValidated) {
          axios.post(`${SDK_BASE}/zone/proof-of-presence`, {
            driver_id: driverId,
            masked_geohash: maskedGeohash,
            geofence_id: "11111111-1111-1111-1111-111111111111"
          }, {
            headers: { "X-API-Key": apiKey }
          }).then(res => {
            if (res.data && res.data.proof_token) {
              setProofToken(res.data.proof_token);
              addSdkLog('ZK_PROOF', `Presence Verified -> [${res.data.proof_token}]`, '200 OK');
            }
          }).catch(() => { });
        }

        return nextStep;
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [deliveryState, privacyMode, apiKey, routePath, driverId, keyValidated, maskedGeohash]);

  const discretizedTilePath = routePath.map(pt => {
    const bounds = decodeGeohashBounds(maskedGeohash);
    return getGeohashCenter(bounds);
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#F8FAFC', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { width: 100vw; height: 100vh; overflow: hidden; background-color: #f8fafc; }
        .leaflet-container { width: 100% !important; height: 100% !important; z-index: 1; }
        .studio-input { color: #000000 !important; font-weight: 600 !important; background-color: #FFFFFF !important; }
        .studio-input::placeholder { color: #94A3B8 !important; font-weight: 400 !important; }
      `}</style>

      {/* 1. MAP CANVAS */}
      <MapContainer
        center={[12.9316, 77.6312]}
        zoom={15}
        zoomControl={false}
        style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapRecenter center={privacyMode === 'cryptospatial' ? tileCenterPos : currentRawPos} />
        <MapClickHandler pickMode={pickMode} onLocationPicked={handleMapLocationPicked} />

        {/* RESTAURANT PICKUP ZONE TILE */}
        <Rectangle
          bounds={restaurantZoneBounds}
          pathOptions={{ color: '#000000', fillColor: '#1E293B', fillOpacity: 0.25, weight: 2 }}
        >
          <Popup><b>🍔 Restaurant Pickup Spatial Zone</b><br />153m Protected Hub</Popup>
        </Rectangle>

        {/* CUSTOMER DROP-OFF ZONE TILE */}
        <Rectangle
          bounds={customerZoneBounds}
          pathOptions={{ color: '#06C167', fillColor: '#10B981', fillOpacity: 0.25, weight: 2 }}
        >
          <Popup><b>🏠 Customer Destination Spatial Zone</b><br />153m Protected Home Grid</Popup>
        </Rectangle>

        {privacyMode === 'legacy' ? (
          <>
            <Polyline positions={routePath} pathOptions={{ color: '#E11D48', weight: 6, opacity: 0.85, dashArray: '6, 8' }} />
            <Rectangle
              bounds={createPointBounds(currentRawPos)}
              pathOptions={{ color: '#E11D48', fillColor: '#F43F5E', fillOpacity: 0.5, weight: 2 }}
            >
              <Popup>
                <b style={{ color: '#E11D48' }}>Legacy Exposed GPS Location</b><br />
                <b>Driver:</b> {driverName} ({driverId})<br />
                <b>Lat:</b> {currentRawPos[0].toFixed(5)}<br />
                <b>Lon:</b> {currentRawPos[1].toFixed(5)}<br />
                <span style={{ color: '#DC2626', fontSize: '10px', fontWeight: 'bold' }}>⚠️ Raw coordinates exposed!</span>
              </Popup>
            </Rectangle>
          </>
        ) : (
          <>
            <Polyline positions={discretizedTilePath} pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.4, dashArray: '8, 12' }} />
            <Rectangle
              bounds={geohashTileBounds}
              pathOptions={{
                color: '#2563EB',
                fillColor: '#3B82F6',
                fillOpacity: 0.45,
                weight: 3
              }}
            >
              <Popup>
                <b style={{ color: '#2563EB' }}>CryptoSpatial 153m Driver Tile</b><br />
                <b>Geohash:</b> <code>{maskedGeohash}</code><br />
                <b>Grid Resolution:</b> 153m x 153m<br />
                <span style={{ color: '#059669', fontSize: '10px', fontWeight: 'bold' }}>✓ Zero Exact GPS Exposure</span>
              </Popup>
            </Rectangle>
          </>
        )}
      </MapContainer>

      {/* 2. HEADER BAR */}
      <header style={{
        position: 'absolute', top: '20px', left: '20px', right: '20px', zIndex: 1000,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none'
      }}>
        <div style={{
          pointerEvents: 'auto', backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0', padding: '6px 16px', borderRadius: '30px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ backgroundColor: '#000000', padding: '6px 14px', borderRadius: '20px', color: '#FFFFFF', fontWeight: '900', fontSize: '13px', letterSpacing: '0.5px' }}>
            UBER EATS
          </div>

          {keyValidated ? (
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #A7F3D0' }}>
              <Wifi size={13} color="#059669" /> LIVE DB SYNC: ACTIVE
            </span>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#D97706', backgroundColor: '#FEF3C7', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #FDE68A' }}>
              <WifiOff size={13} color="#D97706" /> API KEY REQUIRED FOR SHIELD & DB SYNC
            </span>
          )}
        </div>

        <div style={{
          pointerEvents: 'auto', backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0', padding: '5px 8px', borderRadius: '30px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          <button
            onClick={() => handleTogglePrivacyMode('legacy')}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              backgroundColor: privacyMode === 'legacy' ? '#FEF2F2' : 'transparent',
              color: privacyMode === 'legacy' ? '#DC2626' : '#64748B',
              fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Eye size={13} color={privacyMode === 'legacy' ? '#DC2626' : '#64748B'} /> Legacy GPS
          </button>

          <button
            onClick={() => handleTogglePrivacyMode('cryptospatial')}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              backgroundColor: privacyMode === 'cryptospatial' ? '#ECFDF5' : '#F1F5F9',
              color: privacyMode === 'cryptospatial' ? '#059669' : '#94A3B8',
              fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            {!keyValidated ? (
              <>
                <Lock size={13} color="#D97706" />
                <span>CryptoSpatial Shield (Locked)</span>
              </>
            ) : (
              <>
                <Grid size={14} color="#059669" />
                <span>CryptoSpatial Tile Corridor</span>
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => { setShowControlPanel(!showControlPanel); if (!showControlPanel) setCardMinimized(true); }}
          style={{
            pointerEvents: 'auto', backgroundColor: '#000000',
            border: 'none', color: '#FFFFFF', padding: '10px 20px', borderRadius: '30px',
            fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
          }}
        >
          <Sliders size={15} color="#06C167" />
          <span>Dispatch Studio</span>
          {showControlPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>

      {/* 3. DISPATCH CONTROL DRAWER */}
      {showControlPanel && (
        <div style={{
          position: 'absolute', top: '80px', left: '20px', right: '20px', zIndex: 1002,
          backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setActiveTab('sdk')}
                style={{
                  padding: '8px 16px', borderRadius: '12px', border: 'none',
                  backgroundColor: activeTab === 'sdk' ? '#000000' : '#F1F5F9',
                  color: activeTab === 'sdk' ? '#FFFFFF' : '#475569',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Key size={14} /> SDK & Middleware Auth
              </button>
              <button
                onClick={() => setActiveTab('driver')}
                style={{
                  padding: '8px 16px', borderRadius: '12px', border: 'none',
                  backgroundColor: activeTab === 'driver' ? '#000000' : '#F1F5F9',
                  color: activeTab === 'driver' ? '#FFFFFF' : '#475569',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <UserPlus size={14} /> Fleet Driver Manager {!keyValidated && '🔒'}
              </button>
              <button
                onClick={() => setActiveTab('locations')}
                style={{
                  padding: '8px 16px', borderRadius: '12px', border: 'none',
                  backgroundColor: activeTab === 'locations' ? '#000000' : '#F1F5F9',
                  color: activeTab === 'locations' ? '#FFFFFF' : '#475569',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <MapPin size={14} /> Road Location Picker {!keyValidated && '🔒'}
              </button>
            </div>
            <button onClick={() => setShowControlPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
              <X size={20} />
            </button>
          </div>

          {activeTab === 'sdk' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>Middleware API Key Auth</h4>
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px', backgroundColor: keyValidated ? '#DCFCE7' : '#FEE2E2', color: keyValidated ? '#15803D' : '#991B1B', fontWeight: 'bold' }}>
                    {keyValidated ? '✓ Connected' : '🔒 Disconnected'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="Paste API Key (cs_live_...)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="studio-input"
                    style={{ flex: 1, border: '1px solid #94A3B8', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                  <button onClick={handleConnectApiKey} style={{ backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    Connect Key
                  </button>
                </div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={16} /> Live SDK Telemetry Transmit Console
                </h4>
                <div style={{ backgroundColor: '#0F172A', borderRadius: '8px', padding: '10px', height: '90px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', color: '#F1F5F9' }}>
                  {sdkLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: log.type === 'SDK_MASK' ? '#34D399' : '#F87171' }}>
                      <span>[{log.timestamp}] <b>{log.type}:</b> {log.detail}</span>
                      <span style={{ color: '#38BDF8' }}>{log.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'driver' && (
            <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Driver ID</label>
                <input type="text" value={driverId} onChange={e => setDriverId(e.target.value)} className="studio-input" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #94A3B8', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Driver Name</label>
                <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} className="studio-input" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #94A3B8', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Vehicle & Model</label>
                <input type="text" value={vehicleDetails} onChange={e => setVehicleDetails(e.target.value)} className="studio-input" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #94A3B8', fontSize: '12px' }} />
              </div>
              <button onClick={handleUpdateDriver} style={{ backgroundColor: keyValidated ? '#06C167' : '#94A3B8', color: '#FFFFFF', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {keyValidated ? <Database size={14} /> : <Lock size={14} />}
                {keyValidated ? 'Sync Fleet Metadata to DB' : 'Key Required to Sync'}
              </button>
            </div>
          )}

          {activeTab === 'locations' && (
            <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button
                onClick={() => setPickMode(pickMode === 'restaurant' ? 'none' : 'restaurant')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: pickMode === 'restaurant' ? '#000000' : '#FFFFFF', color: pickMode === 'restaurant' ? '#FFFFFF' : '#0F172A', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <MapPin size={16} color={pickMode === 'restaurant' ? '#06C167' : '#2563EB'} />
                {pickMode === 'restaurant' ? 'Click Map for Pickup...' : 'Pick Pickup Zone on Map'}
              </button>

              <button
                onClick={() => setPickMode(pickMode === 'customer' ? 'none' : 'customer')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: pickMode === 'customer' ? '#000000' : '#FFFFFF', color: pickMode === 'customer' ? '#FFFFFF' : '#0F172A', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <MapPin size={16} color={pickMode === 'customer' ? '#06C167' : '#DC2626'} />
                {pickMode === 'customer' ? 'Click Map for Drop-off...' : 'Pick Drop-off Zone on Map'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* 4. COLLAPSIBLE DELIVERY CARD WITH EXPLICIT LIFECYCLE CONTROLS */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '24px', zIndex: 1000, width: cardMinimized ? '280px' : '380px',
        backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: cardMinimized ? '12px 18px' : '20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)', color: '#0F172A', transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cardMinimized ? '0' : '14px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: '800', color: deliveryState === 'delivering' ? '#06C167' : '#64748B', backgroundColor: deliveryState === 'delivering' ? '#ECFDF5' : '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
              {deliveryState === 'idle' && 'READY FOR DISPATCH'}
              {deliveryState === 'delivering' && 'ON THE WAY'}
              {deliveryState === 'paused' && 'SIMULATION PAUSED'}
              {deliveryState === 'completed' && 'DELIVERY ARRIVED'}
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: cardMinimized ? '14px' : '18px', fontWeight: '800', color: '#0F172A' }}>
              {deliveryState === 'completed' ? 'Arrived at Destination' : 'Arriving in 12 mins'}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setCardMinimized(!cardMinimized)}
              style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', padding: '6px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {cardMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
          </div>
        </div>

        {!cardMinimized && (
          <>
            {/* DELIVERY ACTION CONTROLS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {deliveryState === 'delivering' ? (
                <button
                  onClick={handlePauseDelivery}
                  style={{ flex: 1, backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#D97706', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Pause size={14} /> Pause Delivery
                </button>
              ) : (
                <button
                  onClick={handleStartDelivery}
                  style={{ flex: 1, backgroundColor: '#06C167', border: 'none', color: '#FFFFFF', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Play size={14} /> {deliveryState === 'paused' ? 'Resume Delivery' : 'Start Delivery'}
                </button>
              )}

              <button
                onClick={handleStopDelivery}
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Square size={14} /> Stop / Reset
              </button>
            </div>

            {/* PROGRESS BAR */}
            <div style={{ height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ height: '100%', width: `${((simStep + 1) / routePath.length) * 100}%`, backgroundColor: '#06C167', transition: 'width 0.5s ease' }}></div>
            </div>

            {/* DRIVER BOX */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
              <div style={{ backgroundColor: '#E2E8F0', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                👨‍✈️
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>{driverName} ({driverId})</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>{vehicleDetails} • ★ 4.9</p>
              </div>
              <button style={{ backgroundColor: '#000000', border: 'none', color: '#FFFFFF', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <PhoneCall size={15} />
              </button>
            </div>

            {/* PRIVACY STATUS BADGE */}
            <div style={{
              backgroundColor: privacyMode === 'cryptospatial' ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${privacyMode === 'cryptospatial' ? '#A7F3D0' : '#FECACA'}`,
              borderRadius: '16px', padding: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: privacyMode === 'cryptospatial' ? '#047857' : '#B91C1C', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {privacyMode === 'cryptospatial' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                  {privacyMode === 'cryptospatial' ? 'CryptoSpatial Protected' : 'Legacy Unprotected Mode'}
                </span>
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>153m Grid</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#334155', marginBottom: '4px' }}>
                <span>Active Base32 Tile:</span>
                <code style={{ color: '#2563EB', fontWeight: 'bold' }}>{privacyMode === 'cryptospatial' ? maskedGeohash : 'EXPOSED'}</code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#334155' }}>
                <span>Raw Coordinates:</span>
                <span style={{ color: privacyMode === 'cryptospatial' ? '#047857' : '#DC2626', fontWeight: 'bold' }}>
                  {privacyMode === 'cryptospatial' ? '[PURGED AT EDGE]' : `${currentRawPos[0].toFixed(5)}, ${currentRawPos[1].toFixed(5)}`}
                </span>
              </div>

              {proofToken && (
                <div style={{ marginTop: '10px', backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '8px', border: '1px solid #A7F3D0', fontSize: '10px', color: '#047857' }}>
                  <b>✓ ZK Proof-of-Presence Token:</b><br />
                  <code style={{ fontSize: '11px', color: '#059669' }}>{proofToken}</code>
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}