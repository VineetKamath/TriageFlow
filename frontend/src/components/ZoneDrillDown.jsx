import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const statusColors = {
  green: '#2ECC8F',
  amber: '#D4860A',
  red: '#C94040',
};

export default function ZoneDrillDown({ zoneId, zoneData, onClose }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (zoneId) {
      axios.get(`${API_BASE_URL}/history/${zoneId}`)
        .then(res => {
          // Format data for Recharts
          const formatted = res.data.map(entry => ({
            time: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            pressure: entry.pressure_score,
          }));
          setHistory(formatted);
        })
        .catch(err => console.error('Error fetching history:', err));
    }
  }, [zoneId, zoneData]); // Re-fetch or update when zoneData changes if needed, but primarily driven by zoneId

  if (!zoneId || !zoneData) return null;

  const signals = zoneData.signals || {};
  const statusColor = statusColors[zoneData.status] || statusColors.green;

  const statusBadgeClass = zoneData.status === 'red'
    ? 'bg-[#1E1414] text-[#C94040] border border-[rgba(201,64,64,0.5)]'
    : zoneData.status === 'amber'
      ? 'bg-[#1E1A10] text-[#D4860A] border border-[rgba(212,134,10,0.5)]'
      : 'bg-[#101E18] text-[#2ECC8F] border border-[rgba(46,204,143,0.5)]';

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="fixed top-0 right-0 h-full w-[400px] z-[1000] bg-[#0F1218] border-l border-[rgba(255,255,255,0.07)] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#D4D8E0]">{zoneData.name || `Zone ${zoneId}`}</h2>
          <span 
            className={`inline-block mt-1 px-2 py-1 rounded text-xs uppercase font-semibold ${statusBadgeClass}`}
          >
            {zoneData.status}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-[#888780] hover:text-[#e8e6e0] text-2xl font-bold leading-none"
        >
          &times;
        </button>
      </div>

      <div className="mb-6">
        <h3 className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-[#3D4454] mb-3">Pressure Trend (30 min)</h3>
        <div className="h-[200px] bg-[#141720] rounded-xl border border-[rgba(255,255,255,0.07)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <defs>
                <linearGradient id="pressureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={statusColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickMargin={5} />
              <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Tooltip 
                contentStyle={{ background: '#141720', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontFamily: 'JetBrains Mono', fontSize: '11px' }}
                itemStyle={{ color: statusColor }}
              />
              <Area type="monotone" dataKey="pressure" stroke="none" fill="url(#pressureFill)" />
              <Line type="monotone" dataKey="pressure" stroke={statusColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-6 bg-[#141720] border border-[rgba(59,139,235,0.25)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-[#3D4454]">AI Summary</h3>
          <div className="flex items-center gap-1 text-[#3B8BEB] text-[10px] font-mono-data">
            <span aria-hidden="true">◆</span>
            <span>Powered by Gemini</span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[#D4D8E0]">
          {zoneData.ai_summary || (zoneData.explanation?.[0] ?? "No summary available yet.")}
        </p>
      </div>

      <div>
        <h3 className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-[#3D4454] mb-3">Live Signals</h3>
        <div className="space-y-4">
          <SignalBar label="ER Wait Delta (hrs)" value={signals.er_wait_delta} max={5} />
          <SignalBar label="Ambulance Count" value={signals.ambulance_count} max={10} />
          <SignalBar label="Volunteer Availability" value={signals.volunteer_availability * 100} max={100} unit="%" />
          <SignalBar label="Adjacent Incidents" value={signals.incident_density_adjacent} max={5} />
          <SignalBar label="Crowd Density" value={signals.crowd_density * 100} max={100} unit="%" />
          <SignalBar label="Time of Day" value={signals.time_of_day} max={24} />
        </div>
      </div>

    </motion.div>
  );
}

function SignalBar({ label, value, max, unit = '' }) {
  // Normalize percentage for width
  let percentage = (Number(value) / max) * 100;
  if (percentage < 0) percentage = 0;
  if (percentage > 100) percentage = 100;
  
  // Choose color based on percentage (rough heuristic)
  let color = '#2ECC8F';
  if (percentage > 50) color = '#D4860A';
  if (percentage > 80) color = '#C94040';

  return (
    <div>
      <div className="flex justify-between font-mono-data text-xs text-white/50 mb-1">
        <span>{label}</span>
        <span className="text-white/80">{typeof value === 'number' ? value.toFixed(1) : value}{unit}</span>
      </div>
      <div className="bg-white/5 rounded-full h-1.5 w-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${percentage}%`, backgroundColor: color }}
        ></div>
      </div>
    </div>
  );
}
