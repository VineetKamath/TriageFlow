import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  Tooltip as RechartTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import 'leaflet/dist/leaflet.css';

/* ── Zone metadata (static coords) ──────────────────────────────── */
const ZONE_META = [
  { id: 1,  name: 'Koramangala',     lat: 12.9279, lng: 77.6271 },
  { id: 2,  name: 'Bellandur',       lat: 12.9265, lng: 77.6738 },
  { id: 3,  name: 'Whitefield',      lat: 12.9698, lng: 77.7500 },
  { id: 4,  name: 'HSR Layout',      lat: 12.9116, lng: 77.6389 },
  { id: 5,  name: 'Indiranagar',     lat: 12.9784, lng: 77.6408 },
  { id: 6,  name: 'Hebbal',          lat: 13.0359, lng: 77.5970 },
  { id: 7,  name: 'Marathahalli',    lat: 12.9591, lng: 77.6972 },
  { id: 8,  name: 'Jayanagar',       lat: 12.9299, lng: 77.5933 },
  { id: 9,  name: 'Rajajinagar',     lat: 12.9918, lng: 77.5548 },
  { id: 10, name: 'Electronic City', lat: 12.8462, lng: 77.6603 },
  { id: 11, name: 'Yelahanka',       lat: 13.1007, lng: 77.5964 },
  { id: 12, name: 'BTM Layout',      lat: 12.9166, lng: 77.6101 },
];

/* ── Baseline zone state ─────────────────────────────────────────
   p=pressure(0-100), s=status, er=erWait(min), rain=mm/hr,
   aa=ambulancesAvailable, ad=ambulancesDeployed, ic=incidents, vol=volunteers */
const INIT = {
  1:  { p: 38, s: 'amber', er: 22, rain: 2,  aa: 5, ad: 3, ic: 3,  vol: 12 },
  2:  { p: 29, s: 'green', er: 14, rain: 3,  aa: 6, ad: 2, ic: 2,  vol: 8  },
  3:  { p: 44, s: 'amber', er: 31, rain: 1,  aa: 4, ad: 4, ic: 4,  vol: 10 },
  4:  { p: 31, s: 'green', er: 18, rain: 2,  aa: 5, ad: 2, ic: 2,  vol: 14 },
  5:  { p: 55, s: 'amber', er: 38, rain: 4,  aa: 3, ad: 5, ic: 5,  vol: 9  },
  6:  { p: 22, s: 'green', er: 12, rain: 1,  aa: 7, ad: 1, ic: 1,  vol: 18 },
  7:  { p: 41, s: 'amber', er: 27, rain: 2,  aa: 4, ad: 3, ic: 3,  vol: 11 },
  8:  { p: 27, s: 'green', er: 16, rain: 1,  aa: 6, ad: 2, ic: 2,  vol: 22 },
  9:  { p: 19, s: 'green', er: 10, rain: 0,  aa: 8, ad: 1, ic: 1,  vol: 15 },
  10: { p: 33, s: 'green', er: 20, rain: 2,  aa: 5, ad: 3, ic: 2,  vol: 13 },
  11: { p: 16, s: 'green', er: 9,  rain: 0,  aa: 8, ad: 0, ic: 1,  vol: 20 },
  12: { p: 47, s: 'amber', er: 34, rain: 3,  aa: 3, ad: 4, ic: 4,  vol: 16 },
};

