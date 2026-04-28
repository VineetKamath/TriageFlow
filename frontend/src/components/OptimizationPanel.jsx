import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function Gauge({ score }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = (s / 100) * c;
  const color = s < 40 ? '#D93025' : s < 70 ? '#E37400' : '#1E8E6E';

  return (
    <div className="flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} stroke="rgba(99,120,160,0.14)" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="66" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="22" fontWeight="900" fill="#1C2B4A">
          {Math.round(s)}
        </text>
        <text x="60" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="700" fill="#5F6B7C">
          / 100
        </text>
      </svg>
    </div>
  );
}

export default function OptimizationPanel({ isOpen, onClose, onApplyAll, zones, onScoreUpdate }) {
  const [data, setData] = useState(null);
  const [isMutualLoading, setIsMutualLoading] = useState(false);
  const [mutualSuccess, setMutualSuccess] = useState(false);

  const shortage = Boolean(data?.shortage);
  const totalAvailableUnits = Number(data?.total_available_units || 0);
  const score = Number(data?.optimization_score || 0);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const run = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/optimize`);
        if (!mounted) return;
        setData(res.data);
        onScoreUpdate?.(Number(res.data?.optimization_score || 0));
      } catch {
        // keep last
      }
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [isOpen, onScoreUpdate]);

  const zonesById = useMemo(() => {
    const m = new Map();
    (zones || []).forEach((z) => m.set(z.id, z));
    return m;
  }, [zones]);

  const requestMutualAid = async () => {
    if (isMutualLoading) return;
    setIsMutualLoading(true);
    setMutualSuccess(false);
    try {
      const firstRed = (zones || []).find((z) => z.status === 'red')?.id ?? 1;
      await axios.post(`${API_BASE_URL}/mutual-aid`, { requesting_zone_id: firstRed, units_needed: 3 });
      setMutualSuccess(true);
      setTimeout(() => setMutualSuccess(false), 4500);
    } catch {
      // ignore
    }
    setIsMutualLoading(false);
  };

  const allocation = Array.isArray(data?.allocation_plan) ? data.allocation_plan : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-[rgba(99,120,160,0.15)] shadow-2xl z-[3000] flex flex-col"
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-[rgba(99,120,160,0.12)] bg-[#F8FAFF]">
            <div className="text-sm font-bold text-[#1C2B4A]">Resource Optimization</div>
            <button
              onClick={onClose}
              className="px-2 py-1 rounded-md border border-[rgba(99,120,160,0.18)] text-[#5F6B7C] hover:bg-white"
            >
              Close
            </button>
          </div>

          <div className="p-4 flex items-center gap-4">
            <Gauge score={score} />
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#5F6B7C]">Optimization score</div>
              <div className="text-2xl font-mono font-extrabold text-[#1C2B4A]">{Math.round(score)}%</div>
              <div className="mt-2 text-[11px] text-[#5F6B7C]">
                Available units citywide: <b className="text-[#1C2B4A]">{totalAvailableUnits}</b>
              </div>
            </div>
          </div>

          {shortage && (
            <div className="mx-4 mb-3 rounded-lg border border-[rgba(217,48,37,0.25)] bg-[rgba(217,48,37,0.06)] px-3 py-2">
              <div className="text-[12px] font-semibold text-[#D93025]">
                ⚠ Critical shortage — only {totalAvailableUnits} units available citywide
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={requestMutualAid}
                  className="px-3 py-2 rounded-lg border border-[rgba(26,115,232,0.28)] text-[#1A73E8] bg-white hover:bg-[#EEF3FF] text-xs font-bold"
                >
                  {isMutualLoading ? 'Requesting…' : 'Request Mutual Aid'}
                </button>
                {mutualSuccess && <span className="text-xs text-[#1E8E6E] font-semibold">✓ Requested — ETA 15 minutes</span>}
              </div>
            </div>
          )}

          <div className="px-4 pb-2 text-[10px] font-mono uppercase tracking-widest text-[#5F6B7C]">
            Allocation plan
          </div>

          <div className="flex-1 overflow-auto px-4 pb-4">
            <div className="space-y-2">
              {allocation.map((row) => {
                const zone = zonesById.get(row.zone_id);
                const name = zone?.name || row.zone_name || `Zone ${row.zone_id}`;
                const cur = Number(row.current_units || 0);
                const rec = Number(row.recommended_units || 0);
                const delta = Number(row.delta || 0);

                const maxBar = Math.max(1, Math.max(cur, rec, 6));
                const curPct = Math.min(100, (cur / maxBar) * 100);
                const recPct = Math.min(100, (rec / maxBar) * 100);

                const badge =
                  delta > 0
                    ? 'bg-[#E6F4EA] text-[#1E8E6E] border-[rgba(30,142,110,0.25)]'
                    : delta < 0
                      ? 'bg-[#FEE8E7] text-[#D93025] border-[rgba(217,48,37,0.25)]'
                      : 'bg-[#F8FAFF] text-[#5F6B7C] border-[rgba(99,120,160,0.15)]';

                return (
                  <div key={row.zone_id} className="rounded-lg border border-[rgba(99,120,160,0.15)] bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-bold text-[#1C2B4A] truncate">{name}</div>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${badge}`}>
                        {delta > 0 ? `+${delta}` : String(delta)}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-16 text-[10px] font-mono text-[#5F6B7C]">Current</div>
                        <div className="flex-1 h-2 rounded bg-[#EEF3FF] overflow-hidden">
                          <div className="h-2 bg-[#1A73E8]" style={{ width: `${curPct}%` }} />
                        </div>
                        <div className="w-8 text-right text-[10px] font-mono text-[#1C2B4A]">{cur}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 text-[10px] font-mono text-[#5F6B7C]">Rec</div>
                        <div className="flex-1 h-2 rounded bg-[#F0F4FA] overflow-hidden">
                          <div className="h-2 bg-[#1E8E6E]" style={{ width: `${recPct}%` }} />
                        </div>
                        <div className="w-8 text-right text-[10px] font-mono text-[#1C2B4A]">{rec}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-[rgba(99,120,160,0.12)] bg-[#F8FAFF]">
            <button
              onClick={onApplyAll}
              className="w-full px-4 py-3 rounded-xl bg-[#1A73E8] hover:bg-[#1558B0] text-white font-bold text-sm shadow-sm"
            >
              Apply All Optimizations
            </button>
            <div className="mt-2 text-[11px] text-[#5F6B7C]">
              Applies all pending suggestions with a short stagger.
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

