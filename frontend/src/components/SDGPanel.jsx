import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { onValue, ref } from 'firebase/database';
import { db } from '../firebase';

const nowString = () => new Date().toLocaleString();

export default function SDGPanel({
  isOpen,
  onClose,
  minutesSaved,
  zonesProtected,
  unitsOptimallyPositioned,
  zones = [],
}) {
  const [auditRecords, setAuditRecords] = useState([]);
  const [firebaseAvailable, setFirebaseAvailable] = useState(Boolean(db));

  useEffect(() => {
    if (!isOpen || !db) return;
    const auditRef = ref(db, '/audit_log');
    const unsubscribe = onValue(
      auditRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const rows = Object.entries(data).map(([id, entry]) => ({ id, ...entry }));
        setAuditRecords(rows);
      },
      (error) => {
        console.error('Failed to read Firebase audit log for SDG panel', error);
        setFirebaseAvailable(false);
      }
    );
    return () => unsubscribe();
  }, [isOpen]);

  const sortedAudit = useMemo(
    () =>
      [...auditRecords].sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      ),
    [auditRecords]
  );

  const downloadImpactReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('TriageFlow Impact Report', 14, 18);

    doc.setFontSize(10);
    doc.text(`Generated: ${nowString()}`, 14, 25);
    doc.text('Aligned with UN SDG 11 and SDG 3', 14, 31);

    doc.setFontSize(12);
    doc.text('Session Metrics', 14, 42);
    doc.setFontSize(10);
    doc.text(`Estimated minutes saved: ${minutesSaved}`, 14, 49);
    doc.text(`Zones protected from critical overload: ${zonesProtected}`, 14, 55);
    doc.text(`Units optimally positioned: ${unitsOptimallyPositioned}`, 14, 61);

    doc.setFontSize(12);
    doc.text('Audit Log', 14, 73);

    const startY = 79;
    const rowHeight = 7;
    const xCols = [14, 54, 102, 137, 171];
    doc.setFontSize(9);
    doc.text('Time', xCols[0], startY);
    doc.text('Action', xCols[1], startY);
    doc.text('Zone', xCols[2], startY);
    doc.text('Units', xCols[3], startY);
    doc.text('Pressure', xCols[4], startY);
    doc.line(14, startY + 1, 196, startY + 1);

    let y = startY + rowHeight;
    const rows = sortedAudit.slice(0, 22);
    rows.forEach((item) => {
      if (y > 280) return;
      const zoneName = zones.find((z) => z.id === item.zone)?.name || `Zone ${item.zone ?? '-'}`;
      const ts = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '-';
      doc.text(String(ts), xCols[0], y);
      doc.text(String(item.action ?? '-'), xCols[1], y);
      doc.text(String(zoneName), xCols[2], y);
      doc.text(String(item.units_moved ?? 0), xCols[3], y);
      doc.text(String(item.pressure_score_at_time ?? 0), xCols[4], y);
      y += rowHeight;
    });

    if (sortedAudit.length > rows.length) {
      doc.text(`... and ${sortedAudit.length - rows.length} more records`, 14, Math.min(y + 4, 286));
    }

    doc.save('triageflow-impact-report.pdf');
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="fixed top-0 right-0 h-full w-[420px] z-[3000] bg-white border-l border-[rgba(99,120,160,0.18)] shadow-[-20px_0_60px_rgba(0,0,0,0.12)] p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F6B7C]">Impact</h2>
        <button
          onClick={onClose}
          className="text-[#9AA3B0] hover:text-[#1C2B4A] text-2xl font-bold leading-none"
        >
          &times;
        </button>
      </div>

      <p className="text-sm text-[#1C2B4A] mb-4 font-mono">
        Aligned with UN SDG 11 (Sustainable Cities) and SDG 3 (Good Health)
      </p>

      <div className="space-y-3 mb-5">
        <Metric label="Estimated minutes saved this session" value={minutesSaved} />
        <Metric label="Zones protected from critical overload" value={zonesProtected} />
        <Metric label="Units optimally positioned" value={unitsOptimallyPositioned} />
      </div>

      <blockquote className="border-l-2 border-[rgba(99,120,160,0.6)] pl-3 text-sm text-[#5F6B7C] mb-5 font-mono">
        "Make cities inclusive, safe, resilient, and sustainable."
      </blockquote>

      {!firebaseAvailable && (
        <p className="text-xs text-[#D93025] mb-3 font-mono">
          Firebase not configured. Report will include current metrics only.
        </p>
      )}

      <button
        onClick={downloadImpactReport}
        className="w-full border border-[rgba(26,115,232,0.35)] text-[#1A73E8] hover:bg-[#EEF3FF] font-mono transition-all px-4 py-2 rounded-lg"
      >
        Download Impact Report
      </button>
    </motion.div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-[#F8FAFF] border border-[rgba(99,120,160,0.15)] rounded-xl p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[#5F6B7C]">{label}</p>
      <p className="font-mono text-3xl font-bold text-[#1C2B4A] mt-1">{value}</p>
    </div>
  );
}
