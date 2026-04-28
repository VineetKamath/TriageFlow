import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function InlineOptimizationSummary({ optimizationScore = 0, onOpenFull, zones, onScoreUpdate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/optimize`);
        if (!mounted) return;
        setData(res.data);
        const score = Number(res.data?.optimization_score || 0);
        onScoreUpdate?.(score);
      } catch {
        // ignore
      }
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [onScoreUpdate]);

  const score = Number(data?.optimization_score ?? optimizationScore ?? 0);
  const color = score < 40 ? '#D93025' : score < 70 ? '#E37400' : '#1E8E6E';

  const zonesById = useMemo(() => {
    const m = new Map();
    (zones || []).forEach((z) => m.set(z.id, z));
    return m;
  }, [zones]);

  const top3 = useMemo(() => {
    const plan = Array.isArray(data?.allocation_plan) ? data.allocation_plan : [];
    const sorted = [...plan].sort((a, b) => Math.abs(Number(b.delta || 0)) - Math.abs(Number(a.delta || 0)));
    return sorted.slice(0, 3).map((r) => {
      const name = zonesById.get(r.zone_id)?.name || r.zone_name || `Zone ${r.zone_id}`;
      return {
        id: r.zone_id,
        name,
        delta: Number(r.delta || 0),
        current: Number(r.current_units || 0),
        recommended: Number(r.recommended_units || 0),
      };
    });
  }, [data, zonesById]);

  return (
    <div className="bg-white border border-[rgba(99,120,160,0.15)] rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-[#1C2B4A]">Resource Optimization</div>
        <button
          onClick={onOpenFull}
          className="text-[11px] font-mono text-[#1A73E8] hover:underline"
        >
          View Full →
        </button>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5F6B7C] uppercase tracking-widest">Score</span>
          <span className="text-[11px] font-mono font-bold" style={{ color }}>
            {Math.round(score)}%
          </span>
        </div>
        <div className="mt-1 h-2 rounded bg-[#F0F4FA] overflow-hidden">
          <div className="h-2 rounded" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: color }} />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {top3.map((z) => {
          const badge =
            z.delta > 0
              ? 'bg-[#E6F4EA] text-[#1E8E6E] border-[rgba(30,142,110,0.25)]'
              : z.delta < 0
                ? 'bg-[#FEE8E7] text-[#D93025] border-[rgba(217,48,37,0.25)]'
                : 'bg-[#F8FAFF] text-[#5F6B7C] border-[rgba(99,120,160,0.15)]';
          const maxBar = Math.max(1, z.current, z.recommended, 6);
          return (
            <div key={z.id} className="flex items-center gap-2">
              <div className="w-[110px] text-[11px] text-[#1C2B4A] font-semibold truncate">
                {String(z.name).slice(0, 12)}
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge}`}>
                {z.delta > 0 ? `+${z.delta}` : String(z.delta)}
              </span>
              <div className="flex-1 h-2 rounded bg-[#EEF3FF] overflow-hidden">
                <div className="h-2 bg-[#1A73E8]" style={{ width: `${Math.min(100, (z.current / maxBar) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

