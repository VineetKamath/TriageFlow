import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { cn } from '../lib/utils';

export function Header({ critical = 0, pending = 0, deployed = 0, isLive = true }) {
  return (
    <header className="bg-white border-b border-[rgba(99,120,160,0.18)] border-t-[3px] border-t-[#1A73E8] h-16 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#1A73E8] rounded-md flex items-center justify-center">
          <Shield className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#1C2B4A]">
          TriageFlow
          <span className="ml-2 text-[10px] uppercase font-mono bg-[#EEF3FF] text-[#1A73E8] px-1.5 py-0.5 rounded border border-[rgba(26,115,232,0.2)]">
            GDG Edition
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-6 h-full">
        <div className="flex items-center gap-4 h-full py-2">
          <StatCard label="Critical" value={critical} color="critical" />
          <StatCard label="Pending" value={pending} color="warning" />
          <StatCard label="Deployed" value={deployed} color="active" />
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-[#F8FAFF] rounded-full border border-[rgba(99,120,160,0.15)] md:flex hidden">
          <motion.div
            animate={{ opacity: isLive ? [1, 0.4, 1] : 1 }}
            transition={isLive ? { repeat: Infinity, duration: 2 } : undefined}
            className={cn(
              'w-2 h-2 rounded-full shadow-[0_0_0_3px_rgba(30,142,110,0.2)]',
              isLive ? 'bg-[#1E8E6E]' : 'bg-[#D93025] shadow-[0_0_0_3px_rgba(217,48,37,0.18)]'
            )}
          />
          <span className={cn('text-xs font-medium uppercase tracking-wider', isLive ? 'text-[#1E8E6E]' : 'text-[#D93025]')}>
            {isLive ? 'System Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    critical: 'border-b-[#D93025] text-[#D93025]',
    warning: 'border-b-[#E37400] text-[#E37400]',
    active: 'border-b-[#1A73E8] text-[#1A73E8]',
  };

  return (
    <div
      className={cn(
        'border-b-2 px-3 bg-white h-full flex flex-col justify-center rounded-t shadow-[0_1px_4px_rgba(26,115,232,0.10)] min-w-[80px]',
        colors[color] || colors.active
      )}
    >
      <span className="text-[10px] font-mono text-[#5F6B7C] uppercase">{label}</span>
      <motion.span
        key={value}
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-lg font-mono font-bold leading-none mt-0.5"
      >
        {String(value).padStart(2, '0')}
      </motion.span>
    </div>
  );
}

