import { useState, useEffect } from 'react';
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
    ? 'border-l-[3px] border-l-[#D93025]'
    : elapsed >= 30
      ? 'border-l-[3px] border-l-[#E37400]'
      : 'border-l-[3px] border-l-[#1E8E6E]';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={{ scale: 1.01 }}
      className={`bg-white border border-[rgba(99,120,160,0.15)] rounded-xl p-3 mb-2 transition-colors ${animationClass} overflow-hidden ${urgencyClass} shadow-sm`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[#1C2B4A] font-semibold">
          Move {s.unit_ids.length} units: → {zoneName || `Zone ${s.zone_id}`}
        </h3>
        <span className={`font-mono text-xs ${isUrgent ? 'text-[#D93025] font-bold' : 'text-[#5F6B7C]'}`}>
          {formatTimeAgo(elapsed)}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {s.explanation && s.explanation.map((reason, i) => (
          <span key={i} className="bg-[#F8FAFF] border border-[rgba(99,120,160,0.15)] text-[#5F6B7C] text-[11px] px-2 py-1 rounded font-mono">
            {reason}
          </span>
        ))}
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={handleAccept}
          disabled={isAccepting}
          className="flex-1 bg-[#E6F4EA] border border-[rgba(30,142,110,0.35)] text-[#1E8E6E] hover:bg-[#DDF3E7] active:scale-95 transition-all duration-150 rounded-md py-1 text-xs h-7 disabled:opacity-50 font-semibold"
        >
          {isAccepting ? 'Accepted' : 'Accept'}
        </button>
        <button 
          onClick={() => onDismiss(s.id)}
          disabled={isAccepting}
          className="flex-1 bg-white border border-[rgba(99,120,160,0.20)] text-[#5F6B7C] hover:border-[rgba(26,115,232,0.35)] hover:text-[#1A73E8] rounded-md py-1 text-xs h-7 transition-all disabled:opacity-50 font-semibold"
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
      <div className="bg-white border border-[rgba(99,120,160,0.15)] rounded-xl h-16 flex items-center justify-center gap-2 text-[#1E8E6E] text-[11px] font-mono uppercase tracking-widest">
        <span className="w-2 h-2 rounded-full bg-[#1E8E6E]" />
        <span className="text-[#5F6B7C]">System Nominal</span>
      </div>
    );
  }

  return (
    <div className={`min-h-0 flex flex-col ${hasRedZone ? 'ring-1 ring-[#D93025]/30 rounded-xl p-2 bg-[#FEE8E7]/30' : ''}`}>
      <h2 className="text-sm font-bold text-[#1C2B4A] mb-2 px-1">Suggestion Queue</h2>
      <AnimatePresence mode="popLayout">
        <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: '40vh' }}>
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
          0% { background-color: #fff; max-height: 220px; opacity: 1; }
          20% { background-color: rgba(30, 142, 110, 0.15); max-height: 220px; opacity: 1; }
          60% { background-color: rgba(30, 142, 110, 0.12); max-height: 220px; opacity: 1; margin-bottom: 0.75rem; padding: 1rem; }
          100% { background-color: rgba(30, 142, 110, 0); max-height: 0px; opacity: 0; margin-bottom: 0; padding: 0; border-width: 0; }
        }
        
        .shake-animation {
          animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
          animation-iteration-count: 3;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}
