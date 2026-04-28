import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const formatTimeAgo = (seconds) => {
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
};

function SuggestionCard({ s, onAccept, onDismiss, zoneName }) {
  const [elapsed, setElapsed] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const start = new Date(s.created_at).getTime();
    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [s.created_at]);

  const handleAccept = () => {
    setIsAccepting(true);
    setTimeout(() => {
      onAccept(s.id);
    }, 800); // Wait for flash (500ms) and collapse (300ms)
  };

  const isUrgent = elapsed > 60;
  let animationClass = 'animate-[slideIn_0.2s_ease-out]';
  if (isAccepting) {
    animationClass = 'animate-[acceptCollapse_0.8s_ease-out_forwards]';
  } else if (isUrgent) {
    // We only want it to shake occasionally or just when it hits 60s, but a constant shake might be annoying.
    // CSS will handle it if we apply the shake class.
    animationClass = 'shake-animation';
  }

  const urgencyClass = elapsed > 60
    ? 'border-l-[3px] border-l-[#C94040]'
    : elapsed >= 30
      ? 'border-l-[3px] border-l-[#D4860A]'
      : 'border-l-[3px] border-l-[#2ECC8F]';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={{ scale: 1.01 }}
      className={`bg-[#141720] border border-[rgba(255,255,255,0.07)] rounded-xl p-4 mb-3 transition-colors ${animationClass} overflow-hidden ${urgencyClass}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[#e8e6e0] font-medium">Move {s.unit_ids.length} units: → {zoneName || `Zone ${s.zone_id}`}</h3>
        <span className={`font-mono-data text-xs ${isUrgent ? 'text-[#C94040] font-bold' : 'text-[#6B7280]'}`}>
          {formatTimeAgo(elapsed)}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {s.explanation && s.explanation.map((reason, i) => (
          <span key={i} className="bg-white/5 border border-white/10 text-white/70 text-xs px-2 py-1 rounded">
            {reason}
          </span>
        ))}
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={handleAccept}
          disabled={isAccepting}
          className="flex-1 bg-[#1A2B1F] border border-[#2ECC8F] text-[#2ECC8F] hover:bg-[#1E3324] active:scale-95 transition-all duration-150 rounded-md py-1.5 text-sm disabled:opacity-50"
        >
          {isAccepting ? 'Accepted' : 'Accept'}
        </button>
        <button 
          onClick={() => onDismiss(s.id)}
          disabled={isAccepting}
          className="flex-1 bg-transparent border border-[rgba(255,255,255,0.1)] text-[#6B7280] hover:border-[rgba(255,255,255,0.2)] hover:text-[#D4D8E0] rounded-md py-1.5 text-sm transition-all disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  );
}

export default function SuggestionQueue({ suggestions, zones, onAccept, onDismiss, hasRedZone }) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="bg-[#141720] border border-[rgba(255,255,255,0.07)] rounded-xl p-6 text-center text-[#6B7280] text-sm font-mono-data tracking-widest mb-4">
        System nominal — no action needed
      </div>
    );
  }

  return (
    <div className={`mb-4 transition-colors duration-1000 p-2 -mx-2 rounded ${hasRedZone ? 'border border-[#E24B4A] bg-[#E24B4A]/10' : 'border border-transparent'}`}>
      <h2 className="text-lg font-semibold text-[#e8e6e0] mb-3 px-2">Suggestion Queue</h2>
      <AnimatePresence mode="popLayout">
        <div className="space-y-1">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              onAccept={onAccept}
              onDismiss={onDismiss}
              zoneName={zones?.find((z) => z.id === s.zone_id)?.name}
            />
          ))}
        </div>
      </AnimatePresence>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes acceptCollapse {
          0% { background-color: #1a1d27; max-height: 200px; opacity: 1; }
          20% { background-color: rgba(29, 158, 117, 0.4); max-height: 200px; opacity: 1; }
          60% { background-color: rgba(29, 158, 117, 0.4); max-height: 200px; opacity: 1; margin-bottom: 0.75rem; padding: 1rem; }
          100% { background-color: rgba(29, 158, 117, 0); max-height: 0px; opacity: 0; margin-bottom: 0; padding: 0; border-width: 0; }
        }
        
        .shake-animation {
          animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
          animation-iteration-count: 3;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