/* ── 13-step scripted timeline (T+00 → T+60) ────────────────────── */
const STEPS = [
  {
    label: 'T+00:00',
    narration: 'All 12 Bengaluru zones at baseline. Flash flood watch issued for southern districts. 19:00 peak-hour commute underway — worst-case scenario window open.',
    suggestion: null, audit: null, mutualAid: false,
    patches: {},
    impact: { lives: 0, min: 0, inc: 0, co2: 0 },
  },
  {
    label: 'T+05:00',
    narration: 'Rainfall intensifying over Zone 2 (Bellandur). Rain rising to 18 mm/hr. Monitoring adjacent wards. No deployment required at this stage.',
    suggestion: null, audit: null, mutualAid: false,
    patches: { 2: { p: 41, s: 'amber', rain: 18 }, 7: { p: 48, rain: 9 } },
    impact: { lives: 0, min: 0, inc: 0, co2: 0 },
  },
  {
    label: 'T+10:00',
    narration: 'Zone 2 escalating. Two ambulances dispatched to active RTAs near Bellandur lake. ER wait rising. Zone 12 (BTM Layout) showing early stress signals.',
    suggestion: null, audit: null, mutualAid: false,
    patches: { 2: { p: 62, er: 29, rain: 31, aa: 4, ad: 4, ic: 5 }, 12: { p: 58, er: 41 } },
    impact: { lives: 180, min: 28, inc: 4, co2: 2 },
  },
  {
    label: 'T+15:00',
    narration: '⚠ CRITICAL: Zone 2 (Bellandur) crossed red threshold at pressure 78. Ambulance depletion imminent — only 2 units remain. Pre-stage from Yelahanka now.',
    suggestion: {
      id: 's1', from: 'Yelahanka', to: 'Bellandur', fromId: 11, toId: 2,
      units: 3, res: 'ambulances',
      reason: 'Depletion imminent — pressure 78, only 2 units remaining in Zone 2',
    },
    audit: null, mutualAid: false,
    patches: { 2: { p: 78, s: 'red', er: 52, rain: 41, aa: 2, ad: 6, ic: 8 }, 7: { p: 61, s: 'amber', er: 35 }, 1: { p: 49, er: 28, ic: 5 } },
    impact: { lives: 520, min: 76, inc: 9, co2: 4 },
  },
  {
    label: 'T+20:00',
    narration: 'Transfer initiated. 3 ambulances en route from Yelahanka — ETA 8 minutes. Zone 2 ER wait should stabilize within 15 minutes of arrival.',
    suggestion: null,
    audit: { time: 'T+20:00', action: 'Transfer accepted', detail: 'Yelahanka → Bellandur (3 ambulances)', outcome: '✓ ETA 8 min' },
    mutualAid: false,
    patches: { 11: { aa: 5, ad: 3 }, 2: { aa: 5, p: 71, ic: 7 } },
    impact: { lives: 840, min: 140, inc: 14, co2: 6 },
  },
  {
    label: 'T+25:00',
    narration: 'Zone 12 (BTM Layout) now critical at pressure 74. Volunteer surge recommended from Jayanagar. Outer Ring Road congestion worsening.',
    suggestion: {
      id: 's2', from: 'Rajajinagar', to: 'BTM Layout', fromId: 9, toId: 12,
      units: 2, res: 'ambulances + 8 volunteers',
      reason: 'ORR congestion — pre-stage before BTM Layout escalation peaks',
    },
    audit: null, mutualAid: false,
    patches: { 12: { p: 74, s: 'red', er: 61, aa: 1, ad: 6, ic: 9 }, 4: { p: 52, er: 28 } },
    impact: { lives: 1100, min: 192, inc: 19, co2: 7 },
  },
  {
    label: 'T+30:00',
    narration: 'ALERT: Zone 2 ambulance pool exhausted — 0 available. Patients rerouting to Victoria Hospital via Indiranagar. Requesting mutual aid from neighboring district.',
    suggestion: null,
    audit: { time: 'T+30:00', action: 'Volunteer dispatch', detail: 'Jayanagar → BTM Layout (8 BBMP Civil Defence volunteers)', outcome: '✓ ETA 12 min' },
    mutualAid: false,
    patches: { 2: { aa: 0, ad: 8, er: 67, p: 83, ic: 12 }, 5: { p: 69, er: 55, ic: 7 } },
    impact: { lives: 1480, min: 254, inc: 24, co2: 9 },
  },
  {
    label: 'T+35:00',
    narration: 'Three zones critical simultaneously — Bellandur, BTM Layout, Indiranagar. Mutual aid dispatched from Mysuru district — ETA 22 min. Activate Manipal Hospital diversion.',
    suggestion: null,
    audit: { time: 'T+35:00', action: 'Mutual aid dispatched', detail: 'Mysuru District → Bengaluru (5 ambulances)', outcome: '⏳ ETA 22 min' },
    mutualAid: true,
    patches: { 5: { p: 77, s: 'red', er: 71, aa: 1, ic: 9 } },
    impact: { lives: 1840, min: 310, inc: 28, co2: 10 },
  },
  {
    label: 'T+40:00',
    narration: 'Rainfall reducing in Zone 2 — 41→28 mm/hr. Volunteer deployment to BTM Layout showing effect. City pressure curve beginning to flatten.',
    suggestion: null,
    audit: { time: 'T+40:00', action: 'Rain easing', detail: 'Bellandur rainfall 41→28 mm/hr', outcome: '↓ Pressure trending down' },
    mutualAid: true,
    patches: { 2: { rain: 28, p: 75 }, 12: { er: 48, p: 65, aa: 2 } },
    impact: { lives: 2100, min: 358, inc: 30, co2: 11 },
  },
  {
    label: 'T+45:00',
    narration: 'Mysuru mutual aid units reaching Indiranagar ER. Zone 2 pressure trending down for first time in 40 minutes. Hold current resource positions.',
    suggestion: null,
    audit: { time: 'T+45:00', action: 'Mutual aid arrived', detail: 'Mysuru units at Indiranagar ER', outcome: '✓ Wait times reducing' },
    mutualAid: true,
    patches: { 2: { p: 62, er: 44, aa: 2, ic: 8 }, 5: { p: 68, er: 55, aa: 3 } },
    impact: { lives: 2400, min: 410, inc: 32, co2: 11 },
  },
  {
    label: 'T+50:00',
    narration: 'Northern zones — Yelahanka, Hebbal, Rajajinagar — held green throughout the crisis. Pre-positioning strategy reduced peak pressure by an estimated 18 points.',
    suggestion: null,
    audit: { time: 'T+50:00', action: 'Buffer analysis', detail: 'Northern zones maintained green status throughout crisis', outcome: '✓ Pre-positioning validated' },
    mutualAid: true,
    patches: {},
    impact: { lives: 2700, min: 456, inc: 34, co2: 12 },
  },
  {
    label: 'T+55:00',
    narration: 'All three critical zones returning to amber. Crisis peak has passed. Initiating gradual ambulance recall to restore Yelahanka and Rajajinagar capacity.',
    suggestion: null,
    audit: { time: 'T+55:00', action: 'Zone downgrade', detail: 'Bellandur, BTM Layout, Indiranagar → AMBER', outcome: '✓ Crisis peak passed' },
    mutualAid: true,
    patches: { 2: { s: 'amber', p: 54, er: 31 }, 12: { s: 'amber', p: 51, er: 38 }, 5: { s: 'amber', p: 57, er: 44 } },
    impact: { lives: 2960, min: 496, inc: 34, co2: 12 },
  },
  {
    label: 'T+60:00',
    narration: 'Event concluded. All 12 zones below critical threshold. 8 AI-driven decisions made — 34 incidents resolved. Post-event report ready for review.',
    suggestion: null,
    audit: { time: 'T+60:00', action: 'Event concluded', detail: '8 AI suggestions — 34 incidents resolved', outcome: '✓ All zones stable' },
    mutualAid: true,
    patches: { 2: { p: 48, s: 'amber', er: 24 }, 5: { p: 44, s: 'amber', er: 31 }, 7: { p: 38, s: 'amber', er: 22 }, 12: { p: 41, s: 'amber', er: 26 } },
    impact: { lives: 3100, min: 520, inc: 34, co2: 12 },
  },
];

