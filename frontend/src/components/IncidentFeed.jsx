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
    <div className="h-full flex flex-col min-h-0">
      <h2 className="text-lg font-bold text-[#1C2B4A] mb-3">Incident Feed</h2>
      <div className="bg-white border border-[rgba(99,120,160,0.15)] rounded-xl overflow-hidden shadow-sm flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0 max-h-[200px]">
        <div className="space-y-0">
          <AnimatePresence>
          {sortedIncidents.map((inc) => (
            <motion.div
              key={inc.id}
              layout
              initial={{ opacity: 0, backgroundColor: 'rgba(26,115,232,0.08)' }}
              animate={{ opacity: 1, backgroundColor: 'rgba(255,255,255,0)' }}
              transition={{ duration: 0.8 }}
              className="flex justify-between items-center px-4 py-2.5 border-b border-[rgba(99,120,160,0.12)] hover:bg-[#F8FAFF] transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-sm text-[#1C2B4A]">
                  Zone <span className="font-mono">{inc.zone_id}</span> • {inc.type}
                </span>
                <span className="font-mono text-[10px] text-[#9AA3B0]">{formatTimeAgo(inc.timestamp)}</span>
              </div>
              <span 
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                  inc.severity === 'high'
                    ? 'bg-[#FEE8E7] text-[#D93025] border border-[rgba(217,48,37,0.35)]'
                    : inc.severity === 'medium'
                      ? 'bg-[#FFF3E0] text-[#E37400] border border-[rgba(227,116,0,0.35)]'
                      : 'bg-[#E6F4EA] text-[#1E8E6E] border border-[rgba(30,142,110,0.35)]'
                }`}
              >
                {inc.severity}
              </span>
            </motion.div>
          ))}
          </AnimatePresence>
          {sortedIncidents.length === 0 && (
            <div className="text-center text-[#5F6B7C] font-mono text-xs py-10">No incidents</div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
