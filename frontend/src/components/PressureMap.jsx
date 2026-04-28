import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, ImageOverlay, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GEOJSON_PRIMARY_URL =
  'https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Bangalore/BBMP.geojson';
const GEOJSON_FALLBACK_URL =
  'https://raw.githubusercontent.com/datameet/PincodeBoundary/master/Bangalore/boundary.geojson';

function InvalidateLeafletSize() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 50);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

export default function PressureMap({ zones, units, onZoneClick, mapAnimations = [], weatherRainMm = 0 }) {
  const geoJsonLayerRef = useRef(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [geoJsonStatus, setGeoJsonStatus] = useState('loading'); // loading | ready | unavailable
  const [animatingUnits, setAnimatingUnits] = useState([]);

  const zonesSorted = useMemo(() => {
    // Ensure consistent ordering for legend counts and rendering.
    const arr = [...(zones || [])];
    arr.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    return arr;
  }, [zones]);

  const zoneCounts = useMemo(() => {
    const critical = (zones || []).filter((z) => z.status === 'red').length;
    const amber = (zones || []).filter((z) => z.status === 'amber').length;
    return { critical, amber };
  }, [zones]);

  const toNumber = (v) => (typeof v === 'number' ? v : v == null ? NaN : Number(v));
  const getZoneLatLng = (zone) => {
    if (!zone) return null;
    const lat = toNumber(zone.center_lat);
    const lng = toNumber(zone.center_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  };

  const stableJitter = (id) => {
    const s = String(id ?? '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // 0..1
    const u1 = ((h >>> 0) % 1000) / 1000;
    const u2 = (((h >>> 0) / 1000) % 1000) / 1000;
    // +-0.002
    return [(u1 - 0.5) * 0.004, (u2 - 0.5) * 0.004];
  };

  const unitIconsByStatus = useMemo(() => {
    const make = (color) =>
      new L.DivIcon({
        className: '',
        html: `
          <div style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); transition: transform 0.2s;">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="5" r="4" fill="${color}" stroke="white" stroke-width="1.5"/>
              <path d="M3 22 C3 15 17 15 17 22" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
              <rect x="6" y="10" width="8" height="8" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
            </svg>
          </div>
        `,
        iconSize: [20, 24],
        iconAnchor: [10, 24],
        popupAnchor: [0, -24],
      });

    return {
      available: make('#1A73E8'),
      en_route: make('#E37400'),
      deployed: make('#D93025'),
    };
  }, []);

  const rainOverlayUrl = useMemo(() => {
    const mm = Number(weatherRainMm || 0);
    if (!(mm > 2)) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const intensity = Math.min(mm / 50, 1);
    const gradient = ctx.createRadialGradient(150, 150, 0, 150, 150, 150);
    gradient.addColorStop(0, `rgba(30,100,220,${intensity * 0.35})`);
    gradient.addColorStop(0.6, `rgba(30,100,220,${intensity * 0.15})`);
    gradient.addColorStop(1, 'rgba(30,100,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);
    return canvas.toDataURL();
  }, [weatherRainMm]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchGeoJson = async (url) => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);
      return res.json();
    };

    const normalize = (data) => {
      // Ensure FeatureCollection shape; attach a stable index for styling.
      const fc = data?.type === 'FeatureCollection' ? data : null;
      const features = Array.isArray(fc?.features) ? fc.features : [];
      const patched = features.map((f, idx) => {
        const props = { ...(f?.properties || {}), __tfIndex: idx };
        return { ...f, properties: props };
      });
      return { type: 'FeatureCollection', features: patched };
    };

    const run = async () => {
      setGeoJsonStatus('loading');
      setGeoJsonData(null);
      try {
        const primary = await fetchGeoJson(GEOJSON_PRIMARY_URL);
        if (!isMounted) return;
        setGeoJsonData(normalize(primary));
        setGeoJsonStatus('ready');
        return;
      } catch {
        // ignore and try fallback
      }

      try {
        const fallback = await fetchGeoJson(GEOJSON_FALLBACK_URL);
        if (!isMounted) return;
        setGeoJsonData(normalize(fallback));
        setGeoJsonStatus('ready');
      } catch {
        if (!isMounted) return;
        setGeoJsonStatus('unavailable');
      }
    };

    run();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const styleFeature = useMemo(() => {
    return (feature) => {
      const index = feature?.properties?.__tfIndex ?? 0;
      const zoneIndex = index % (zones?.length || 20);
      const zone = zones?.[zoneIndex];
      const status = zone?.status || 'green';

      const fills = {
        green: { color: '#1E8E6E', opacity: 0.18 },
        amber: { color: '#E37400', opacity: 0.28 },
        red: { color: '#D93025', opacity: 0.38 },
      };
      const { color, opacity } = fills[status] || fills.green;

      return {
        fillColor: color,
        fillOpacity: opacity,
        color: color,
        weight: 1.5,
        opacity: 0.6,
        className: status === 'red' ? 'zone-polygon zone-critical' : 'zone-polygon',
      };
    };
  }, [zones]);

  const onEachFeature = useMemo(() => {
    let featureIndex = 0;
    return (feature, layer) => {
      const idx = featureIndex++;
      const zoneIndex = idx % (zones?.length || 20);
      const zone = zones?.[zoneIndex];

      try {
        layer.setStyle(styleFeature({ ...(feature || {}), properties: { ...(feature?.properties || {}), __tfIndex: idx } }));
      } catch {
        // ignore
      }

      layer.on({
        click: () => onZoneClick(zone?.id ?? idx + 1),
        mouseover: (e) => {
          e.target.setStyle({ weight: 2.5, fillOpacity: 0.55, color: '#1A73E8' });
        },
        mouseout: (e) => {
          geoJsonLayerRef.current?.resetStyle(e.target);
        },
      });
    };
  }, [onZoneClick, styleFeature, zones]);

  useEffect(() => {
    if (!mapAnimations?.length) return;

    mapAnimations.forEach((anim) => {
      const source = zones?.find((z) => z.id === anim.sourceZoneId);
      const target = zones?.find((z) => z.id === anim.targetZoneId);
      if (!source || !target) return;

      const sourceLat = source.center_lat;
      const sourceLng = source.center_lng;
      const targetLat = target.center_lat;
      const targetLng = target.center_lng;

      if (
        !Number.isFinite(Number(sourceLat)) ||
        !Number.isFinite(Number(sourceLng)) ||
        !Number.isFinite(Number(targetLat)) ||
        !Number.isFinite(Number(targetLng))
      ) {
        return;
      }

      const entry = {
        id: anim.id,
        sourceLatLng: [Number(sourceLat), Number(sourceLng)],
        targetLatLng: [Number(targetLat), Number(targetLng)],
        progress: 0,
        currentLatLng: [Number(sourceLat), Number(sourceLng)],
      };

      setAnimatingUnits((prev) => [...prev.filter((a) => a.id !== anim.id), entry]);

      const duration = 2000;
      const start = performance.now();

      const animate = (now) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const currentLat = Number(sourceLat) + (Number(targetLat) - Number(sourceLat)) * eased;
        const currentLng = Number(sourceLng) + (Number(targetLng) - Number(sourceLng)) * eased;

        setAnimatingUnits((prev) =>
          prev.map((a) => (a.id === anim.id ? { ...a, progress: eased, currentLatLng: [currentLat, currentLng] } : a)),
        );

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            setAnimatingUnits((prev) => prev.filter((a) => a.id !== anim.id));
          }, 400);
        }
      };

      requestAnimationFrame(animate);
    });
  }, [mapAnimations, zones]);

  if (geoJsonStatus === 'loading') {
    return (
      <div className="h-full w-full bg-[#F8FAFF] flex items-center justify-center text-[#5F6B7C] font-mono text-sm">
        Loading Bengaluru zone map...
      </div>
    );
  }

  if (geoJsonStatus !== 'ready' || !geoJsonData) {
    return (
      <div className="h-full w-full bg-[#F8FAFF] flex items-center justify-center text-[#5F6B7C] font-mono text-sm">
        GeoJSON unavailable
      </div>
    );
  }

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-[rgba(99,120,160,0.15)] shadow-sm bg-white flex flex-col">
      <div className="h-10 border-b border-[rgba(99,120,160,0.10)] flex justify-between items-center px-3 bg-[#F8FAFF] shrink-0 z-[1000] relative pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-[#1C2B4A]">LIVE MAP</span>
          {zoneCounts.critical > 0 ? (
            <span className="text-[10px] font-mono text-[#D93025] px-1.5 py-0.5 bg-[#FEE8E7] rounded">
              {zoneCounts.critical} CRITICAL
            </span>
          ) : zoneCounts.amber > 0 ? (
            <span className="text-[10px] font-mono text-[#E37400] px-1.5 py-0.5 bg-[#FFF3E0] rounded">
              {zoneCounts.amber} WATCH
            </span>
          ) : (
            <span className="text-[10px] font-mono text-[#1E8E6E] px-1.5 py-0.5 bg-[#E6F4EA] rounded">
              NOMINAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#5F6B7C]">
          <span className="w-2 h-2 rounded-full bg-[#1A73E8]" />
          <span>Zones</span>
          <span className="text-[#1C2B4A] font-bold">{String(zonesSorted.length).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <MapContainer
          center={[12.9716, 77.5946]}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <InvalidateLeafletSize />

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {rainOverlayUrl && (
            <ImageOverlay
              url={rainOverlayUrl}
              bounds={[[12.85, 77.45], [13.10, 77.75]]}
              opacity={1}
              zIndex={400}
            />
          )}

          <GeoJSON
            key={geoJsonData?.features?.length || 0}
            data={geoJsonData}
            style={styleFeature}
            onEachFeature={onEachFeature}
            ref={geoJsonLayerRef}
          />

          {/* Units */}
          {units && zones && units.map((unit) => {
            const zone = zones.find((z) => z.id === unit.zone_id);
            const zoneLatLng = getZoneLatLng(zone);
            if (!zoneLatLng) return null;

            const [jitterLat, jitterLng] = stableJitter(unit.id);

            return (
              <Marker
                key={unit.id}
                position={[zoneLatLng[0] + jitterLat, zoneLatLng[1] + jitterLng]}
                icon={unitIconsByStatus[unit.status] || unitIconsByStatus.available}
              >
                <Tooltip direction="top" opacity={1}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    Unit {unit.id} • Zone {unit.zone_id}
                  </div>
                </Tooltip>
              </Marker>
            );
          })}

          {/* Animated dispatch movement */}
          {animatingUnits.map((anim) => (
            <Fragment key={anim.id}>
              <Polyline
                positions={[anim.sourceLatLng, anim.currentLatLng]}
                pathOptions={{
                  color: '#1A73E8',
                  weight: 2,
                  opacity: 0.5,
                  dashArray: '6, 8',
                }}
              />
              <Polyline
                positions={[anim.currentLatLng, anim.targetLatLng]}
                pathOptions={{
                  color: '#1A73E8',
                  weight: 1.5,
                  opacity: 0.2,
                  dashArray: '4, 8',
                }}
              />
              <Marker
                position={anim.currentLatLng}
                icon={new L.DivIcon({
                  className: '',
                  html: `
                    <div style="filter: drop-shadow(0 3px 8px rgba(26,115,232,0.5)); position: relative;">
                      <svg width="24" height="28" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="10" cy="5" r="4" fill="#1A73E8" stroke="white" stroke-width="1.5"/>
                        <path d="M3 22 C3 15 17 15 17 22" fill="#1A73E8" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
                        <rect x="6" y="10" width="8" height="8" rx="2" fill="#1A73E8" stroke="white" stroke-width="1.5"/>
                      </svg>
                      <div style="
                        position: absolute;
                        bottom: -4px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 16px;
                        height: 6px;
                        background: radial-gradient(ellipse, rgba(26,115,232,0.35) 0%, transparent 70%);
                        border-radius: 50%;
                      "></div>
                    </div>
                  `,
                  iconSize: [24, 28],
                  iconAnchor: [12, 28],
                })}
              />
              <Marker
                position={anim.targetLatLng}
                icon={new L.DivIcon({
                  className: '',
                  html: `
                    <div style="
                      width: 28px;
                      height: 28px;
                      border-radius: 50%;
                      border: 2.5px solid #1A73E8;
                      background: rgba(26,115,232,0.12);
                      animation: pulse-ring 1s ease-out infinite;
                      position: relative;
                      left: -14px;
                      top: -14px;
                    "></div>
                    <style>
                      @keyframes pulse-ring {
                        0% { transform: scale(0.8); opacity: 1; }
                        100% { transform: scale(1.8); opacity: 0; }
                      }
                    </style>
                  `,
                  iconSize: [0, 0],
                  iconAnchor: [0, 0],
                })}
              />
            </Fragment>
          ))}
        </MapContainer>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            left: '12px',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(99,120,160,0.2)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#1C2B4A',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            minWidth: '120px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '6px', letterSpacing: '0.08em', color: '#5F6B7C', fontSize: '10px' }}>
            PRESSURE
          </div>
          {[
            { color: '#1E8E6E', label: 'Green' },
            { color: '#E37400', label: 'Amber' },
            { color: '#D93025', label: 'Red' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }}></div>
              <span>{label}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(99,120,160,0.15)', marginTop: '6px', paddingTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
              <span>🌧</span>
              <span>Rain: {Number(weatherRainMm || 0).toFixed(1)}mm/hr</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <svg width="12" height="14" viewBox="0 0 20 24" fill="#1A73E8">
                <circle cx="10" cy="5" r="4" />
                <path d="M3 22 C3 15 17 15 17 22" />
                <rect x="6" y="10" width="8" height="8" rx="2" />
              </svg>
              <span>Responder unit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