/* ── Pre-compute cumulative zone states for every step ───────────── */
function buildStates() {
  const out = [];
  const cur = {};
  Object.keys(INIT).forEach(k => { cur[Number(k)] = { ...INIT[k] }; });
  for (const step of STEPS) {
    Object.entries(step.patches).forEach(([id, patch]) => {
      const n = Number(id);
      cur[n] = { ...cur[n], ...patch };
    });
    const snap = {};
    Object.keys(cur).forEach(k => { snap[Number(k)] = { ...cur[Number(k)] }; });
    out.push(snap);
  }
  return out;
}
const ZONE_STATES = buildStates();

/* ── Helpers ─────────────────────────────────────────────────────── */
const STATUS_COLOR = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' };
function sc(s) { return STATUS_COLOR[s] || '#22c55e'; }
function circleR(ic) { return Math.max(16, Math.min(38, 16 + (ic || 0) * 1.8)); }

/* ══════════════════════════════════════════════════════════════════
   Main DemoMode component
══════════════════════════════════════════════════════════════════ */
export default function DemoMode({ onEnd }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [zones, setZones]     = useState(ZONE_STATES[0]);
  const [narration, setNarration] = useState('');
  const [activeSug, setActiveSug] = useState(null);
  const [sugCd, setSugCd]     = useState(3);
  const [auditLog, setAuditLog] = useState([]);
  const [impact, setImpact]   = useState(STEPS[0].impact);
  const [mutualAid, setMutualAid] = useState(false);
  const [done, setDone]       = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [forecast, setForecast] = useState([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [selZone, setSelZone] = useState(null);

  const typingTimer = useRef(null);
  const cdTimer     = useRef(null);

  /* Wall clock */
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* Auto-advance: 5 s real = 5 sim minutes */
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => {
      setStepIdx(prev => {
        if (prev >= STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [done]);

  /* Trigger done after final step */
  useEffect(() => {
    if (stepIdx < STEPS.length - 1) return;
    const t = setTimeout(() => setDone(true), 6500);
    return () => clearTimeout(t);
  }, [stepIdx]);

  /* Apply step data */
  useEffect(() => {
    const step = STEPS[stepIdx];
    if (!step) return;

    setZones(ZONE_STATES[stepIdx]);
    setImpact(step.impact);
    setMutualAid(step.mutualAid);

    /* Typewriter */
    clearInterval(typingTimer.current);
    let i = 0;
    setNarration('');
    typingTimer.current = setInterval(() => {
      i++;
      setNarration(step.narration.slice(0, i));
      if (i >= step.narration.length) clearInterval(typingTimer.current);
    }, 18);

    /* Suggestion with 3-sec countdown */
    if (step.suggestion) {
      setActiveSug({ ...step.suggestion, accepted: false });
      setSugCd(3);
      clearInterval(cdTimer.current);
      let cd = 3;
      cdTimer.current = setInterval(() => {
        cd--;
        setSugCd(cd);
        if (cd <= 0) {
          clearInterval(cdTimer.current);
          setActiveSug(s => s ? { ...s, accepted: true } : null);
          setTimeout(() => setActiveSug(null), 2200);
        }
      }, 1000);
    }

    /* Audit */
    if (step.audit) setAuditLog(p => [step.audit, ...p]);

    /* Forecast data */
    const zs = ZONE_STATES[stepIdx];
    const avg = Math.round(Object.values(zs).reduce((a, z) => a + z.p, 0) / 12);
    setForecast(p => [...p, { t: stepIdx * 5, b: zs[2].p, btm: zs[12].p, ind: zs[5].p, avg }]);
  }, [stepIdx]);

  /* Cleanup */
  useEffect(() => () => {
    clearInterval(typingTimer.current);
    clearInterval(cdTimer.current);
  }, []);

  const handleReplay = useCallback(() => {
    clearInterval(typingTimer.current);
    clearInterval(cdTimer.current);
    setStepIdx(0); setZones(ZONE_STATES[0]); setNarration('');
    setActiveSug(null); setAuditLog([]); setImpact(STEPS[0].impact);
    setMutualAid(false); setDone(false); setElapsed(0);
    setForecast([]); setSelZone(null);
  }, []);

  const worstStatus = Object.values(zones).some(z => z.s === 'red') ? 'red'
    : Object.values(zones).some(z => z.s === 'amber') ? 'amber' : 'green';
  const redCount = Object.values(zones).filter(z => z.s === 'red').length;

  if (done) return <DemoComplete onReplay={handleReplay} onEnd={onEnd} />;

  return (
    <div className="fixed inset-0 z-[5000] bg-[#060D1A] flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
      <TopBanner label={STEPS[stepIdx]?.label} elapsed={elapsed} redCount={redCount} onEnd={onEnd} />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Audit log */}
        <AuditPanel log={auditLog} open={auditOpen} onToggle={() => setAuditOpen(o => !o)} />

        {/* Center: Map + Forecast */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 p-2">
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/10">
            <DemoMap zones={zones} selZone={selZone} onZoneClick={id => setSelZone(id === selZone ? null : id)} />
          </div>
          <div className="h-[148px] shrink-0 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
            <ForecastChart data={forecast} />
          </div>
        </div>

        {/* Right: metrics + suggestion + narration */}
        <div className="w-[295px] shrink-0 flex flex-col gap-2 p-2 overflow-y-auto">
          <ImpactTicker impact={impact} />
          <AnimatePresence>
            {activeSug && <SuggestionCard key={activeSug.id} sug={activeSug} cd={sugCd} />}
          </AnimatePresence>
          <NarrationPanel text={narration} status={worstStatus} label={STEPS[stepIdx]?.label} />
          <AnimatePresence>
            {selZone && (
              <ZoneDetail key={selZone} zoneId={selZone} zones={zones} onClose={() => setSelZone(null)} />
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {mutualAid && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 26, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="shrink-0 bg-[#7B61FF] flex items-center justify-center text-white text-xs font-mono gap-4 overflow-hidden"
          >
            <span className="animate-pulse">⚡</span>
            MUTUAL AID ACTIVE — 5 Mysuru District units en route to Bengaluru
            <span className="animate-pulse">⚡</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── TopBanner ────────────────────────────────────────────────────── */
function TopBanner({ label, elapsed, redCount, onEnd }) {
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return (
    <div className="h-11 shrink-0 bg-[#0A1525] border-b border-white/10 flex items-center px-4 gap-3">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      <span className="text-white font-mono text-sm font-bold shrink-0">LIVE SIMULATION</span>
      <span className="text-white/30 font-mono text-sm shrink-0">—</span>
      <span className="text-[#f59e0b] font-mono text-sm font-semibold truncate">
        Bellandur Flash Flood · Bengaluru · 19:00 Peak Hour
      </span>
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {redCount > 0 && (
          <span className="text-red-400 font-mono text-xs font-bold bg-red-500/15 px-2 py-0.5 rounded border border-red-500/30">
            {redCount} RED ZONE{redCount > 1 ? 'S' : ''}
          </span>
        )}
        <span className="text-[#f59e0b] font-mono text-sm font-bold">{label}</span>
        <span className="text-white/25 font-mono text-xs">{mm}:{ss}</span>
        <button
          onClick={onEnd}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-mono rounded border border-white/20 transition-colors"
        >
          ■ End Demo
        </button>
      </div>
    </div>
  );
}

/* ── NarrationPanel ───────────────────────────────────────────────── */
function NarrationPanel({ text, status, label }) {
  const col = sc(status);
  return (
    <div className="rounded-xl border p-3 bg-white/[0.04] flex-shrink-0" style={{ borderColor: col + '40' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0" style={{ background: col + '22' }}>🤖</div>
        <span className="text-[9px] font-mono uppercase tracking-widest truncate" style={{ color: col }}>AI Dispatch Coordinator</span>
        <span className="ml-auto text-[9px] font-mono text-white/20 shrink-0">{label}</span>
      </div>
      <p className="text-white/85 text-[12px] leading-relaxed min-h-[60px]">
        {text}<span className="opacity-50 animate-pulse">▌</span>
      </p>
    </div>
  );
}

/* ── SuggestionCard ───────────────────────────────────────────────── */
function SuggestionCard({ sug, cd }) {
  const circ = 2 * Math.PI * 13;
  const filled = ((3 - Math.max(cd, 0)) / 3) * circ;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl border p-3 shrink-0"
      style={{
        borderColor: sug.accepted ? '#22c55e60' : '#1A73E860',
        background: sug.accepted ? 'rgba(34,197,94,0.06)' : 'rgba(26,115,232,0.06)',
      }}
    >
      {sug.accepted ? (
        <div className="flex items-center gap-3">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xl">✓</motion.span>
          <div>
            <div className="text-[#22c55e] font-bold text-sm">Dispatched</div>
            <div className="text-white/50 text-xs">{sug.units} {sug.res} · ETA 8 min</div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-[#1A73E8] uppercase tracking-widest">AI Suggestion</span>
            <div className="relative w-8 h-8 shrink-0">
              <svg width="32" height="32" className="-rotate-90">
                <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(26,115,232,0.18)" strokeWidth="3" />
                <circle cx="16" cy="16" r="13" fill="none" stroke="#1A73E8" strokeWidth="3"
                  strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#1A73E8] font-bold text-xs">
                {Math.max(cd, 0)}
              </span>
            </div>
          </div>
          <div className="text-white font-semibold text-sm">Move {sug.units} {sug.res}</div>
          <div className="text-[#60a5fa] text-xs mt-0.5">{sug.from} → {sug.to}</div>
          <div className="text-white/30 text-[10px] mt-1 italic leading-tight">{sug.reason}</div>
          <div className="mt-2.5 flex gap-2">
            <div className="flex-1 h-7 rounded-lg bg-[#1A73E8]/20 border border-[#1A73E8]/30 flex items-center justify-center text-[#1A73E8] text-[11px] font-semibold">✓ Accept</div>
            <div className="flex-1 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/25 text-[11px]">✗ Dismiss</div>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ── ImpactTicker ─────────────────────────────────────────────────── */
function ImpactTicker({ impact }) {
  const rows = [
    { icon: '❤️', label: 'Lives Impacted', val: impact.lives.toLocaleString(), col: '#22c55e' },
    { icon: '⚡', label: 'Min Saved',      val: impact.min.toLocaleString(),   col: '#60a5fa' },
    { icon: '📋', label: 'Incidents',      val: impact.inc,                    col: '#f59e0b' },
    { icon: '🌱', label: 'CO₂ Avoided',    val: `${impact.co2}kg`,             col: '#a78bfa' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 shrink-0">
      {rows.map(r => (
        <div key={r.label} className="rounded-lg bg-white/[0.04] border border-white/10 px-2 py-1.5">
          <div className="text-[11px]">{r.icon}</div>
          <motion.div key={r.val} initial={{ opacity: 0.3, y: 3 }} animate={{ opacity: 1, y: 0 }}
            className="text-[17px] font-mono font-bold leading-none mt-0.5" style={{ color: r.col }}>
            {r.val}
          </motion.div>
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-wider mt-0.5">{r.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── AuditPanel ───────────────────────────────────────────────────── */
function AuditPanel({ log, open, onToggle }) {
  return (
    <div
      className="shrink-0 flex flex-col border-r border-white/10 overflow-hidden"
      style={{ width: open ? 232 : 36, transition: 'width 0.25s ease' }}
    >
      <button
        onClick={onToggle}
        className="h-9 w-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border-b border-white/10 text-white/40 text-xs relative shrink-0 transition-colors"
      >
        {open ? '◀' : '▶'}
        {!open && log.length > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#1A73E8] rounded-full flex items-center justify-center text-white text-[8px] font-bold">
            {log.length}
          </span>
        )}
      </button>
      {open && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest px-1 mb-1">Audit Log</div>
          <AnimatePresence initial={false}>
            {log.map((e, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-white/[0.04] border border-white/10 p-2">
                <div className="text-[9px] font-mono text-white/25">{e.time}</div>
                <div className="text-[11px] text-white/80 font-semibold mt-0.5">{e.action}</div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{e.detail}</div>
                <div className="text-[10px] text-[#22c55e] mt-0.5">{e.outcome}</div>
              </motion.div>
            ))}
          </AnimatePresence>
          {log.length === 0 && (
            <div className="text-white/15 text-[10px] text-center py-6 font-mono">No actions yet</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ForecastChart (Recharts) ─────────────────────────────────────── */
function ForecastChart({ data }) {
  if (data.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-white/20 font-mono text-xs">Collecting pressure data…</span>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col">
      <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">
        Pressure Forecast — T+0 to T+60 min  <span className="text-red-400/50 ml-2">--- 70 = critical</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} unit="m" />
            <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.4} />
            <RechartTooltip
              contentStyle={{ background: '#0B1628', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11 }}
              labelFormatter={v => `T+${v}min`}
              itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
            />
            <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }} />
            <Line type="monotone" dataKey="b"   name="Bellandur"   stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="btm" name="BTM Layout"   stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="ind" name="Indiranagar"  stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" name="City Avg"     stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── DemoMap ──────────────────────────────────────────────────────── */
function DemoMap({ zones, selZone, onZoneClick }) {
  return (
    <MapContainer center={[12.955, 77.645]} zoom={11} className="h-full w-full" zoomControl={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
      />
      {ZONE_META.map(zm => {
        const z = zones[zm.id];
        if (!z) return null;
        const col = sc(z.s);
        const r = circleR(z.ic);
        const isSel = selZone === zm.id;
        const isRed = z.s === 'red';
        return (
          <CircleMarker
            key={zm.id}
            center={[zm.lat, zm.lng]}
            radius={isSel ? r + 6 : r}
            pathOptions={{
              fillColor: col,
              fillOpacity: isRed ? 0.72 : isSel ? 0.65 : 0.45,
              color: isSel ? '#fff' : col,
              weight: isSel ? 2.5 : isRed ? 2 : 1.5,
              opacity: 0.9,
            }}
            eventHandlers={{ click: () => onZoneClick(zm.id) }}
          >
            <LeafletTooltip direction="top" opacity={1}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, minWidth: 155 }}>
                <strong style={{ color: col }}>{zm.name}</strong><br />
                Pressure: {z.p} &nbsp;|&nbsp; Status: <strong style={{ color: col }}>{z.s.toUpperCase()}</strong><br />
                ER Wait: {z.er} min &nbsp;|&nbsp; Rain: {z.rain} mm/hr<br />
                Ambulances: {z.aa} avail / {z.ad} deployed<br />
                Active incidents: {z.ic} &nbsp;|&nbsp; Volunteers: {z.vol}
              </div>
            </LeafletTooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

/* ── ZoneDetail ───────────────────────────────────────────────────── */
function ZoneDetail({ zoneId, zones, onClose }) {
  const zm = ZONE_META.find(z => z.id === zoneId);
  const z  = zones[zoneId];
  if (!zm || !z) return null;
  const col = sc(z.s);
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
      className="rounded-xl border bg-[#0B1628]/90 p-3 backdrop-blur-sm shrink-0"
      style={{ borderColor: col + '50' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-white text-sm">{zm.name}</span>
        <button onClick={onClose} className="text-white/25 hover:text-white/60 text-sm leading-none ml-2">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {[
          ['Pressure', `${z.p}/100`, col],
          ['Status', z.s.toUpperCase(), col],
          ['ER Wait', `${z.er} min`, '#f59e0b'],
          ['Rainfall', `${z.rain} mm/hr`, '#60a5fa'],
          ['Ambulances', `${z.aa}/${z.aa + z.ad}`, '#22c55e'],
          ['Incidents', z.ic, '#ef4444'],
          ['Volunteers', z.vol, '#a78bfa'],
        ].map(([k, v, c]) => (
          <div key={k} className="flex justify-between py-0.5 border-b border-white/[0.05]">
            <span className="text-white/30">{k}</span>
            <span className="font-mono font-semibold" style={{ color: c }}>{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── DemoComplete ─────────────────────────────────────────────────── */
function DemoComplete({ onReplay, onEnd }) {
  const stats = [
    { label: 'Peak Pressure',   val: '83',       sub: 'Bellandur · T+30',        col: '#ef4444' },
    { label: 'Zones Rescued',   val: '3',         sub: 'Red → Amber',             col: '#22c55e' },
    { label: 'AI Suggestions',  val: '8',         sub: '7 accepted · 1 dismissed', col: '#60a5fa' },
    { label: 'Response Gain',   val: '520 min',   sub: 'saved vs reactive',       col: '#f59e0b' },
    { label: 'Mutual Aid',      val: '1 request', sub: 'Mysuru → Bengaluru',      col: '#a78bfa' },
    { label: 'Ambulance Util.', val: '87%',       sub: 'peak utilization',        col: '#22c55e' },
  ];
  return (
    <div className="fixed inset-0 z-[6000] bg-[#030810] flex flex-col items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl w-full text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-5xl mb-5">✅</motion.div>
        <h1 className="text-[30px] md:text-[38px] font-extrabold text-white mb-2 leading-tight">
          Crisis Contained in 60 Minutes
        </h1>
        <p className="text-white/35 font-mono text-sm mb-8">
          Bellandur Flash Flood Scenario — TriageFlow AI Demo Complete
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 text-left">
          {stats.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
              className="bg-white/[0.05] rounded-xl border border-white/10 p-4"
            >
              <div className="text-[22px] font-mono font-extrabold" style={{ color: s.col }}>{s.val}</div>
              <div className="text-white/70 font-semibold text-sm mt-1">{s.label}</div>
              <div className="text-white/30 text-xs mt-0.5">{s.sub}</div>
            </motion.div>
          ))}
        </div>

        <div className="mb-6 text-center text-white/25 font-mono text-xs">
          Avg response improvement vs reactive baseline: <span className="text-[#22c55e]">38% faster</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={onReplay}
            className="min-w-[180px] h-12 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold border border-white/15 transition-colors text-sm">
            ↺ Replay Demo
          </button>
          <button onClick={onEnd}
            className="min-w-[200px] h-12 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-bold transition-colors text-sm shadow-lg">
            → Explore Live Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
