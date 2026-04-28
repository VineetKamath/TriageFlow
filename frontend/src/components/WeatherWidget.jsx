import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function RainIcon({ className, style }) {
  return (
    <svg className={className} style={style} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.5 2 7 4 7 7c-2.8.5-5 3-5 6 0 3.3 2.7 6 6 6h8 c3.3 0 6-2.7 6-6 0-2.8-1.9-5.2-4.5-5.8C17 4.5 14.8 2 12 2z" />
      <line x1="8" y1="19" x2="6" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="19" x2="10" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="19" x2="14" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function WeatherWidget({ onRainUpdate }) {
  const [rainMm, setRainMm] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/weather`);
        const mm = Number(res.data?.rain_mm || 0);
        if (!mounted) return;
        setRainMm(mm);
        setUpdatedAt(res.data?.updated_at ?? null);
        onRainUpdate?.(mm);
      } catch {
        // keep last values
      }
    };
    run();
    const t = setInterval(run, 10 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [onRainUpdate]);

  const tone = useMemo(() => {
    if (rainMm < 2) return { bg: 'rgba(95,107,124,0.10)', fg: '#5F6B7C', border: 'rgba(99,120,160,0.18)' };
    if (rainMm < 10) return { bg: 'rgba(26,115,232,0.10)', fg: '#1A73E8', border: 'rgba(26,115,232,0.25)' };
    if (rainMm < 30) return { bg: 'rgba(26,115,232,0.18)', fg: '#174EA6', border: 'rgba(23,78,166,0.25)' };
    return { bg: 'rgba(217,48,37,0.10)', fg: '#D93025', border: 'rgba(217,48,37,0.25)' };
  }, [rainMm]);

  return (
    <div
      title="Live rainfall affects zone pressure scores"
      style={{
        position: 'relative',
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      }}
    >
      <RainIcon />
      <span style={{ fontWeight: 800 }}>{rainMm.toFixed(1)}mm/hr</span>
      <span style={{ color: 'rgba(95,107,124,0.8)', fontWeight: 600 }}>{updatedAt ? '' : ''}</span>
    </div>
  );
}

