import { useMemo, useState } from 'react';
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
        className="w-10 h-10 rounded-full bg-white border border-[rgba(99,120,160,0.18)] hover:border-[rgba(26,115,232,0.35)] text-[#5F6B7C] hover:text-[#1A73E8] transition-all font-mono text-base font-bold shadow-sm flex items-center justify-center leading-none"
        aria-label="Open feedback"
      >
        ?
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/35 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[rgba(99,120,160,0.15)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#F8FAFF] border-b border-[rgba(99,120,160,0.12)] flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1C2B4A]">Quick Feedback</h3>
                <p className="text-[12px] text-[#5F6B7C] mt-0.5">
                  Help us improve the dashboard. Takes ~10 seconds.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-lg border border-[rgba(99,120,160,0.18)] text-[#5F6B7C] hover:bg-white hover:text-[#1C2B4A] flex items-center justify-center text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#9AA3B0]">
                  Session: {sessionId.replace('session_', '').slice(0, 10)}
                </div>
                <div className="text-[11px] font-mono text-[#5F6B7C]">
                  {(!clarity || !trust || !confusedMost) ? '3 questions' : 'Ready to submit'}
                </div>
              </div>

              <Question label="1. How clear was the flood warning?">
                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Radio
                      key={v}
                      name="clarity"
                      value={String(v)}
                      checked={clarity === String(v)}
                      onChange={setClarity}
                      label={'★'.repeat(v)}
                      tone={v <= 2 ? 'low' : v === 3 ? 'mid' : 'high'}
                    />
                  ))}
                </div>
              </Question>

              <Question label="2. Would you trust this system in a real emergency?">
                <div className="flex items-center gap-2 flex-wrap">
                  {['Yes', 'Maybe', 'No'].map((v) => (
                    <Radio key={v} name="trust" value={v} checked={trust === v} onChange={setTrust} label={v} />
                  ))}
                </div>
              </Question>

              <Question label="3. What confused you most?">
                <div className="flex items-center gap-2 flex-wrap">
                  {['Map colors', 'Suggestion cards', 'Nothing', 'Other'].map((v) => (
                    <Radio key={v} name="confused" value={v} checked={confusedMost === v} onChange={setConfusedMost} label={v} />
                  ))}
                </div>
              </Question>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-[12px] text-[#5F6B7C]">
                  {(!clarity || !trust || !confusedMost) ? 'Select one option for each question.' : 'Thanks — ready to submit.'}
                </div>
                <button
                  onClick={saveFeedback}
                  disabled={!clarity || !trust || !confusedMost}
                  className="px-4 py-2 rounded-xl bg-[#1A73E8] text-white font-bold text-sm hover:bg-[#1558B0] disabled:opacity-50 disabled:hover:bg-[#1A73E8] transition-colors"
                >
                  {saved ? 'Saved' : 'Submit'}
                </button>
              </div>

              {saved && (
                <div className="mt-3 rounded-xl border border-[rgba(30,142,110,0.25)] bg-[rgba(30,142,110,0.08)] px-3 py-2 text-sm text-[#1E8E6E] font-semibold">
                  ✓ Feedback saved. Thank you!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Question({ label, children }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-[#1C2B4A] mb-2">{label}</p>
      {children}
    </div>
  );
}

function Radio({ name, value, checked, onChange, label, tone }) {
  const tones = {
    low: 'border-[rgba(217,48,37,0.25)] bg-[rgba(217,48,37,0.06)] text-[#D93025]',
    mid: 'border-[rgba(227,116,0,0.28)] bg-[rgba(227,116,0,0.08)] text-[#E37400]',
    high: 'border-[rgba(30,142,110,0.28)] bg-[rgba(30,142,110,0.08)] text-[#1E8E6E]',
  };
  return (
    <label
      className={[
        'cursor-pointer select-none text-xs rounded-xl px-3 py-2 border transition-colors',
        'font-mono',
        checked
          ? (tones[tone] || 'border-[rgba(26,115,232,0.35)] bg-[#EEF3FF] text-[#1A73E8]')
          : 'bg-white border-[rgba(99,120,160,0.18)] text-[#5F6B7C] hover:bg-[#F8FAFF] hover:border-[rgba(26,115,232,0.22)]',
      ].join(' ')}
    >
      <input
        className="mr-2 accent-[#1A73E8]"
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
