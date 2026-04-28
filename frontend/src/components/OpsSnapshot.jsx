import { useEffect, useMemo, useState } from 'react';

function Tile({ label, value, color, bg }) {
  return (
    <div className="rounded-lg border border-[rgba(99,120,160,0.15)] px-3 py-2" style={{ background: bg }}>
      <div className="font-mono font-extrabold text-[28px] leading-none" style={{ color }}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-[#5F6B7C]">{label}</div>
    </div>
  );
}

export default function OpsSnapshot({ incidents, suggestions, units }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lastIncidentTs = useMemo(() => {
    const last = (incidents || []).slice(-1)[0];
    return last?.timestamp || null;
  }, [incidents]);

  const secsAgo = useMemo(() => {
    if (!lastIncidentTs) return null;
    const d = new Date(lastIncidentTs).getTime();
    if (!Number.isFinite(d)) return null;
    return Math.max(0, Math.floor((nowMs - d) / 1000));
  }, [lastIncidentTs, nowMs]);

  const incidentsCount = (incidents || []).length;
  const suggestionsCount = (suggestions || []).length;
  const availableCount = (units || []).filter((u) => u.status === 'available').length;
  const enRouteCount = (units || []).filter((u) => u.status === 'en_route').length;

  return (
    <div className="bg-white rounded-xl border border-[rgba(99,120,160,0.15)] p-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#5F6B7C]">OPS SNAPSHOT</div>
        <div className="text-[10px] font-mono text-[#9AA3B0]">{secsAgo == null ? '—' : `${secsAgo}s ago`}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="INCIDENTS" value={incidentsCount} color="#1A73E8" bg="#EEF3FF" />
        <Tile label="SUGGESTIONS" value={suggestionsCount} color="#E37400" bg="#FFF3E0" />
        <Tile label="UNITS AVAILABLE" value={availableCount} color="#1E8E6E" bg="#E6F4EA" />
        <Tile label="EN ROUTE" value={enRouteCount} color="#E37400" bg="#FFF3E0" />
      </div>
    </div>
  );
}

