import { useEffect, useMemo, useRef, useState } from 'react';

function Icon({ type }) {
  if (type === 'accepted') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#1E8E6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'dispatch') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h12" stroke="#1A73E8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M13 6l6 6-6 6" stroke="#1A73E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'incident') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3l10 18H2L12 3z"
          fill="rgba(227,116,0,0.18)"
          stroke="#E37400"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 9v5" stroke="#E37400" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 17h.01" stroke="#E37400" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // escalation
  return <div style={{ width: 10, height: 10, borderRadius: 999, background: '#D93025' }} />;
}

function fmt(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function LiveTimeline({ incidents, suggestions, acceptedCount }) {
  const [acceptedEvents, setAcceptedEvents] = useState([]);
  const prevAcceptedRef = useRef(Number(acceptedCount || 0));

  useEffect(() => {
    const cur = Number(acceptedCount || 0);
    const prev = Number(prevAcceptedRef.current || 0);
    if (cur > prev) {
      const add = cur - prev;
      const now = new Date().toISOString();
      // Defer state updates to avoid synchronous setState-in-effect lint.
      setTimeout(() => {
        setAcceptedEvents((prevList) => {
          const next = [...prevList];
          for (let i = 0; i < add; i++) {
            next.unshift({ id: `${now}_${i}`, text: 'Suggestion accepted • units dispatched', timestamp: now, type: 'accepted' });
          }
          return next.slice(0, 20);
        });
      }, 0);
    }
    prevAcceptedRef.current = cur;
  }, [acceptedCount]);

  const events = useMemo(() => {
    const inc = (incidents || []).slice(-10).map((i) => ({
      id: i.id,
      text: `${i.type} • Zone ${i.zone_id} (${i.severity})`,
      timestamp: i.timestamp,
      type: i.severity === 'critical' ? 'escalation' : 'incident',
    }));
    const sug = (suggestions || []).slice(0, 6).map((s) => ({
      id: s.id,
      text: `Suggestion pending • Zone ${s.zone_id}`,
      timestamp: s.created_at,
      type: 'dispatch',
    }));
    return [...acceptedEvents, ...inc, ...sug].slice(0, 24);
  }, [acceptedEvents, incidents, suggestions]);

  const loop = [...events, ...events];

  if (!events.length) return null;

  return (
    <div className="h-full w-full overflow-hidden">
      <style>
        {`@keyframes tfMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}
      </style>
      <div
        className="h-full flex items-center gap-2"
        style={{
          width: 'max-content',
          animation: 'tfMarquee 30s linear infinite',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {loop.map((ev, idx) => (
          <div
            key={`${ev.id}_${idx}`}
            className="flex items-center gap-2 rounded-full border border-[rgba(99,120,160,0.15)] bg-white"
            style={{
              height: 20,
              padding: '0 8px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: '#1C2B4A',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon type={ev.type} />
            <span>{ev.text}</span>
            <span style={{ color: '#5F6B7C' }}>{fmt(ev.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

