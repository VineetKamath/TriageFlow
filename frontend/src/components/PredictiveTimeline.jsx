import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function PredictiveTimeline({ zones, selectedZoneId }) {
  const [manualZoneId, setManualZoneId] = useState(null);
  const [data, setData] = useState(null);

  const topZones = useMemo(() => {
    const arr = [...(zones || [])];
    arr.sort((a, b) => (b.pressure_score || 0) - (a.pressure_score || 0));
    return arr.slice(0, 5);
  }, [zones]);

  const activeZoneId = selectedZoneId ?? manualZoneId ?? topZones[0]?.id ?? null;

  useEffect(() => {
    if (!activeZoneId) return;
    let mounted = true;
    const run = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/predict/${activeZoneId}`);
        if (!mounted) return;
        setData(res.data);
      } catch {
        // ignore
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [activeZoneId]);

  const zoneName = useMemo(
    () => zones?.find((z) => z.id === activeZoneId)?.name || `Zone ${activeZoneId ?? '—'}`,
    [zones, activeZoneId],
  );
  const predicted = useMemo(() => (Array.isArray(data?.predicted) ? data.predicted : []), [data]);
  const surgeExpected = Boolean(data?.surge_expected);
  const surgeAt = data?.surge_at_minutes ?? null;

  const currentScore = useMemo(() => {
    const z = zones?.find((zz) => zz.id === activeZoneId);
    return typeof z?.pressure_score === 'number' ? z.pressure_score : 0;
  }, [zones, activeZoneId]);

  const chartData = useMemo(() => {
    const base = [{ minutes_ahead: 0, predicted_score: Number(currentScore || 0) }];
    return base.concat(predicted);
  }, [predicted, currentScore]);

  return (
    <div className="bg-white rounded-xl border border-[rgba(99,120,160,0.15)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono text-[#5F6B7C] uppercase tracking-widest">60-Min Pressure Forecast</div>
          <div className="text-sm font-bold text-[#1C2B4A] mt-1">{zoneName}</div>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {topZones.map((z) => (
            <button
              key={z.id}
              onClick={() => setManualZoneId(z.id)}
              className={[
                'px-2 py-1 rounded-full border text-[10px] font-mono',
                z.id === activeZoneId
                  ? 'bg-[#EEF3FF] border-[rgba(26,115,232,0.28)] text-[#1A73E8]'
                  : 'bg-white border-[rgba(99,120,160,0.18)] text-[#5F6B7C] hover:bg-[#F8FAFF]',
              ].join(' ')}
            >
              {z.name?.slice(0, 14) || `Zone ${z.id}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="tfForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A73E8" stopOpacity={0.35} />
                <stop offset="80%" stopColor="#1A73E8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(99,120,160,0.12)" strokeDasharray="4 6" />
            <XAxis
              dataKey="minutes_ahead"
              tick={{ fontSize: 10, fill: '#5F6B7C', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: 'rgba(99,120,160,0.18)' }}
              tickLine={false}
              domain={[0, 60]}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#5F6B7C', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <RTooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(99,120,160,0.18)',
                borderRadius: 10,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
              }}
              labelFormatter={(v) => `${v} min`}
              formatter={(v) => [`${Number(v).toFixed(1)}`, 'pressure']}
            />
            {surgeExpected && surgeAt != null && (
              <ReferenceLine
                x={surgeAt}
                stroke="#D93025"
                strokeDasharray="4 6"
                label={{ value: '⚡ Surge', position: 'top', fill: '#D93025', fontSize: 10 }}
              />
            )}
            <Area type="monotone" dataKey="predicted_score" stroke="#1A73E8" strokeWidth={2} fill="url(#tfForecast)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

