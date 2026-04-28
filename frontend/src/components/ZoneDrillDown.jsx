import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const statusColors = {
  green: '#1E8E6E',
  amber: '#E37400',
  red: '#D93025',
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
    ? 'bg-[#FEE8E7] text-[#D93025] border border-[rgba(217,48,37,0.35)]'
    : zoneData.status === 'amber'
      ? 'bg-[#FFF3E0] text-[#E37400] border border-[rgba(227,116,0,0.35)]'
      : 'bg-[#E6F4EA] text-[#1E8E6E] border border-[rgba(30,142,110,0.35)]';

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="absolute top-0 right-0 h-full w-[380px] z-[500] bg-white/97 backdrop-blur-sm border-l border-[rgba(99,120,160,0.15)] shadow-[-8px_0_32px_rgba(0,0,0,0.1)] p-4 overflow-y-auto rounded-l-xl"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C2B4A]">{zoneData.name || `Zone ${zoneId}`}</h2>
          <span 
            className={`inline-block mt-1 px-2 py-1 rounded text-xs uppercase font-semibold ${statusBadgeClass}`}
          >
            {zoneData.status}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-[#9AA3B0] hover:text-[#1C2B4A] text-2xl font-bold leading-none"
        >
          &times;
        </button>
      </div>

      <div className="mb-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F6B7C] mb-3">Pressure Trend (30 min)</h3>
        <div className="h-[200px] bg-[#F8FAFF] rounded-xl border border-[rgba(99,120,160,0.15)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <defs>
                <linearGradient id="pressureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={statusColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 4" stroke="rgba(99,120,160,0.18)" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(99,120,160,0.35)" tick={{ fill: 'rgba(95,107,124,0.9)', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickMargin={5} />
              <YAxis domain={[0, 100]} stroke="rgba(99,120,160,0.35)" tick={{ fill: 'rgba(95,107,124,0.9)', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Tooltip 
                contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(99,120,160,0.25)', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px' }}
                itemStyle={{ color: statusColor }}
              />
              <Area type="monotone" dataKey="pressure" stroke="none" fill="url(#pressureFill)" />
              <Line type="monotone" dataKey="pressure" stroke={statusColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-6 bg-[#F8FAFF] border border-[rgba(26,115,232,0.22)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F6B7C]">AI Summary</h3>
          <div className="flex items-center gap-1 text-[#1A73E8] text-[10px] font-mono">
            <span aria-hidden="true">◆</span>
            <span>Powered by Gemini</span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[#1C2B4A]">
          {zoneData.ai_summary || (zoneData.explanation?.[0] ?? "No summary available yet.")}
        </p>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F6B7C] mb-3">Live Signals</h3>
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
  let color = '#1E8E6E';
  if (percentage > 50) color = '#E37400';
  if (percentage > 80) color = '#D93025';

  return (
    <div>
      <div className="flex justify-between font-mono text-xs text-[#5F6B7C] mb-1">
        <span>{label}</span>
        <span className="text-[#1C2B4A] font-bold">{typeof value === 'number' ? value.toFixed(1) : value}{unit}</span>
      </div>
      <div className="bg-[#EEF3FF] rounded-full h-1.5 w-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${percentage}%`, backgroundColor: color }}
        ></div>
      </div>
    </div>
  );
}
