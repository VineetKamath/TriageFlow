import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function BrainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.4-4.3 3 3 0 0 1-1-4.46 3 3 0 0 1 1.5-5.47A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.4-4.3 3 3 0 0 0 1-4.46 3 3 0 0 0-1.5-5.47A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 0' }}>
      <style>
        {`@keyframes dot { 0%, 80%, 100% { transform: translateY(0); opacity: .45; } 40% { transform: translateY(-3px); opacity: 1; } }`}
      </style>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'rgba(26,115,232,0.9)',
            animation: `dot 1.05s ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function AIAssistant({ zones, units, suggestions, optimizationScore, weatherRainMm }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me what\'s most urgent, or request an optimization summary.' },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef(null);

  const topCritical = useMemo(
    () => (zones || []).filter((z) => z.status === 'red').map((z) => z.name).join(', ') || 'none',
    [zones],
  );
  const criticalCount = useMemo(() => (zones || []).filter((z) => z.status === 'red').length, [zones]);
  const amberCount = useMemo(() => (zones || []).filter((z) => z.status === 'amber').length, [zones]);
  const pendingCount = suggestions?.length || 0;
  const availableUnits = useMemo(() => (units || []).filter((u) => u.status === 'available').length, [units]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, isTyping]);

  const send = async (userMessage) => {
    const msg = (userMessage ?? input).trim();
    if (!msg) return;

    setMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: msg,
          context: {
            critical: criticalCount,
            amber: amberCount,
            pending: pendingCount,
            available_units: availableUnits,
            optimization_score: Number(optimizationScore || 0),
            rain_mm: Number(weatherRainMm || 0),
            top_critical: topCritical,
          },
        }),
      });
      const data = await res.json();
      const text = data?.reply || 'No response received.';
      setMessages((prev) => [...prev, { role: 'assistant', text }]);
    } catch (e) {
      console.error('AI chat error', e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Could not reach the backend. Make sure the server is running on port 8000.' },
      ]);
    }

    setIsTyping(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center leading-none"
        style={{ background: '#1A73E8' }}
        aria-label="Toggle AI Assistant"
      >
        <BrainIcon />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="fixed bottom-12 right-4 z-[2600] w-[360px] bg-white rounded-t-2xl rounded-b-xl shadow-2xl border border-[rgba(99,120,160,0.15)] overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
          >
            <div className="h-12 px-4 flex items-center justify-between bg-[#F8FAFF] border-b border-[rgba(99,120,160,0.12)]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1E8E6E] animate-pulse" />
                <span className="text-sm font-bold text-[#1C2B4A]">TriageFlow AI Assistant</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="px-2 py-1 rounded-md border border-[rgba(99,120,160,0.18)] text-[#5F6B7C] hover:bg-white text-xs"
              >
                Close
              </button>
            </div>

            <div ref={listRef} className="p-4 space-y-2 overflow-auto" style={{ maxHeight: 300 }}>
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={[
                        'max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed',
                        isUser ? 'bg-[#1A73E8] text-white' : 'bg-[#F8FAFF] text-[#1C2B4A] border-l-4 border-[#1A73E8]',
                      ].join(' ')}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 bg-[#F8FAFF] border-l-4 border-[#1A73E8]">
                    <TypingDots />
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pb-2">
              <div className="flex gap-2 flex-wrap mb-2">
                {["What's most urgent?", 'Optimize now?', 'Summarize crisis'].map((t) => (
                  <button
                    key={t}
                    onClick={() => send(t)}
                    disabled={isTyping}
                    className="px-3 py-1.5 rounded-full border border-[rgba(26,115,232,0.25)] bg-[#EEF3FF] text-[#1A73E8] text-[11px] font-mono disabled:opacity-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isTyping) send();
                  }}
                  disabled={isTyping}
                  className="flex-1 px-3 py-2 rounded-lg border border-[rgba(99,120,160,0.18)] bg-white text-sm outline-none focus:ring-2 focus:ring-[rgba(26,115,232,0.18)] disabled:opacity-60"
                  placeholder="Ask a question…"
                />
                <button
                  onClick={() => send()}
                  className="px-3 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1558B0] text-white text-sm font-bold disabled:opacity-50"
                  disabled={isTyping || !input.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
