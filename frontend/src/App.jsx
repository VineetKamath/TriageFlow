import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import PressureMap from './components/PressureMap';
import SuggestionQueue from './components/SuggestionQueue';
import UnitTracker from './components/UnitTracker';
import IncidentFeed from './components/IncidentFeed';
import ZoneDrillDown from './components/ZoneDrillDown';
import ComparisonPanel from './components/ComparisonPanel';
import LandingOverlay from './components/LandingOverlay';
import PostCrisisReviewPanel from './components/PostCrisisReviewPanel';
import SDGPanel from './components/SDGPanel';
import FeedbackWidget from './components/FeedbackWidget';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export default function App() {
  const query = new URLSearchParams(window.location.search);
  const isAutoDemoMode = query.get('autodemo') === 'true';
  const isDemoNarrationMode = query.get('demo') === 'true';

  const [appState, setAppState] = useState({
    zones: [],
    units: [],
    suggestions: [],
    incidents: [],
  });
  
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isPostCrisisOpen, setIsPostCrisisOpen] = useState(false);
  const [isImpactOpen, setIsImpactOpen] = useState(false);
  const [acceptedCount, setAcceptedCount] = useState(0);
  
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [isFloodLoading, setIsFloodLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [notificationCount, setNotificationCount] = useState(0);
  const [mapAnimations, setMapAnimations] = useState([]);
  
  const [isFlashingQueue, setIsFlashingQueue] = useState(false);
  const previousRedCountRef = useRef(0);
  const [showLandingOverlay, setShowLandingOverlay] = useState(!isAutoDemoMode);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [demoCallouts, setDemoCallouts] = useState([]);

  const [wsStatus, setWsStatus] = useState('reconnecting');
  const reconnectDelayRef = useRef(3000);
  const MAX_RECONNECT_DELAY_MS = 15000;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const hasStartedRef = useRef(false);
  const zone12StatusRef = useRef(null);
  const suggestionCountRef = useRef(0);
  const acceptedCountRef = useRef(0);
  const pendingSuggestionsRef = useRef([]);
  const autoDemoStartedRef = useRef(false);

  const connectWebSocket = () => {
    if (!hasStartedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      reconnectDelayRef.current = 3000; // Reset delay on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setAppState(data);
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onclose = () => {
      setWsStatus('reconnecting');
      console.log(`WebSocket closed. Reconnecting in ${reconnectDelayRef.current/1000}s...`);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, reconnectDelayRef.current);
      
      // Exponential backoff up to 15s
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY_MS);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      hasStartedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const startDashboardSession = async ({ runDemo = false } = {}) => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setShowLandingOverlay(false);
    connectWebSocket();
    try {
      const res = await axios.get(`${API_BASE_URL}/state`);
      setAppState(res.data);
    } catch (err) {
      console.error("Failed to fetch initial state", err);
    }
    if (runDemo) {
      setTimeout(async () => {
        try {
          await axios.post('http://localhost:8000/simulate/flood');
        } catch (e) {
          console.error("Failed to start flood scenario from landing overlay", e);
        }
      }, 2000);
    }
  };

  const showDemoCallout = (text) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setDemoCallouts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setDemoCallouts((prev) => prev.filter((item) => item.id !== id));
    }, 5500);
  };

  useEffect(() => {
    pendingSuggestionsRef.current = appState.suggestions || [];
  }, [appState.suggestions]);

  useEffect(() => {
    if (!isAutoDemoMode) return;
    if (autoDemoStartedRef.current) return;
    autoDemoStartedRef.current = true;
    let openTimer;
    let acceptTimer;
    let retryTimer;

    const run = async () => {
      await startDashboardSession({ runDemo: false });
      try {
        await axios.post(`${API_BASE_URL}/simulate/flood`);
      } catch (e) {
        console.error('Autodemo failed to start flood scenario', e);
      }
      openTimer = setTimeout(() => {
        setSelectedZoneId(12);
      }, 180000);
      acceptTimer = setTimeout(() => {
        const firstSuggestion = pendingSuggestionsRef.current?.[0];
        if (firstSuggestion) {
          handleAcceptSuggestion(firstSuggestion.id);
          return;
        }
        // If suggestion is not present right at T+3m30s, retry briefly.
        let attempts = 0;
        retryTimer = setInterval(() => {
          attempts += 1;
          const pending = pendingSuggestionsRef.current?.[0];
          if (pending) {
            handleAcceptSuggestion(pending.id);
            clearInterval(retryTimer);
          } else if (attempts >= 10) {
            clearInterval(retryTimer);
          }
        }, 2000);
      }, 210000);
    };

    run();
    return () => {
      if (openTimer) clearTimeout(openTimer);
      if (acceptTimer) clearTimeout(acceptTimer);
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [isAutoDemoMode]);

  useEffect(() => {
    const currentRedCount = appState.zones.filter(z => z.status === 'red').length;
    if (currentRedCount > previousRedCountRef.current) {
      setIsFlashingQueue(true);
      setTimeout(() => setIsFlashingQueue(false), 1000);
    }
    previousRedCountRef.current = currentRedCount;
  }, [appState.zones]);

  useEffect(() => {
    if (!isDemoNarrationMode) return;
    const zone12 = appState.zones.find((z) => z.id === 12);
    const currentStatus = zone12?.status || null;
    const previousStatus = zone12StatusRef.current;
    if (currentStatus === 'amber' && previousStatus !== 'amber' && previousStatus !== null) {
      showDemoCallout('Shadow demand spike detected');
    }
    zone12StatusRef.current = currentStatus;
  }, [appState.zones, isDemoNarrationMode]);

  useEffect(() => {
    if (!isDemoNarrationMode) return;
    const currentCount = appState.suggestions.length;
    if (currentCount > suggestionCountRef.current) {
      showDemoCallout('Pre-emptive reallocation suggested — 4 min early');
    }
    suggestionCountRef.current = currentCount;
  }, [appState.suggestions, isDemoNarrationMode]);

  useEffect(() => {
    if (!isDemoNarrationMode) return;
    if (acceptedCount > acceptedCountRef.current) {
      showDemoCallout('Units repositioned before first call');
    }
    acceptedCountRef.current = acceptedCount;
  }, [acceptedCount, isDemoNarrationMode]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/feedback`)
      .then((res) => setFeedbackSummary(res.data))
      .catch((err) => console.error('Failed to fetch feedback summary', err));
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkNotifications = () => {
      appState.suggestions.forEach(s => {
        if (!notifiedIds.has(s.id)) {
          const elapsed = (Date.now() - new Date(s.created_at).getTime()) / 1000;
          if (elapsed >= 60) {
            setNotifiedIds(prev => new Set(prev).add(s.id));
            setNotificationCount(prev => prev + 1);
            if ("Notification" in window && Notification.permission === "granted") {
              const zoneName = appState.zones.find(z => z.id === s.zone_id)?.name || s.zone_id;
              new Notification("TriageFlow Alert", {
                body: `Zone ${zoneName} critical — suggestion pending 60s`,
              });
            }
          }
        }
      });
    };
    
    checkNotifications();
    const interval = setInterval(checkNotifications, 1000);
    return () => clearInterval(interval);
  }, [appState.suggestions, notifiedIds, appState.zones]);

  const handleRunFlood = async () => {
    setIsFloodLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/simulate/flood`);
    } catch (e) {
      console.error("Failed to start flood scenario", e);
    }
    setTimeout(() => setIsFloodLoading(false), 1000);
  };

  const handleReset = async () => {
    setIsResetLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/simulate/reset`);
      setSelectedZoneId(null);
      setAcceptedCount(0);
      setMapAnimations([]);
      setNotifiedIds(new Set());
      setNotificationCount(0);
    } catch (e) {
      console.error("Failed to reset scenario", e);
    }
    setTimeout(() => setIsResetLoading(false), 1000);
  };

  const handleAcceptSuggestion = async (id) => {
    try {
      const suggestion = appState.suggestions.find(s => s.id === id);
      if (suggestion && suggestion.unit_ids.length > 0) {
        const unit = appState.units.find(u => u.id === suggestion.unit_ids[0]);
        if (unit) {
          const newAnim = {
            id: Date.now().toString(),
            sourceZoneId: unit.zone_id,
            targetZoneId: suggestion.zone_id,
            timestamp: Date.now()
          };
          setMapAnimations(prev => [...prev, newAnim]);
          // Remove animation after 1.5s
          setTimeout(() => {
            setMapAnimations(prev => prev.filter(a => a.id !== newAnim.id));
          }, 1500);
        }
      }
      
      await axios.post(`${API_BASE_URL}/suggestions/${id}/accept`);
      setAcceptedCount(prev => prev + 1);
    } catch (e) {
      console.error("Failed to accept suggestion", e);
    }
  };

  const handleDismissSuggestion = async (id) => {
    try {
      await axios.post(`${API_BASE_URL}/suggestions/${id}/dismiss`);
    } catch (e) {
      console.error("Failed to dismiss suggestion", e);
    }
  };

  const selectedZoneData = appState.zones.find(z => z.id === selectedZoneId);

  const zonesCritical = appState.zones.filter(z => z.status === 'red').length;
  const suggestionsPending = appState.suggestions.length;
  const unitsDeployed = appState.units.filter(u => u.status !== 'available').length;
  const minutesSaved = acceptedCount * 7;
  const zonesProtected = appState.zones.filter(z => z.status !== 'red').length;
  const unitsOptimallyPositioned = appState.units.filter((u) => {
    const zone = appState.zones.find((z) => z.id === u.zone_id);
    return u.status === 'available' && zone && zone.status !== 'red';
  }).length;

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (showLandingOverlay) {
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        handleRunFlood();
      } else if (key === 'r') {
        event.preventDefault();
        handleReset();
      } else if (key === 'a') {
        event.preventDefault();
        const firstSuggestion = appState.suggestions?.[0];
        if (firstSuggestion) {
          handleAcceptSuggestion(firstSuggestion.id);
        }
      } else if (key === 'c') {
        event.preventDefault();
        setIsComparisonOpen((prev) => !prev);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedZoneId(null);
        setIsComparisonOpen(false);
        setIsPostCrisisOpen(false);
        setIsImpactOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [appState.suggestions, showLandingOverlay]);

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#D4D8E0] flex flex-col font-sans operations-bg relative">
      <AnimatePresence>
        {showLandingOverlay && (
          <LandingOverlay
            onStartDashboard={() => startDashboardSession({ runDemo: false })}
            onRunDemo={() => startDashboardSession({ runDemo: true })}
            feedbackSummary={feedbackSummary}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="sticky top-0 z-[2400] bg-[#0A0C10] border-b border-[rgba(255,255,255,0.06)] h-16 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 min-w-[240px]">
            <div className={`w-2.5 h-2.5 rounded-full ${wsStatus === 'connected' ? 'bg-[#2ECC8F]' : 'bg-[#C94040]'}`} />
            <div>
              <p className="font-mono-data text-[11px] uppercase tracking-[0.12em] text-[#3D4454]">LIVE OPERATIONS</p>
              <h1 className="font-mono-data text-[13px] tracking-[0.12em] text-[#6B7280]">TriageFlow Command Center</h1>
            </div>
          </div>
          <div className="flex gap-3 border-l border-white/10 pl-5">
            <div className="bg-[#141720] rounded-lg px-4 py-2 border border-[rgba(255,255,255,0.07)]">
              <p className="text-[10px] uppercase text-[#6B7280] tracking-widest">Zones Critical</p>
              <motion.span key={zonesCritical} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="font-mono-data text-2xl font-bold text-[#C94040]">
                {zonesCritical}
              </motion.span>
            </div>
            <div className="bg-[#141720] rounded-lg px-4 py-2 border border-[rgba(255,255,255,0.07)]">
              <p className="text-[10px] uppercase text-[#6B7280] tracking-widest">Suggestions Pending</p>
              <motion.span key={suggestionsPending} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="font-mono-data text-2xl font-bold text-[#D4860A]">
                {suggestionsPending}
              </motion.span>
            </div>
            <div className="bg-[#141720] rounded-lg px-4 py-2 border border-[rgba(255,255,255,0.07)]">
              <p className="text-[10px] uppercase text-[#6B7280] tracking-widest">Units Deployed</p>
              <motion.span key={unitsDeployed} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="font-mono-data text-2xl font-bold text-[#3B8BEB]">
                {unitsDeployed}
              </motion.span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4 flex items-center justify-center text-[#888780]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E24B4A] text-[10px] font-bold text-white">
                {notificationCount}
              </span>
            )}
          </div>

          {acceptedCount > 0 && (
            <button 
              onClick={() => setIsComparisonOpen(true)}
              className="bg-[#1E2A3A] border border-[#3B8BEB] text-[#3B8BEB] hover:bg-[#253547] transition-all duration-200 rounded-md px-4 py-2 text-sm font-medium"
            >
              Impact Analysis
            </button>
          )}
          <button
            onClick={() => setIsPostCrisisOpen(true)}
            className="bg-[#1E2A3A] border border-[#3B8BEB] text-[#3B8BEB] hover:bg-[#253547] transition-all duration-200 rounded-md px-4 py-2 text-sm font-medium"
          >
            Post-Crisis Review
          </button>
          <button
            onClick={() => setIsImpactOpen(true)}
            className="bg-[#1E2A3A] border border-[#3B8BEB] text-[#3B8BEB] hover:bg-[#253547] transition-all duration-200 rounded-md px-4 py-2 text-sm font-medium"
          >
            Impact
          </button>
          <button 
            onClick={handleRunFlood}
            disabled={isFloodLoading}
            className="bg-transparent border border-[#D4860A] text-[#D4860A] hover:bg-[#1E1A10] transition-all duration-200 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-70 flex items-center gap-2"
          >
            {isFloodLoading ? <span className="spinner" /> : 'Run Flood Scenario'}
          </button>
          <button 
            onClick={handleReset}
            disabled={isResetLoading}
            className="bg-transparent border border-[rgba(255,255,255,0.12)] text-[#6B7280] hover:border-[rgba(255,255,255,0.2)] hover:bg-[#1A1E28] transition-all duration-200 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-70 flex items-center gap-2"
          >
            {isResetLoading ? <span className="spinner" /> : 'Reset'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6 relative">
        {/* Left Column - Map (65%) */}
        <div className="w-[65%] h-full flex flex-col">
          <PressureMap 
            zones={appState.zones} 
            units={appState.units} 
            onZoneClick={setSelectedZoneId} 
            mapAnimations={mapAnimations}
          />
        </div>

        {/* Right Column - Dashboards (35%) */}
        <div className="w-[35%] h-full flex flex-col overflow-y-auto pr-2 custom-scrollbar">
          <SuggestionQueue 
            suggestions={appState.suggestions} 
            zones={appState.zones}
            onAccept={handleAcceptSuggestion} 
            onDismiss={handleDismissSuggestion} 
            hasRedZone={isFlashingQueue}
          />
          <UnitTracker units={appState.units} />
          <IncidentFeed incidents={appState.incidents} />
        </div>

        {/* Zone Drill-Down Panel */}
        <AnimatePresence>
          {selectedZoneId && (
            <ZoneDrillDown 
              zoneId={selectedZoneId} 
              zoneData={selectedZoneData} 
              onClose={() => setSelectedZoneId(null)} 
            />
          )}
        </AnimatePresence>
        
        {/* Comparison Panel */}
        <AnimatePresence>
          {isComparisonOpen && (
            <ComparisonPanel 
              isOpen={isComparisonOpen} 
              onClose={() => setIsComparisonOpen(false)} 
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isPostCrisisOpen && (
            <PostCrisisReviewPanel
              isOpen={isPostCrisisOpen}
              onClose={() => setIsPostCrisisOpen(false)}
              zones={appState.zones}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isImpactOpen && (
            <SDGPanel
              isOpen={isImpactOpen}
              onClose={() => setIsImpactOpen(false)}
              minutesSaved={minutesSaved}
              zonesProtected={zonesProtected}
              unitsOptimallyPositioned={unitsOptimallyPositioned}
              zones={appState.zones}
            />
          )}
        </AnimatePresence>
      </main>
      {!showLandingOverlay && (
        <div className="fixed bottom-3 left-4 text-[11px] tracking-wider text-[#676660] z-[2500]">
          shortcuts: F R A C
        </div>
      )}
      {isDemoNarrationMode && demoCallouts.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[3200] flex flex-col gap-2 items-center pointer-events-none">
          {demoCallouts.map((c) => (
            <div
              key={c.id}
              className="px-4 py-2 rounded-md border border-[#2a2d3a] bg-[#11141d]/95 text-[#d7d4cb] text-sm shadow-lg animate-[fadeInOut_5.4s_ease-in-out_forwards]"
            >
              {c.text}
            </div>
          ))}
        </div>
      )}
      <FeedbackWidget />

      <style>{`
        .spinner {
          border: 2px solid rgba(255,255,255,0.3);
          border-left-color: #fff;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(6px); }
          12% { opacity: 1; transform: translateY(0); }
          82% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
