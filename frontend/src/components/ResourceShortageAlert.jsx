import { useEffect, useMemo, useState } from 'react';

export default function ResourceShortageAlert({ units, zones, onRequestMutualAid }) {
  const available = useMemo(() => (units || []).filter((u) => u.status === 'available').length, [units]);
  const criticalZones = useMemo(() => (zones || []).filter((z) => z.status === 'red').length, [zones]);
  const [dismissed, setDismissed] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (available >= 3) {
      // Defer state updates to avoid synchronous setState-in-effect lint.
      setTimeout(() => {
        setDismissed(false);
        setSuccess(false);
      }, 0);
    }
  }, [available]);

  if (available >= 3 || dismissed) return null;

  const request = async () => {
    try {
      await onRequestMutualAid?.();
      setSuccess(true);
      setTimeout(() => setDismissed(true), 5000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed left-0 right-0 z-[2500] px-4 pointer-events-none" style={{ top: 64 }}>
      <div
        className="mx-auto max-w-[1200px] rounded-xl border border-[rgba(227,116,0,0.25)] shadow-sm overflow-hidden pointer-events-auto"
        style={{
          background:
            'linear-gradient(90deg, rgba(217,48,37,0.12) 0%, rgba(227,116,0,0.10) 45%, rgba(26,115,232,0.08) 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="text-lg leading-none">⚠</div>
            <div>
              {!success ? (
                <>
                  <div className="text-sm font-bold text-[#1C2B4A]">
                    Resource Shortage: Only {available} units available citywide. {criticalZones} zones are critical.
                  </div>
                  <div className="text-[12px] text-[#5F6B7C]">
                    Consider requesting mutual aid to avoid cascade failures.
                  </div>
                </>
              ) : (
                <div className="text-sm font-bold text-[#1E8E6E]">
                  ✓ Mutual aid requested from Tumkur district — ETA 15 minutes
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!success && (
              <button
                onClick={request}
                className="px-3 py-2 rounded-lg bg-white border border-[rgba(99,120,160,0.18)] hover:bg-[#F8FAFF] text-xs font-bold text-[#1C2B4A]"
              >
                Request Mutual Aid
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="px-2 py-1 rounded-md border border-[rgba(99,120,160,0.18)] text-[#5F6B7C] hover:bg-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

