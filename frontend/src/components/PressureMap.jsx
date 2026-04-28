import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

const statusColors = {
  green: { color: '#2ECC8F', opacity: 0.15 },
  amber: { color: '#D4860A', opacity: 0.25 },
  red: { color: '#C94040', opacity: 0.35 },
};
const ZONE_NAMES = [
  "Northgate", "Riverside", "Central", "Eastfield",
  "Harbourside", "Millbrook", "Queensway", "Docklands",
  "Westend", "Highpark", "Southside", "Floodplain",
  "Midtown", "Crossroads", "Lakeside", "Oldtown",
  "Newbridge", "Marshgate", "Hilltop", "Ferndale",
];

export default function PressureMap({ zones, units, onZoneClick, mapAnimations = [] }) {
  const unitIcon = new L.DivIcon({
    className: '',
    html: `<div style="width:7px;height:7px;border:1.5px solid #3B8BEB;background:rgba(59,139,235,0.15);transform:rotate(45deg);"></div>`,
    iconSize: [7, 7],
    iconAnchor: [3.5, 3.5],
  });

  const [geojsonData, setGeojsonData] = useState(null);
  const geoJsonLayerRef = React.useRef();
  const previousStatusesRef = React.useRef({});

  useEffect(() => {
    if (zones) {
      const newStatuses = {};
      zones.forEach(z => {
        newStatuses[z.id] = z.status;
      });
      previousStatusesRef.current = newStatuses;
    }
  }, [zones]);

  useEffect(() => {
    // Fetch geojson from backend (need to get it via static or direct file for now we assume it's exposed or we fetch from a known endpoint. Since backend doesn't have a specific endpoint for geojson, we can hardcode the grid or assume it's available).
    // Let's hardcode a simple grid as requested if fetch fails or we can just fetch if we added an endpoint. Wait, the prompt said: "fetch zones.geojson from backend or hardcode a 4x5 grid of lat/lng rectangles around a city center like 51.5, -0.1 for London".
    // I will fetch from backend since the backend already serves the file. Ah, backend main.py doesn't serve static files. 
    // Let me generate the grid here to be safe and robust.
    const generateGrid = () => {
      const features = [];
      const startLat = 40.775;
      const startLng = -74.004;
      let id = 1;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          const lat = startLat - row * 0.01;
          const lng = startLng + col * 0.012;
          features.push({
            type: "Feature",
            properties: { id: id, name: ZONE_NAMES[id - 1] || `Zone ${id}` },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [lng - 0.006, lat - 0.005],
                [lng + 0.006, lat - 0.005],
                [lng + 0.006, lat + 0.005],
                [lng - 0.006, lat + 0.005],
                [lng - 0.006, lat - 0.005]
              ]]
            }
          });
          id++;
        }
      }
      return { type: "FeatureCollection", features };
    };
    
    setGeojsonData(generateGrid());
  }, []);

  if (!geojsonData) return <div className="h-full w-full bg-[#0F1218] flex items-center justify-center text-[#6B7280] font-mono-data">Loading map...</div>;

  const styleFeature = (feature) => {
    const zoneId = feature.properties.id;
    const zone = zones?.find(z => z.id === zoneId);
    const status = zone ? zone.status : 'green';
    const { color, opacity } = statusColors[status] || statusColors.green;
    
    const isCritical = status === 'red';
    
    return {
      fillColor: color,
      weight: 0.5,
      opacity: 1,
      color: 'rgba(255, 255, 255, 0.9)',
      fillOpacity: opacity,
      className: isCritical ? 'zone-polygon zone-critical' : 'zone-polygon',
    };
  };

  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => {
        onZoneClick(feature.properties.id);
      },
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#e8e6e0',
          fillOpacity: 0.7,
        });
      },
      mouseout: (e) => {
        geoJsonLayerRef.current.resetStyle(e.target);
      }
    });
  };


  return (
    <div className="h-full w-full border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
      <MapContainer 
        center={[40.755, -73.986]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', backgroundColor: '#0f1117' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <GeoJSON 
          data={geojsonData} 
          style={styleFeature} 
          onEachFeature={onEachFeature} 
          ref={geoJsonLayerRef}
        />
        
        {/* Render Units */}
        {units && zones && units.map(unit => {
          const zone = zones.find(z => z.id === unit.zone_id);
          if (!zone) return null;
          
          // Add some jitter so units in same zone don't overlap perfectly
          const jitterLat = (Math.random() - 0.5) * 0.004;
          const jitterLng = (Math.random() - 0.5) * 0.004;
          
          return (
            <Marker
              key={unit.id}
              icon={unitIcon}
              center={[zone.center_lat + jitterLat, zone.center_lng + jitterLng]}
            />
          );
        })}

        {/* Render Unit Movement Animations */}
        {mapAnimations.map(anim => {
          const source = zones?.find(z => z.id === anim.sourceZoneId);
          const target = zones?.find(z => z.id === anim.targetZoneId);
          if (!source || !target) return null;
          
          return (
            <Polyline
              key={anim.id}
              positions={[
                [source.center_lat, source.center_lng],
                [target.center_lat, target.center_lng]
              ]}
              pathOptions={{ 
                color: '#3B8BEB', 
                weight: 1.5,
                opacity: 0.6,
                dashArray: '4, 6',
                className: 'laser-pulse'
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
