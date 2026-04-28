import React, { useEffect, useMemo, useState } from 'react';
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
      className="fixed top-0 right-0 h-full w-[420px] z-[2100] bg-[#0F1218] border-l border-[rgba(255,255,255,0.07)] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-[#3D4454]">Post-Crisis Review</h2>
        <button
          onClick={onClose}
          className="text-[#888780] hover:text-[#e8e6e0] text-2xl font-bold leading-none"
        >
          &times;
        </button>
      </div>
      <p className="font-mono-data text-xs text-[#6B7280] mb-4">Source: Firebase Realtime Database</p>

      {!firebaseAvailable && (
        <div className="bg-[#2b1f1f] border border-[#5c2d2d] rounded p-3 text-sm text-[#f3c4c4] mb-4">
          Firebase is not configured in frontend env variables.
        </div>
      )}

      <div className="space-y-2">
        {sortedRecords.map((item) => {
          const zoneName = zones.find((z) => z.id === item.zone)?.name || `Zone ${item.zone}`;
          return (
            <div key={item.id} className="bg-[#141720] border border-[rgba(255,255,255,0.07)] hover:bg-[#1A1E28] rounded-lg p-3">
              <div className="flex justify-between items-start gap-3">
                <p className="text-sm text-[#D4D8E0] font-medium">
                  {item.action} • {zoneName}
                </p>
                <span className="font-mono-data text-[11px] text-[#888780]">{formatTimeAgo(item.timestamp)}</span>
              </div>
              <p className="font-mono-data text-xs text-white/60 mt-1">
                Units moved: {item.units_moved ?? 0} | Pressure: {item.pressure_score_at_time ?? 0}
              </p>
            </div>
          );
        })}
        {sortedRecords.length === 0 && (
          <div className="text-sm text-[#888780] text-center py-8">
            No persisted audit entries yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}
