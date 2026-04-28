import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const formatTimeAgo = (isoString) => {
  if (!isoString) return '';
  const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return 'A while ago';
};

export default function IncidentFeed({ incidents }) {
  // Sort most recent first
  const sortedIncidents = [...(incidents || [])].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[#e8e6e0] mb-3">Incident Feed</h2>
      <div className="bg-[#0F1218] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden mb-4">
        <div className="h-[220px] overflow-y-auto custom-scrollbar">
        <div className="space-y-2">
          <AnimatePresence>
          {sortedIncidents.map((inc) => (
            <motion.div
              key={inc.id}
              layout
              initial={{ opacity: 0, backgroundColor: 'rgba(0,194,255,0.15)' }}
              animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
              transition={{ duration: 0.8 }}
              className="flex justify-between items-center px-4 py-2.5 border-b border-white/5 hover:bg-white/3 transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-sm text-white/80">Zone <span className="font-mono-data">{inc.zone_id}</span> • {inc.type}</span>
                <span className="font-mono-data text-[10px] text-white/30">{formatTimeAgo(inc.timestamp)}</span>
              </div>
              <span 
                className={`text-[10px] font-mono-data px-2 py-0.5 rounded-sm ${
                  inc.severity === 'high'
                    ? 'bg-[#1E1414] text-[#C94040] border border-[#C94040]'
                    : inc.severity === 'medium'
                      ? 'bg-[#1E1A10] text-[#D4860A] border border-[#D4860A]'
                      : 'bg-[#101E18] text-[#2ECC8F] border border-[#2ECC8F]'
                }`}
              >
                {inc.severity}
              </span>
            </motion.div>
          ))}
          </AnimatePresence>
          {sortedIncidents.length === 0 && (
            <div className="text-center text-[#888780] text-sm py-4">No incidents</div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
