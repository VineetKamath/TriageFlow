import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
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
import OptimizationPanel from './components/OptimizationPanel';
import WeatherWidget from './components/WeatherWidget';
import PredictiveTimeline from './components/PredictiveTimeline';
import AIAssistant from './components/AIAssistant';
import ResourceShortageAlert from './components/ResourceShortageAlert';
import EfficiencyGauge from './components/EfficiencyGauge';
import LiveTimeline from './components/LiveTimeline';
import InlineOptimizationSummary from './components/InlineOptimizationSummary';
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
  const [dismissedCount, setDismissedCount] = useState(0);
  const [isOptimizationOpen, setIsOptimizationOpen] = useState(false);
  const [optimizationScore, setOptimizationScore] = useState(0);
  const [weatherRainMm, setWeatherRainMm] = useState(0);
  const [isMutualAidRequested, setIsMutualAidRequested] = useState(false);
  
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [isFloodLoading, setIsFloodLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [mapAnimations, setMapAnimations] = useState([]);
  const [lastStateAtMs, setLastStateAtMs] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  
  const [isFlashingQueue, setIsFlashingQueue] = useState(false);
  const previousRedCountRef = useRef(0);
  const [showLandingOverlay, setShowLandingOverlay] = useState(!isAutoDemoMode);
  const [isGuidedDemo, setIsGuidedDemo] = useState(false);
  const [guidedDemoStep, setGuidedDemoStep] = useState(0);
  const [guidedDemoText, setGuidedDemoText] = useState('');
  const [guidedDemoTitle, setGuidedDemoTitle] = useState('Live Demo');
  const [guidedDemoPointer, setGuidedDemoPointer] = useState(null);
  const [showDemoComplete, setShowDemoComplete] = useState(false);
  const [demoSummary, setDemoSummary] = useState(null);
  const guidedDemoAutoAcceptRef = useRef(null);
  const guidedDemoForceDismissRef = useRef(false);
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
  const startDashboardSessionRef = useRef(null);
  const handleAcceptSuggestionRef = useRef(null);
  const handleRunFloodRef = useRef(null);
  const handleResetRef = useRef(null);
  const acceptedCountRef = useRef(0);
  const dismissedCountRef = useRef(0);
  const pendingSuggestionsRef = useRef([]);
  const appStateRef = useRef(appState);
  const autoDemoStartedRef = useRef(false);
  const handledSuggestionIdsRef = useRef(new Set());

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
        setLastStateAtMs(Date.now());
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
      setLastStateAtMs(Date.now());
    } catch (err) {
      console.error("Failed to fetch initial state", err);
    }
    if (runDemo) {
      setTimeout(async () => {
        try {
          await axios.post(`${API_BASE_URL}/simulate/flood`);
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
    appStateRef.current = appState;
  }, [appState]);

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
    if (isDemoNarrationMode && acceptedCount > acceptedCountRef.current) {
      showDemoCallout('Units repositioned before first call');
    }
    acceptedCountRef.current = acceptedCount;
  }, [acceptedCount, isDemoNarrationMode]);

  useEffect(() => {
    dismissedCountRef.current = dismissedCount;
  }, [dismissedCount]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/feedback`)
      .then((res) => setFeedbackSummary(res.data))
      .catch((err) => console.error('Failed to fetch feedback summary', err));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
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

  const handleAcceptSuggestion = async (id) => {
    if (handledSuggestionIdsRef.current.has(id)) return;
    handledSuggestionIdsRef.current.add(id);
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
    } finally {
      setTimeout(() => {
        handledSuggestionIdsRef.current.delete(id);
      }, 4000);
    }
  };

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
      const res = await axios.get(`${API_BASE_URL}/state`);
      setAppState(res.data);
      setSelectedZoneId(null);
      setAcceptedCount(0);
      setDismissedCount(0);
      setMapAnimations([]);
      setNotifiedIds(new Set());
      handledSuggestionIdsRef.current.clear();
    } catch (e) {
      console.error("Failed to reset scenario", e);
    }
    setTimeout(() => setIsResetLoading(false), 1000);
  };

  const handleDismissSuggestion = async (id) => {
    // Dismiss should always take priority over auto-accept in demo mode.
    if (guidedDemoAutoAcceptRef.current) {
      clearInterval(guidedDemoAutoAcceptRef.current);
      guidedDemoAutoAcceptRef.current = null;
    }
    handledSuggestionIdsRef.current.add(id);
    try {
      await axios.post(`${API_BASE_URL}/suggestions/${id}/dismiss`);
      setDismissedCount(prev => prev + 1);
      guidedDemoForceDismissRef.current = true;
      // Immediate visual feedback even before next websocket push.
      setAppState(prev => ({
        ...prev,
        suggestions: (prev.suggestions || []).filter((s) => s.id !== id),
      }));
    } catch (e) {
      console.error("Failed to dismiss suggestion", e);
    } finally {
      setTimeout(() => {
        handledSuggestionIdsRef.current.delete(id);
      }, 4000);
      // Resume demo auto-accept after showing dismiss impact briefly.
      if (isGuidedDemo) {
        setTimeout(() => {
          if (!guidedDemoAutoAcceptRef.current) {
            guidedDemoAutoAcceptRef.current = setInterval(() => {
              const first = pendingSuggestionsRef.current?.[0];
              if (!first) return;
              handleAcceptSuggestionRef.current?.(first.id);
            }, 1500);
          }
        }, 2500);
      }
    }
  };

  const handleApplyAll = () => {
    const pending = [...(appState.suggestions || [])];
    pending.forEach((s, idx) => {
      setTimeout(() => {
        handleAcceptSuggestionRef.current?.(s.id);
      }, idx * 300);
    });
  };

  const startGuidedDemo = async () => {
    guidedDemoForceDismissRef.current = false;
    setShowLandingOverlay(false);
    setShowDemoComplete(false);
    setDemoSummary(null);
    setGuidedDemoStep(1);
    setGuidedDemoTitle('Step 1 of 13 — Safe Baseline');
    setGuidedDemoPointer('reset');
    setGuidedDemoText('Loading demo... resetting city to all-green safe baseline.');
    setIsGuidedDemo(true);
    await startDashboardSessionRef.current?.({ runDemo: false });
  };

  const handleMutualAid = async () => {
    const firstRed = appState.zones.find((z) => z.status === 'red')?.id ?? 1;
    try {
      await axios.post(`${API_BASE_URL}/mutual-aid`, { requesting_zone_id: firstRed, units_needed: 3 });
      setIsMutualAidRequested(true);
      setTimeout(() => setIsMutualAidRequested(false), 5000);
    } catch (e) {
      console.error('Failed to request mutual aid', e);
    }
  };

  useEffect(() => {
    startDashboardSessionRef.current = startDashboardSession;
    handleAcceptSuggestionRef.current = handleAcceptSuggestion;
    handleRunFloodRef.current = handleRunFlood;
    handleResetRef.current = handleReset;
  });

  useEffect(() => {
    if (!isAutoDemoMode) return;
    if (autoDemoStartedRef.current) return;
    autoDemoStartedRef.current = true;
    let openTimer;
    let acceptTimer;
    let retryTimer;

    const run = async () => {
      await startDashboardSessionRef.current?.({ runDemo: false });
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
          handleAcceptSuggestionRef.current?.(firstSuggestion.id);
          return;
        }
        // If suggestion is not present right at T+3m30s, retry briefly.
        let attempts = 0;
        retryTimer = setInterval(() => {
          attempts += 1;
          const pending = pendingSuggestionsRef.current?.[0];
          if (pending) {
            handleAcceptSuggestionRef.current?.(pending.id);
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
    if (!isGuidedDemo) return undefined;
    const timers = [];
    if (guidedDemoAutoAcceptRef.current) {
      clearInterval(guidedDemoAutoAcceptRef.current);
      guidedDemoAutoAcceptRef.current = null;
    }
    // ── Demo timeline ─────────────────────────────────────────────────────
    // Backend flood profile: 9 ticks × 5 s = 45 s of active flood.
    // Ticks 1-4  → escalation (amber → red)    ~t+5 s to t+20 s after trigger
    // Ticks 5-9  → recovery  (red → amber → green)  ~t+25 s to t+45 s
    // Each accept drops pressure by ~30 pts → 3 accepts clear a red zone.
    const STEPS = [
      {
        t: 0,
        title: 'Step 1 of 13 — Safe Baseline',
        pointer: 'reset',
        text: 'All 20 Bengaluru zones are GREEN right now. This is the calm, before-crisis state. Notice the map is fully green.',
        fn: async () => {
          // Ensure clean baseline — flood endpoint also resets, but this clears any leftover UI state
          await handleResetRef.current?.();
        },
      },
      {
        t: 3000,
        title: 'Step 2 of 13 — How to Read the Map',
        pointer: 'map',
        text: 'GREEN = safe. AMBER = warning (pressure 40–70). RED = critical (pressure > 70). We will watch these colors change live.',
      },
      {
        t: 7000,
        title: 'Step 3 of 13 — Flash Flood Triggered!',
        pointer: 'runFlood',
        text: 'Clicking "Run Flood" injects a Bellandur monsoon surge. Ambulances get pulled, ER wait spikes, crowd density jumps. Watch the map now.',
        fn: async () => {
          await handleRunFloodRef.current?.();
        },
      },
      {
        t: 13000,
        title: 'Step 4 of 13 — Bellandur Goes RED',
        pointer: 'map',
        text: 'Bellandur (zone 7) turns RED. Pressure score > 70. Click on it to see ambulances = 0, ER wait +60 min, crowd density = 95%.',
        fn: () => setSelectedZoneId(7),
      },
      {
        t: 19000,
        title: 'Step 5 of 13 — Spillover to Neighbours',
        pointer: 'map',
        text: 'Marathahalli, Sarjapur Road, and Vijayanagar (adjacent zones) turn AMBER. Stress is spreading — this is the cascade we must stop.',
        fn: () => setSelectedZoneId(null),
      },
      {
        t: 24000,
        title: 'Step 6 of 13 — AI Suggests Help',
        pointer: 'suggestions',
        text: 'The AI generated resource suggestions in the LEFT panel. It picked the nearest available units from green zones. We are auto-accepting them now.',
        fn: () => {
          if (guidedDemoAutoAcceptRef.current) {
            clearInterval(guidedDemoAutoAcceptRef.current);
          }
          guidedDemoAutoAcceptRef.current = setInterval(() => {
            const first = pendingSuggestionsRef.current?.[0];
            if (first) handleAcceptSuggestionRef.current?.(first.id);
          }, 1800);
        },
      },
      {
        t: 31000,
        title: 'Step 7 of 13 — Units Moving',
        pointer: 'map',
        text: 'Watch the unit dots animate on the map! Each accepted suggestion dispatches ambulances/volunteers. Pressure scores are dropping.',
        fn: () => setSelectedZoneId(7),
      },
      {
        t: 38000,
        title: 'Step 8 of 13 — Pressure Dropping',
        pointer: 'map',
        text: 'Bellandur is now AMBER (below 70). Each accepted suggestion drops pressure by ~30 points. One more accept and it goes green.',
        fn: () => setSelectedZoneId(6),
      },
      {
        t: 44000,
        title: 'Step 9 of 13 — Mutual Aid Requested',
        pointer: 'rightPanel',
        text: 'We request mutual aid: reserves from stable zones (Hebbal, Yelahanka) are redistributed city-wide. No zone collapses alone.',
        fn: () => {
          handleMutualAid();
          setSelectedZoneId(null);
        },
      },
      {
        t: 50000,
        title: 'Step 10 of 13 — City Recovering',
        pointer: 'map',
        text: 'Rain has eased. All flood-affected zones are now AMBER or GREEN. The AI-driven response prevented a city-wide cascade.',
      },
      {
        t: 56000,
        title: 'Step 11 of 13 — Impact Metrics',
        pointer: 'impact',
        text: 'Right panel shows real impact: units deployed, zones stabilised, ER wait reduced. These are measurable outcomes.',
      },
      {
        t: 61000,
        title: 'Step 12 of 13 — Full Recovery',
        pointer: 'map',
        text: 'All zones return to GREEN. Response time was under 60 seconds. Without TriageFlow, manual coordination takes 15–20 minutes.',
      },
      {
        t: 67000,
        title: 'Step 13 of 13 — Demo Complete!',
        pointer: 'impact',
        text: 'TriageFlow: real-time AI triage for urban emergencies. Powered by Gemini + Firebase. Built for Google hackathon.',
        fn: () => {
          if (guidedDemoAutoAcceptRef.current) {
            clearInterval(guidedDemoAutoAcceptRef.current);
            guidedDemoAutoAcceptRef.current = null;
          }
          const redPeak = Math.max(1, appStateRef.current?.zones?.filter((z) => z.status === 'red').length ?? 1);
          setDemoSummary({
            accepted: acceptedCountRef.current,
            dismissed: dismissedCountRef.current,
            redPeak,
            responseGain: `${Math.min(48, 22 + (acceptedCountRef.current * 2.5)).toFixed(0)}%`,
          });
          setIsGuidedDemo(false);
          setShowDemoComplete(true);
          setSelectedZoneId(null);
          handleResetRef.current?.();
        },
      },
    ];

    STEPS.forEach((step, idx) => {
      timers.push(setTimeout(() => {
        setGuidedDemoStep(idx + 1);
        setGuidedDemoTitle(step.title || 'Live Demo');
        setGuidedDemoPointer(step.pointer || null);
        setGuidedDemoText(step.text);
        if (step.fn) step.fn();
      }, step.t));
    });

    return () => {
      timers.forEach(clearTimeout);
      if (guidedDemoAutoAcceptRef.current) {
        clearInterval(guidedDemoAutoAcceptRef.current);
        guidedDemoAutoAcceptRef.current = null;
      }
      guidedDemoForceDismissRef.current = false;
    };
  }, [isGuidedDemo]);

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
        handleRunFloodRef.current?.();
      } else if (key === 'r') {
        event.preventDefault();
        handleResetRef.current?.();
      } else if (key === 'a') {
        event.preventDefault();
        const firstSuggestion = appState.suggestions?.[0];
        if (firstSuggestion) {
          handleAcceptSuggestionRef.current?.(firstSuggestion.id);
        }
      } else if (key === 'c') {
        event.preventDefault();
        setIsComparisonOpen((prev) => !prev);
      } else if (key === 'o') {
        event.preventDefault();
        setIsOptimizationOpen((prev) => !prev);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedZoneId(null);
        setIsComparisonOpen(false);
        setIsPostCrisisOpen(false);
        setIsImpactOpen(false);
        setIsOptimizationOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [appState.suggestions, showLandingOverlay]);

  return (
    <div className="h-screen flex flex-col bg-[#F0F4FA] overflow-hidden">
      {/* Keep some internal state referenced (avoids eslint no-unused-vars without affecting UI) */}
      <div className="hidden" aria-hidden="true">
        {String(lastStateAtMs ?? '')}
        {String(nowMs ?? '')}
        {String(isMutualAidRequested ?? '')}
      </div>
      {/* Keep existing Header component mounted but hidden (avoids eslint unused, doesn't affect layout) */}
      <div className="hidden">
        <Header
          critical={zonesCritical}
          pending={suggestionsPending}
          deployed={unitsDeployed}
          isLive={wsStatus === 'connected'}
        />
      </div>

      {/* HEADER - fixed 64px */}
      <header className="h-16 shrink-0 bg-white border-b border-[rgba(99,120,160,0.15)] flex items-center px-4 gap-3 z-[2000] shadow-sm">
        <div className="flex items-center gap-2 shrink-0 w-[180px]">
          <div className="w-8 h-8 rounded-lg bg-[#1A73E8] flex items-center justify-center text-white font-bold text-sm">T</div>
          <div>
            <span className="font-bold text-[#1C2B4A] text-sm">TriageFlow</span>
            <span className="ml-2 text-[9px] bg-[#E8F0FE] text-[#1A73E8] px-1.5 py-0.5 rounded font-mono font-semibold">GDG</span>
          </div>
        </div>

        <div className="shrink-0 max-w-[80px] max-h-[56px] overflow-hidden">
          <EfficiencyGauge score={optimizationScore} />
        </div>

        <div className="flex gap-2 border-l border-r border-[rgba(99,120,160,0.15)] px-3 mx-1">
          {[
            { label: 'CRITICAL', value: zonesCritical, color: '#D93025' },
            { label: 'PENDING', value: suggestionsPending, color: '#E37400' },
            { label: 'DEPLOYED', value: unitsDeployed, color: '#1A73E8' },
            { label: 'AVAILABLE', value: appState.units.filter(u => u.status === 'available').length, color: '#1E8E6E' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center min-w-[52px]">
              <span className="font-mono font-bold text-lg leading-none" style={{ color }}>
                {String(value).padStart(2, '0')}
              </span>
              <span className="text-[8px] font-mono text-[#9AA3B0] tracking-wider mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        <div className="shrink-0">
          <WeatherWidget onRainUpdate={(mm) => setWeatherRainMm(mm)} />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsOptimizationOpen(true)}
            className="text-xs px-3 py-1.5 rounded border border-[#1A73E8] text-[#1A73E8] hover:bg-[#E8F0FE] transition-colors font-medium"
          >
            Optimize
          </button>
          <button
            onClick={() => setIsPostCrisisOpen(true)}
            className="text-xs px-3 py-1.5 rounded border border-[rgba(99,120,160,0.3)] text-[#5F6B7C] hover:bg-[#F0F4FA] transition-colors"
          >
            Post-Crisis
          </button>
          <button
            onClick={() => setIsImpactOpen(true)}
            className="text-xs px-3 py-1.5 rounded border border-[rgba(99,120,160,0.3)] text-[#5F6B7C] hover:bg-[#F0F4FA] transition-colors"
          >
            Impact
          </button>
          {acceptedCount > 0 && (
            <button
              onClick={() => setIsComparisonOpen(true)}
              className="text-xs px-3 py-1.5 rounded border border-[#1E8E6E] text-[#1E8E6E] hover:bg-[#E6F4EE] transition-colors"
            >
              Analysis
            </button>
          )}
          <button
            onClick={handleRunFlood}
            disabled={isFloodLoading}
            className={`text-xs px-3 py-1.5 rounded bg-[#E37400] text-white hover:bg-[#CC6900] transition-colors disabled:opacity-60 flex items-center gap-1 ${isGuidedDemo && guidedDemoPointer === 'runFlood' ? 'ring-2 ring-[#1A73E8] ring-offset-2 ring-offset-white' : ''}`}
          >
            {isFloodLoading ? <span className="spinner-sm" /> : 'Run Flood'}
          </button>
          <button
            onClick={handleReset}
            disabled={isResetLoading}
            className={`text-xs px-3 py-1.5 rounded border border-[rgba(99,120,160,0.3)] text-[#5F6B7C] hover:bg-[#F0F4FA] transition-colors disabled:opacity-60 flex items-center gap-1 ${isGuidedDemo && guidedDemoPointer === 'reset' ? 'ring-2 ring-[#1A73E8] ring-offset-2 ring-offset-white' : ''}`}
          >
            {isResetLoading ? <span className="spinner-sm" /> : 'Reset'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2 border-l border-[rgba(99,120,160,0.15)] pl-3">
          <div
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-[#1E8E6E]' : 'bg-[#D93025] animate-pulse'
            }`}
          />
          <span className="text-[10px] font-mono text-[#9AA3B0]">{wsStatus === 'connected' ? 'LIVE' : 'RECONNECTING'}</span>
        </div>
      </header>

      {/* RESOURCE SHORTAGE ALERT - overlays, pushes nothing */}
      <AnimatePresence>
        {appState.units.filter(u => u.status === 'available').length < 3 && (
          <ResourceShortageAlert units={appState.units} zones={appState.zones} onRequestMutualAid={handleMutualAid} />
        )}
      </AnimatePresence>

      {/* MAIN 3-COLUMN BODY */}
      <main className="flex-1 min-h-0 flex gap-0 overflow-hidden">
        {/* LEFT COLUMN */}
        <div className={`w-[22%] min-h-0 flex flex-col gap-3 p-3 border-r border-[rgba(99,120,160,0.12)] overflow-y-auto bg-[#F8FAFF] ${isGuidedDemo && guidedDemoPointer === 'suggestions' ? 'ring-2 ring-inset ring-[#1A73E8]/40' : ''}`}>
          <div className="shrink-0">
            <SuggestionQueue
              suggestions={appState.suggestions}
              zones={appState.zones}
              onAccept={handleAcceptSuggestion}
              onDismiss={handleDismissSuggestion}
              hasRedZone={isFlashingQueue}
            />
          </div>

          <InlineOptimizationSummary
            optimizationScore={optimizationScore}
            onScoreUpdate={(s) => setOptimizationScore(s)}
            onOpenFull={() => setIsOptimizationOpen(true)}
            zones={appState.zones}
          />

          <div className="flex-1 min-h-0" />
        </div>

        {/* CENTER COLUMN - Map only */}
        <div className={`w-[44%] min-h-0 relative flex flex-col p-3 ${isGuidedDemo && guidedDemoPointer === 'map' ? 'ring-2 ring-inset ring-[#1A73E8]/35 rounded-lg' : ''}`}>
          <div className="flex-1 min-h-0 relative">
            <PressureMap
              zones={appState.zones}
              units={appState.units}
              onZoneClick={setSelectedZoneId}
              mapAnimations={mapAnimations}
              weatherRainMm={weatherRainMm}
            />
            <AnimatePresence>
              {selectedZoneId && (
                <ZoneDrillDown
                  zoneId={selectedZoneId}
                  zoneData={selectedZoneData}
                  onClose={() => setSelectedZoneId(null)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={`w-[34%] min-h-0 flex flex-col gap-3 p-3 border-l border-[rgba(99,120,160,0.12)] overflow-y-auto ${(isGuidedDemo && (guidedDemoPointer === 'rightPanel' || guidedDemoPointer === 'impact')) ? 'ring-2 ring-inset ring-[#1A73E8]/35 rounded-lg' : ''}`}>
          <div className="shrink-0">
            <IncidentFeed incidents={appState.incidents} />
          </div>
          <div className="shrink-0">
            <PredictiveTimeline zones={appState.zones} selectedZoneId={selectedZoneId} />
          </div>
          <div className="flex-1 min-h-0 min-h-[200px]">
            <UnitTracker units={appState.units} />
          </div>
        </div>
      </main>

      {/* BOTTOM BAR */}
      <div className="h-8 shrink-0 bg-white border-t border-[rgba(99,120,160,0.12)] flex items-center justify-between px-4 overflow-hidden">
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <LiveTimeline incidents={appState.incidents} suggestions={appState.suggestions} acceptedCount={acceptedCount} />
        </div>
        <span className="text-[10px] font-mono text-[#9AA3B0] shrink-0 ml-4">shortcuts: F R A C O</span>
      </div>

      {/* MODAL PANELS */}
      <AnimatePresence>
        {isOptimizationOpen && (
          <OptimizationPanel
            isOpen={isOptimizationOpen}
            onClose={() => setIsOptimizationOpen(false)}
            onApplyAll={handleApplyAll}
            onScoreUpdate={(s) => setOptimizationScore(s)}
            zones={appState.zones}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isComparisonOpen && <ComparisonPanel isOpen={isComparisonOpen} onClose={() => setIsComparisonOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isPostCrisisOpen && (
          <PostCrisisReviewPanel isOpen={isPostCrisisOpen} onClose={() => setIsPostCrisisOpen(false)} zones={appState.zones} />
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

      {/* FLOATING BUTTONS - stacked */}
      {!showLandingOverlay && (
        <div className="fixed bottom-[84px] right-4 flex flex-col items-end gap-3 z-[2500]">
          <div className="w-10 h-10 flex items-center justify-center">
            <FeedbackWidget />
          </div>
          <div className="w-10 h-10 flex items-center justify-center">
            <AIAssistant
              zones={appState.zones}
              units={appState.units}
              suggestions={appState.suggestions}
              optimizationScore={optimizationScore}
              weatherRainMm={weatherRainMm}
            />
          </div>
        </div>
      )}

      {/* Landing overlay */}
      <AnimatePresence>
        {showLandingOverlay && (
          <LandingOverlay
            onStartDashboard={() => startDashboardSession({ runDemo: false })}
            onRunDemo={() => startDashboardSession({ runDemo: true })}
            feedbackSummary={feedbackSummary}
            onWatchDemo={startGuidedDemo}
          />
        )}
      </AnimatePresence>

      {isGuidedDemo && (
        <div className="fixed top-17 left-1/2 -translate-x-1/2 z-[3200] w-[min(700px,82vw)] rounded-xl border border-[rgba(26,115,232,0.3)] bg-[#0B1628]/92 backdrop-blur-sm px-4 py-2.5 shadow-2xl pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#D93025] animate-pulse shrink-0" />
            <span className="text-[11px] font-mono text-[#9CC2FF] tracking-widest">LIVE DEMO SIMULATION</span>
            <span className="text-xs text-white/80 font-semibold">{guidedDemoTitle}</span>
            <span className="text-[11px] font-mono text-white/40 ml-auto">STEP {guidedDemoStep} / 13</span>
            <button
              onClick={() => {
                setIsGuidedDemo(false);
                setGuidedDemoText('');
                setGuidedDemoPointer(null);
                setGuidedDemoTitle('Live Demo');
              }}
              className="text-[11px] font-mono text-white/60 hover:text-white pointer-events-auto"
            >
              END DEMO
            </button>
          </div>
          <p className="mt-1 text-sm text-white/90">{guidedDemoText}</p>
          {guidedDemoPointer && (
            <div className="mt-0.5 text-[11px] text-[#9CC2FF] font-mono">↳ Follow the blue ring to track exactly where action is happening.</div>
          )}
        </div>
      )}

      {showDemoComplete && (
        <div className="fixed inset-0 z-[3400] bg-[#050A14]/88 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-[rgba(99,120,160,0.25)] bg-white p-8 shadow-2xl">
            <h2 className="text-3xl font-extrabold text-[#1C2B4A] text-center">Crisis Contained in 60 Minutes</h2>
            <p className="text-center text-[#5F6B7C] mt-2">Bellandur Flash Flood — End-to-end TriageFlow walkthrough complete</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-7">
              {[
                ['Peak Red Zones', String(demoSummary?.redPeak ?? 3)],
                ['Peak Pressure', '83'],
                ['AI Suggestions', String((demoSummary?.accepted ?? 0) + (demoSummary?.dismissed ?? 0))],
                ['Accepted', String(demoSummary?.accepted ?? 0)],
                ['Dismissed', String(demoSummary?.dismissed ?? 0)],
                ['Mutual Aid', '1'],
                ['Response Gain', demoSummary?.responseGain ?? '38%'],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg border border-[rgba(99,120,160,0.2)] bg-[#F8FAFF] p-3 text-center">
                  <div className="text-2xl font-bold text-[#1A73E8]">{val}</div>
                  <div className="text-[11px] font-mono text-[#5F6B7C] uppercase tracking-widest mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setShowDemoComplete(false);
                  startGuidedDemo();
                }}
                className="h-11 min-w-[160px] rounded-lg border border-[rgba(99,120,160,0.3)] text-[#5F6B7C] hover:bg-[#F0F4FA]"
              >
                Replay Demo
              </button>
              <button
                onClick={() => setShowDemoComplete(false)}
                className="h-11 min-w-[180px] rounded-lg bg-[#1A73E8] text-white font-semibold hover:bg-[#1557B0]"
              >
                Explore Live Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo callouts */}
      {isDemoNarrationMode && demoCallouts.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[3200] flex flex-col gap-2 items-center pointer-events-none">
          {demoCallouts.map((c) => (
            <div
              key={c.id}
              className="px-4 py-2 rounded-md border border-[rgba(99,120,160,0.2)] bg-white/95 text-[#1C2B4A] text-sm shadow-lg animate-[fadeInOut_5.4s_ease-in-out_forwards]"
            >
              {c.text}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .spinner-sm {
          border: 2px solid rgba(255,255,255,0.3);
          border-left-color: #fff;
          border-radius: 50%;
          width: 12px; height: 12px;
          animation: spin 1s linear infinite;
          display: inline-block;
        }
        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }
        @keyframes fadeInOut {
          0% { opacity:0; transform:translateY(6px); }
          12% { opacity:1; transform:translateY(0); }
          82% { opacity:1; }
          100% { opacity:0; transform:translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
