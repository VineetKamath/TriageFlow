import { useMemo } from 'react';

export default function EfficiencyGauge({ score = 0 }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));

  const color = s < 40 ? '#D93025' : s < 70 ? '#E37400' : '#1E8E6E';

  const { dFill, dTrack } = useMemo(() => {
    const cx = 40;
    const cy = 44;
    const r = 30;
    const startAngle = (210 * Math.PI) / 180;
    const endAngle = ((210 + 210 * (s / 100)) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const xEndTrack = cx + r * Math.cos((420 * Math.PI) / 180);
    const yEndTrack = cy + r * Math.sin((420 * Math.PI) / 180);

    const largeArc = s > 50 ? 1 : 0;

    const dTrack = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xEndTrack} ${yEndTrack}`;
    const dFill = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

    return { dFill, dTrack };
  }, [s]);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="80" height="50" viewBox="0 0 80 50">
        <path d={dTrack} fill="none" stroke="rgba(99,120,160,0.18)" strokeWidth="6" strokeLinecap="round" />
        <path d={dFill} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        <text x="40" y="36" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="800" fill="#1C2B4A">
          {Math.round(s)}%
        </text>
      </svg>
      <div className="text-[10px] font-mono tracking-widest text-[#5F6B7C] -mt-1">Efficiency</div>
    </div>
  );
}

