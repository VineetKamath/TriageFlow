import React, { useMemo, useState } from 'react';
import axios from 'axios';

const STORAGE_KEY = 'triageflow_feedback';
const SESSION_KEY = 'triageflow_session_id';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getStoredFeedback() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function FeedbackWidget() {
  const sessionId = useMemo(() => getSessionId(), []);
  const initial = useMemo(() => getStoredFeedback()[sessionId] || {}, [sessionId]);

  const [isOpen, setIsOpen] = useState(false);
  const [clarity, setClarity] = useState(initial.flood_warning_clarity || '');
  const [trust, setTrust] = useState(initial.trust_level || '');
  const [confusedMost, setConfusedMost] = useState(initial.confused_most || '');
  const [saved, setSaved] = useState(false);

  const saveFeedback = async () => {
    if (!clarity || !trust || !confusedMost) return;
    const payload = {
      session_id: sessionId,
      flood_warning_clarity: Number(clarity),
      trust_level: trust,
      confused_most: confusedMost,
    };
    try {
      const all = getStoredFeedback();
      all[sessionId] = payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      await axios.post(`${API_BASE_URL}/feedback`, payload);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setIsOpen(false);
      }, 900);
    } catch (e) {
      console.error('Failed to save feedback', e);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[2600] w-10 h-10 rounded-full bg-[#141720] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(59,139,235,0.5)] text-[#6B7280] hover:text-[#3B8BEB] transition-all font-mono-data text-lg font-bold"
        aria-label="Open feedback"
      >
        ?
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0A0C10] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[#e8e6e0]">Quick Feedback</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#888780] hover:text-[#e8e6e0] text-xl">&times;</button>
            </div>

            <Question label="1. How clear was the flood warning?">
              {[1, 2, 3, 4, 5].map((v) => (
                <Radio
                  key={v}
                  name="clarity"
                  value={String(v)}
                  checked={clarity === String(v)}
                  onChange={setClarity}
                  label={'★'.repeat(v)}
                />
              ))}
            </Question>

            <Question label="2. Would you trust this system in a real emergency?">
              {['Yes', 'Maybe', 'No'].map((v) => (
                <Radio key={v} name="trust" value={v} checked={trust === v} onChange={setTrust} label={v} />
              ))}
            </Question>

            <Question label="3. What confused you most?">
              {['Map colors', 'Suggestion cards', 'Nothing', 'Other'].map((v) => (
                <Radio key={v} name="confused" value={v} checked={confusedMost === v} onChange={setConfusedMost} label={v} />
              ))}
            </Question>

            <button
              onClick={saveFeedback}
              disabled={!clarity || !trust || !confusedMost}
              className="w-full mt-3 bg-[#1E2A3A] border border-[#3B8BEB] text-[#3B8BEB] hover:bg-[#253547] disabled:opacity-50 py-2 rounded transition-all"
            >
              {saved ? 'Saved' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Question({ label, children }) {
  return (
    <div className="mb-4">
      <p className="text-sm text-[#e8e6e0] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Radio({ name, value, checked, onChange, label }) {
  return (
    <label className="bg-[#141720] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(59,139,235,0.5)] hover:bg-[#1A1E28] text-[#6B7280] hover:text-[#3B8BEB] transition-all cursor-pointer font-mono-data text-xs rounded-lg px-3 py-2">
      <input
        className="mr-2"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.value)}
      />
      {label}
    </label>
  );
}
