import React from 'react';
import { motion } from 'framer-motion';

export default function LandingOverlay({ onStartDashboard, onRunDemo, feedbackSummary }) {
  const liveDemoUrl = import.meta.env.VITE_LIVE_DEMO_URL || 'https://your-live-demo-url.web.app';
  return (
    <motion.div className="fixed inset-0 z-[4000] bg-[#0A0C10] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="text-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="font-mono-data text-[52px] font-bold tracking-[0.05em] text-[#D4D8E0]"
        >
          TriageFlow
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} className="text-[#6B7280] mt-4 mb-10 font-mono-data tracking-widest text-[13px] uppercase">
          Predict the crisis. Not just respond to it.
        </motion.p>
        {feedbackSummary?.total_testers > 0 && (
          <div className="inline-block mb-6 px-4 py-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[#141720] text-[#6B7280] text-xs font-mono-data">
            {feedbackSummary.total_testers} testers, {feedbackSummary.trust_yes_percent}% would trust
          </div>
        )}
        <p className="text-sm text-[#8ab4f8] mb-6">
          Live demo: <a className="underline" href={liveDemoUrl} target="_blank" rel="noreferrer">{liveDemoUrl}</a>
        </p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.45 }} className="flex items-center justify-center gap-4">
          <button
            onClick={onStartDashboard}
            className="bg-[#1E2A3A] border border-[#3B8BEB] text-[#3B8BEB] hover:bg-[#253547] transition-all duration-200 rounded-md px-6 py-3 font-medium"
          >
            Start Dashboard
          </button>
          <button
            onClick={onRunDemo}
            className="bg-[#1E1A10] border border-[#D4860A] text-[#D4860A] hover:bg-[#2A2213] transition-all duration-200 rounded-md px-6 py-3 font-medium"
          >
            Run Demo Scenario
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
