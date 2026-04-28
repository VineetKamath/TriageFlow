import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { onValue, ref } from 'firebase/database';
import { db } from '../firebase';

const formatTimeAgo = (isoString) => {
  if (!isoString) return '';
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
};

export default function PostCrisisReviewPanel({ isOpen, onClose, zones = [] }) {
  const [records, setRecords] = useState([]);
  const [firebaseAvailable, setFirebaseAvailable] = useState(Boolean(db));

  useEffect(() => {
    if (!isOpen || !db) {
      return;
    }
    const auditRef = ref(db, '/audit_log');
    const unsubscribe = onValue(
      auditRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const rows = Object.entries(data).map(([id, entry]) => ({
          id,
          ...entry,
        }));
        setRecords(rows);
      },
      (error) => {
        console.error('Failed to read Firebase audit log', error);
        setFirebaseAvailable(false);
      }
    );
    return () => unsubscribe();
  }, [isOpen]);

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      ),
    [records]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="fixed top-0 right-0 h-full w-[420px] z-[3000] bg-white border-l border-[rgba(99,120,160,0.18)] shadow-[-20px_0_60px_rgba(0,0,0,0.12)] p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F6B7C]">Post-Crisis Review</h2>
        <button
          onClick={onClose}
          className="text-[#9AA3B0] hover:text-[#1C2B4A] text-2xl font-bold leading-none"
        >
          &times;
        </button>
      </div>
      <p className="font-mono text-xs text-[#5F6B7C] mb-4">Source: Firebase Realtime Database</p>

      {!firebaseAvailable && (
        <div className="bg-[#FEE8E7] border border-[rgba(217,48,37,0.35)] rounded p-3 text-sm text-[#D93025] mb-4">
          Firebase is not configured in frontend env variables.
        </div>
      )}

      <div className="space-y-2">
        {sortedRecords.map((item) => {
          const zoneName = zones.find((z) => z.id === item.zone)?.name || `Zone ${item.zone}`;
          return (
            <div key={item.id} className="bg-[#F8FAFF] border border-[rgba(99,120,160,0.15)] hover:bg-[#EEF3FF] rounded-lg p-3">
              <div className="flex justify-between items-start gap-3">
                <p className="text-sm text-[#1C2B4A] font-semibold">
                  {item.action} • {zoneName}
                </p>
                <span className="font-mono text-[11px] text-[#9AA3B0]">{formatTimeAgo(item.timestamp)}</span>
              </div>
              <p className="font-mono text-xs text-[#5F6B7C] mt-1">
                Units moved: {item.units_moved ?? 0} | Pressure: {item.pressure_score_at_time ?? 0}
              </p>
            </div>
          );
        })}
        {sortedRecords.length === 0 && (
          <div className="text-sm text-[#5F6B7C] text-center py-8 font-mono">
            No persisted audit entries yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}
