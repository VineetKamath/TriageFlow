import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const TOTAL_PAGES = 5;
const HERO_TAGLINES = [
  'Predict the crisis. Not just respond to it.',
  'AI-powered resource optimization for Bengaluru.',
  'Built for Google Solution Challenge 2026.',
];

const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }),
};

function useCountUp(target, duration = 1500, active = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, active]);

  return count;
}

export default function LandingOverlay({ onStartDashboard, onRunDemo, feedbackSummary, onWatchDemo }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [featureTab, setFeatureTab] = useState(0);
  const featureInteractedRef = useRef(false);
  const overlayRef = useRef(null);
  const liveDemoUrl = import.meta.env.VITE_LIVE_DEMO_URL || 'https://your-live-demo-url.web.app';

  const goToPage = useCallback((page) => {
    if (page < 0 || page >= TOTAL_PAGES || page === currentPage) return;
    setDirection(page > currentPage ? 1 : -1);
    setCurrentPage(page);
    setHasInteracted(true);
    setProgressKey((k) => k + 1);
  }, [currentPage]);

  const nextPage = useCallback(() => {
    if (currentPage === TOTAL_PAGES - 1) return;
    setDirection(1);
    setCurrentPage((p) => Math.min(TOTAL_PAGES - 1, p + 1));
    setHasInteracted(true);
    setProgressKey((k) => k + 1);
  }, [currentPage]);

  const prevPage = useCallback(() => {
    if (currentPage === 0) return;
    setDirection(-1);
    setCurrentPage((p) => Math.max(0, p - 1));
    setHasInteracted(true);
    setProgressKey((k) => k + 1);
  }, [currentPage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTaglineIndex((i) => (i + 1) % HERO_TAGLINES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasInteracted || currentPage === 4) return undefined;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentPage((p) => {
        if (p >= 4) return p;
        return p + 1;
      });
      setProgressKey((k) => k + 1);
    }, 8000);
    return () => clearInterval(timer);
  }, [hasInteracted, currentPage]);

  useEffect(() => {
    if (currentPage !== 3 || featureInteractedRef.current) return undefined;
    const timer = setInterval(() => {
      setFeatureTab((t) => (t + 1) % 6);
    }, 3000);
    return () => clearInterval(timer);
  }, [currentPage]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onStartDashboard();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        if (currentPage === 4 && event.key === 'Enter') {
          onStartDashboard();
        } else {
          nextPage();
        }
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevPage();
      }
      if (event.key === 'Enter' && currentPage === 4) {
        event.preventDefault();
        onStartDashboard();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, nextPage, onStartDashboard, prevPage]);

  let pageContent;
  switch (currentPage) {
    case 0:
      pageContent = (
        <HeroPage
          feedbackSummary={feedbackSummary}
          liveDemoUrl={liveDemoUrl}
          onStartDashboard={onStartDashboard}
          onRunDemo={onRunDemo}
          onWatchDemo={onWatchDemo}
          onSeeHowItWorks={() => goToPage(1)}
          taglineIndex={taglineIndex}
        />
      );
      break;
    case 1:
      pageContent = <ProblemPage />;
      break;
    case 2:
      pageContent = <PipelinePage active={currentPage === 2} />;
      break;
    case 3:
      pageContent = (
        <FeatureTourPage
          featureTab={featureTab}
          onSelectTab={(tab) => {
            featureInteractedRef.current = true;
            setHasInteracted(true);
            setFeatureTab(tab);
          }}
        />
      );
      break;
    case 4:
      pageContent = <ImpactPage active={currentPage === 4} onStartDashboard={onStartDashboard} onRunDemo={onRunDemo} onWatchDemo={onWatchDemo} />;
      break;
    default:
      pageContent = null;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[4000] overflow-hidden bg-[linear-gradient(135deg,#EDF2FF_0%,#F0F4FA_50%,#E8F0FE_100%)]"
    >
      <div className="absolute inset-0 opacity-100 pointer-events-none [background-image:radial-gradient(circle,rgba(26,115,232,0.08)_1px,transparent_1px)] [background-size:28px_28px] animate-[grid-drift_20s_linear_infinite]" />

      {currentPage !== 4 && (
        <div
          key={progressKey}
          className="absolute top-0 left-0 right-0 h-[2px] bg-transparent z-20"
          onMouseEnter={(e) => {
            const bar = e.currentTarget.querySelector('[data-progress]');
            if (bar) bar.style.animationPlayState = 'paused';
          }}
          onMouseLeave={(e) => {
            const bar = e.currentTarget.querySelector('[data-progress]');
            if (bar) bar.style.animationPlayState = 'running';
          }}
        >
          <div
            data-progress="true"
            className="h-full bg-[#1A73E8] origin-left animate-[progress-fill_8s_linear_forwards]"
          />
        </div>
      )}

      {currentPage > 0 ? (
        <div className="relative z-10 h-16 px-6 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white shadow-md border border-[rgba(26,115,232,0.15)] flex items-center justify-center shrink-0">
              <ShieldLogo className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 leading-none">
              <span className="font-bold text-[#1C2B4A] text-base leading-none">TriageFlow</span>
              <span className="text-[9px] bg-[#E8F0FE] text-[#1A73E8] px-1.5 py-0.5 rounded font-mono font-semibold">GDG</span>
            </div>
          </div>

          <PageDots currentPage={currentPage} onDotClick={goToPage} />

          <button
            onClick={onStartDashboard}
            className="text-[12px] font-mono text-[#5F6B7C] hover:text-[#1A73E8] transition-colors"
          >
            Skip to Dashboard →
          </button>
        </div>
      ) : (
        <div className="absolute top-5 right-6 md:right-10 z-20">
          <button
            onClick={onStartDashboard}
            className="text-[12px] font-mono text-[#5F6B7C] hover:text-[#1A73E8] transition-colors"
          >
            Skip →
          </button>
        </div>
      )}

      <div className="relative z-10 h-full px-6 md:px-10 pb-20 pt-4 md:pt-2">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentPage}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full"
          >
            {pageContent}
          </motion.div>
        </AnimatePresence>
      </div>

      {currentPage !== 4 && (
        <div className="absolute bottom-5 left-0 right-0 z-20 px-6 md:px-10 flex items-center justify-between">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="w-10 h-10 rounded-full bg-white border border-[rgba(99,120,160,0.18)] shadow-sm flex items-center justify-center text-[#5F6B7C] hover:bg-[#1A73E8] hover:border-[#1A73E8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon />
          </button>

          <div className="flex items-center gap-4">
            <PageDots currentPage={currentPage} onDotClick={goToPage} />
            <span className="text-[12px] font-mono text-[#5F6B7C]">{currentPage + 1} / 5</span>
          </div>

          <button
            onClick={nextPage}
            className="w-10 h-10 rounded-full bg-white border border-[rgba(99,120,160,0.18)] shadow-sm flex items-center justify-center text-[#5F6B7C] hover:bg-[#1A73E8] hover:border-[#1A73E8] hover:text-white transition-colors"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

      <style>{`
        @keyframes grid-drift {
          0% { background-position: 0 0; }
          100% { background-position: 28px 28px; }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes draw-line {
          to { stroke-dashoffset: 0; }
        }
        @keyframes progress-fill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes bounce-arrow {
          0%,100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(5px); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}

function PageDots({ currentPage, onDotClick }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          className={[
            'h-2 rounded-full transition-all duration-300',
            currentPage === i ? 'w-6 bg-[#1A73E8]' : 'w-2 bg-transparent border border-[rgba(99,120,160,0.35)]',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

function HeroPage({ feedbackSummary, liveDemoUrl, onStartDashboard, onRunDemo, onWatchDemo, onSeeHowItWorks, taglineIndex }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-5xl mx-auto">
      <div className="w-32 h-32 bg-white rounded-2xl shadow-xl border border-[rgba(99,120,160,0.15)] flex items-center justify-center mb-8 animate-[float_3s_ease-in-out_infinite]">
        <ShieldLogo className="w-16 h-16" />
      </div>

      <h1 className="text-[56px] md:text-[72px] font-extrabold tracking-[-2px] bg-[linear-gradient(135deg,#1C2B4A_0%,#1A73E8_100%)] bg-clip-text text-transparent">
        TriageFlow
      </h1>
      <p className="font-mono text-[12px] tracking-[0.2em] text-[#5F6B7C] mt-3">
        TACTICAL EMERGENCY RESOURCE COMMAND CENTER
      </p>

      <div className="h-8 mt-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={taglineIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-base italic text-[#1A73E8]"
          >
            {HERO_TAGLINES[taglineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-8">
        {[
          { value: '20', label: 'Zones Monitored' },
          { value: '7', label: 'Min Faster Response' },
          { value: 'AI', label: 'Powered by Gemini' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl px-5 py-3 shadow-sm border border-[rgba(99,120,160,0.12)] min-w-[150px]">
            <div className="text-2xl font-bold text-[#1C2B4A]">{item.value}</div>
            <div className="text-[10px] font-mono text-[#5F6B7C] uppercase tracking-widest mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {feedbackSummary?.total_testers > 0 && (
        <div className="mt-6 inline-flex items-center rounded-full border border-[#1A73E8]/25 bg-white px-4 py-2 text-xs font-mono text-[#5F6B7C]">
          {feedbackSummary.total_testers} testers • {feedbackSummary.trust_yes_percent}% would trust in emergency
        </div>
      )}

      <p className="text-sm text-[#1A73E8] mt-5">
        Live demo:{' '}
        <a className="underline" href={liveDemoUrl} target="_blank" rel="noreferrer">
          {liveDemoUrl}
        </a>
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
        <button
          onClick={onStartDashboard}
          className="min-w-[190px] h-[52px] rounded-xl bg-[#1A73E8] text-white px-6 font-semibold text-[15px] shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
        >
          <PulseIcon className="w-5 h-5" />
          Start Dashboard
        </button>
        <button
          onClick={onWatchDemo}
          className="min-w-[190px] h-[52px] rounded-xl bg-[#1C2B4A] text-white px-6 font-semibold text-[15px] shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 border border-[rgba(26,115,232,0.3)]"
        >
          Watch Full Demo
        </button>
        <button
          onClick={onRunDemo}
          className="min-w-[190px] h-[52px] rounded-xl bg-[#E37400] text-white px-6 font-semibold text-[15px] shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
        >
          <PlayIcon className="w-5 h-5" />
          Run Scenario
        </button>
      </div>

      <button onClick={onSeeHowItWorks} className="mt-8 flex flex-col items-center text-[11px] font-mono text-[#5F6B7C]">
        <span>↓ See how it works</span>
        <span className="animate-[bounce-arrow_1.5s_ease-in-out_infinite]">↓</span>
      </button>

      <div className="mt-8 inline-flex items-center gap-3 px-6 py-3 bg-white border border-[#1A73E8]/20 rounded-full shadow-lg">
        <GlobeIcon className="w-4 h-4 text-[#1A73E8]" />
        <span className="text-[#1C2B4A] font-medium text-sm">GDG Solution Challenge 2026 • Live Monitoring Enabled</span>
      </div>
    </div>
  );
}

function ProblemPage() {
  const painPoints = [
    { title: 'Average 11-min response time', sub: 'Without predictive positioning', border: 'border-l-[#D93025]' },
    { title: 'Reactive deployment', sub: 'Units dispatched after calls, not before', border: 'border-l-[#E37400]' },
    { title: 'No real-time coordination', sub: 'Manual tracking across 20+ zones', border: 'border-l-[#D93025]' },
  ];

  const withoutSteps = [
    ['0:00', 'Flood event begins'],
    ['2:00', 'First 911 calls'],
    ['5:00', 'Coordinator alerted'],
    ['8:00', 'Units dispatched'],
    ['11:00', 'Response arrives'],
  ];
  const withSteps = [
    ['0:00', 'Flood event begins'],
    ['0:30', 'AI detects pressure spike'],
    ['1:00', 'Optimization triggered'],
    ['2:30', 'Units pre-positioned'],
    ['4:00', 'Response ready'],
  ];

  return (
    <div className="h-full flex items-center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 w-full max-w-7xl mx-auto">
        <div className="flex flex-col justify-center">
          <div className="font-mono text-[#1A73E8] uppercase tracking-[0.18em] text-[11px]">THE CHALLENGE</div>
          <h2 className="mt-3 text-[30px] md:text-[36px] font-extrabold text-[#1C2B4A] leading-tight">
            When disasters strike, every second counts.
          </h2>
          <p className="mt-4 text-[15px] text-[#5F6B7C] leading-7 max-w-xl">
            Traditional emergency response is reactive. By the time coordinators identify resource gaps and dispatch units, critical
            time has already been lost. In flood scenarios, this delay costs lives.
          </p>

          <div className="mt-8 space-y-3">
            {painPoints.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * (i + 1) }}
                className={`bg-white border-l-4 ${item.border} rounded-lg p-4 flex items-center gap-4 shadow-sm border border-[rgba(99,120,160,0.12)]`}
              >
                <div>
                  <div className="text-[15px] font-bold text-[#1C2B4A]">{item.title}</div>
                  <div className="text-[13px] text-[#5F6B7C]">{item.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TimelineStrip title="WITHOUT TriageFlow" tone="red" steps={withoutSteps} highlight="11 MINUTES" />
            <TimelineStrip title="WITH TriageFlow" tone="green" steps={withSteps} highlight="4 MINUTES" />
          </div>
          <div className="mt-6 text-[28px] md:text-[32px] font-extrabold text-[#1E8E6E] text-center">
            7 minutes saved per incident
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelinePage({ active }) {
  const countZones = useCountUp(20, 1500, active);
  const countUnits = useCountUp(40, 1500, active);
  const countCycle = useCountUp(30, 1500, active);
  const countForecast = useCountUp(60, 1500, active);

  const nodes = [
    {
      num: '01',
      title: 'Live Signals',
      sub: 'Weather, crowd density, ER wait times, incident reports',
      gradient: 'from-[#1A73E8] to-[#5B9CFF]',
      icon: <DatabaseIcon className="w-7 h-7 text-white" />,
    },
    {
      num: '02',
      title: 'Pressure Scoring',
      sub: 'ML model scores each zone 0-100 every 30 seconds',
      gradient: 'from-[#7B61FF] to-[#A18BFF]',
      icon: <BrainChipIcon className="w-7 h-7 text-white" />,
    },
    {
      num: '03',
      title: 'Resource Allocation',
      sub: 'Greedy optimizer distributes units to highest-need zones',
      gradient: 'from-[#E37400] to-[#FFAD55]',
      icon: <OptimizeIcon className="w-7 h-7 text-white" />,
    },
    {
      num: '04',
      title: 'Commander Decision',
      sub: 'One-click accept or AI auto-apply in crisis mode',
      gradient: 'from-[#1E8E6E] to-[#4FC79C]',
      icon: <DispatchIcon className="w-7 h-7 text-white" />,
    },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-7xl mx-auto">
      <h2 className="text-[34px] md:text-[40px] font-extrabold text-[#1C2B4A] text-center">How TriageFlow Works</h2>
      <p className="text-[15px] text-[#5F6B7C] mt-3 mb-10 text-center">
        A 4-step AI pipeline that predicts, optimizes, and acts.
      </p>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[980px] flex items-center justify-center gap-4">
          {nodes.map((node, i) => (
            <FragmentPipeline key={node.title} node={node} index={i} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-8">
        {['Gemini AI', 'FastAPI', 'Leaflet Maps', 'Firebase'].map((text) => (
          <div key={text} className="bg-white border border-[rgba(99,120,160,0.15)] rounded-full px-4 py-2 text-[12px] font-mono text-[#1C2B4A]">
            {text}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10">
        <CounterCard value={countZones} label="Zones" />
        <CounterCard value={countUnits} label="Units" />
        <CounterCard value={countCycle} label="s Update Cycle" />
        <CounterCard value={countForecast} label="min Forecast" />
      </div>
    </div>
  );
}

function FragmentPipeline({ node, index }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.8, duration: 0.45 }}
        className="relative w-[180px] bg-white rounded-2xl shadow-md p-5 text-center border border-[rgba(99,120,160,0.12)]"
      >
        <div className="absolute top-3 left-3 text-[11px] font-mono text-[#9AA3B0]">{node.num}</div>
        <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${node.gradient} flex items-center justify-center`}>
          {node.icon}
        </div>
        <div className="mt-4 text-[16px] font-bold text-[#1C2B4A]">{node.title}</div>
        <div className="mt-2 text-[13px] text-[#5F6B7C] leading-6">{node.sub}</div>
      </motion.div>
      {index < 3 && (
        <svg width="90" height="30" viewBox="0 0 90 30" className="shrink-0">
          <line
            x1="4"
            y1="15"
            x2="86"
            y2="15"
            stroke="#1A73E8"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeDashoffset="90"
            style={{ animation: `draw-line 0.6s ease forwards ${0.4 + index * 0.8}s` }}
          />
          <path
            d="M80 10 L86 15 L80 20"
            fill="none"
            stroke="#1A73E8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="20"
            strokeDashoffset="20"
            style={{ animation: `draw-line 0.6s ease forwards ${0.4 + index * 0.8}s` }}
          />
        </svg>
      )}
    </>
  );
}

function CounterCard({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-[28px] font-bold text-[#1A73E8]">{value}</div>
      <div className="text-[10px] font-mono text-[#5F6B7C] uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

function FeatureTourPage({ featureTab, onSelectTab }) {
  const tabs = [
    'Live Pressure Map',
    'AI Suggestions',
    'Resource Optimizer',
    '60-Min Forecast',
    'AI Assistant',
    'Impact Report',
  ];

  const content = [
    {
      title: 'Live Pressure Map',
      desc: 'Monitor Bengaluru wards in real time with live status highlighting, responder positions, and weather-aware overlays.',
      mockup: <MapMockup />,
    },
    {
      title: 'AI Suggestions',
      desc: 'TriageFlow explains where to move units and why, so operators can accept or dismiss recommendations in one click.',
      mockup: <SuggestionMockup />,
    },
    {
      title: 'Resource Optimizer',
      desc: 'The optimization engine continuously redistributes available resources toward the highest pressure zones across the city.',
      mockup: <OptimizerMockup />,
    },
    {
      title: '60-Min Forecast',
      desc: 'Project pressure trends ahead of time and catch surge conditions before they force reactive dispatch.',
      mockup: <ForecastMockup />,
    },
    {
      title: 'AI Assistant',
      desc: 'Ask natural-language questions like “What’s most urgent?” and get concise, operational guidance from current system state.',
      mockup: <AssistantMockup />,
    },
    {
      title: 'Impact Report',
      desc: 'Translate optimizations into measurable outcomes like minutes saved, zones protected, and sustainable-city impact.',
      mockup: <ImpactMockup />,
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center max-w-7xl mx-auto">
      <h2 className="text-[32px] md:text-[36px] font-extrabold text-[#1C2B4A] text-center">
        Everything you need in one command center
      </h2>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-8 items-start">
        <div className="hidden md:flex flex-col gap-3">
          {tabs.map((label, i) => (
            <button
              key={label}
              onClick={() => onSelectTab(i)}
              className={[
                'rounded-lg p-3 text-left transition-colors',
                featureTab === i ? 'bg-[#1A73E8] text-white shadow-md' : 'bg-transparent hover:bg-white text-[#5F6B7C]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="md:hidden overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {tabs.map((label, i) => (
              <button
                key={label}
                onClick={() => onSelectTab(i)}
                className={[
                  'rounded-full px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  featureTab === i ? 'bg-[#1A73E8] text-white shadow-md' : 'bg-white text-[#5F6B7C] border border-[rgba(99,120,160,0.15)]',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[rgba(99,120,160,0.12)] shadow-lg p-6 min-h-[410px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={featureTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mt-3 text-[20px] font-bold text-[#1C2B4A]">{content[featureTab].title}</div>
              <p className="mt-3 text-[14px] text-[#5F6B7C] leading-7 max-w-2xl">{content[featureTab].desc}</p>
              <div className="mt-6 flex justify-center md:justify-start">{content[featureTab].mockup}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ImpactPage({ active, onStartDashboard, onRunDemo, onWatchDemo }) {
  const faster = useCountUp(7, 1000, active);
  const people = useCountUp(84, 1200, active);
  const zones = useCountUp(20, 1400, active);
  const sdgs = useCountUp(2, 1000, active);

  return (
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto pb-16 md:pb-8">
      <div className="bg-white rounded-2xl p-8 shadow-xl border border-[rgba(99,120,160,0.12)] max-w-5xl mx-auto w-full">
        <h2 className="text-[28px] md:text-[32px] font-extrabold text-[#1C2B4A] text-center mb-8">
          Real Impact, Measurable Results
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <ImpactStat value={faster} unit="minutes" label="faster response per incident" color="#1A73E8" />
          <ImpactStat value={people} unit="people" label="reached faster per suggestion" color="#1E8E6E" />
          <ImpactStat value={zones} unit="zones" label="monitored simultaneously" color="#E37400" />
          <ImpactStat value={sdgs} unit="SDGs" label="SDG 3 + SDG 11 aligned" color="#7B61FF" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <SdgCard
          color="#1E8E6E"
          title="SDG 3: Good Health & Well-being"
          text="Faster emergency response reduces mortality in flood events"
        />
        <SdgCard
          color="#E37400"
          title="SDG 11: Sustainable Cities"
          text="Real-time urban resource optimization for resilient communities"
        />
      </div>

      <div className="mt-8 rounded-2xl bg-gradient-to-r from-[#1A73E8] to-[#5B9CFF] text-white px-6 py-4 shadow-lg text-center font-semibold">
        Built for Google Developer Group Solution Challenge 2026
      </div>

      <div className="mt-10 text-center">
        <h3 className="text-[24px] font-bold text-[#1C2B4A]">Ready to see it in action?</h3>
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onWatchDemo}
            className="h-14 min-w-[220px] rounded-xl bg-[#1C2B4A] text-white font-bold text-[15px] px-6 shadow-lg hover:scale-[1.02] transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap border border-[rgba(26,115,232,0.4)]"
          >
            <span className="shrink-0">Watch Full Demo</span>
          </button>
          <button
            onClick={onStartDashboard}
            className="h-14 min-w-[200px] rounded-xl bg-[#1A73E8] text-white font-bold text-[15px] px-6 shadow-lg hover:scale-[1.02] hover:shadow-xl transition-all inline-flex items-center justify-center gap-3 whitespace-nowrap"
          >
            <PulseIcon className="w-5 h-5 shrink-0" />
            <span className="shrink-0">Launch Dashboard</span>
          </button>
          <button
            onClick={onRunDemo}
            className="h-14 min-w-[160px] rounded-xl border-2 border-[#E37400] text-[#E37400] font-bold text-[15px] px-6 hover:bg-[#FFF3E0] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <PlayIcon className="w-5 h-5 shrink-0" />
            <span className="shrink-0">Run Scenario</span>
          </button>
        </div>
        <div className="mt-4 text-[12px] text-[#9AA3B0] font-mono">No login required • Open source • Bengaluru focused</div>
      </div>
    </div>
  );
}

function ImpactStat({ value, unit, label, color }) {
  return (
    <div className="text-center">
      <div className="text-[48px] font-mono font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-[14px] text-[#5F6B7C] mt-2">{unit}</div>
      <div className="text-[11px] uppercase font-mono tracking-widest text-[#9AA3B0] mt-2">{label}</div>
    </div>
  );
}

function SdgCard({ color, title, text }) {
  return (
    <div className="bg-white rounded-xl border border-[rgba(99,120,160,0.12)] shadow-sm p-5 border-l-4" style={{ borderLeftColor: color }}>
      <div className="mt-2 text-[18px] font-bold text-[#1C2B4A]">{title}</div>
      <div className="mt-2 text-[14px] text-[#5F6B7C] leading-7">{text}</div>
    </div>
  );
}

function TimelineStrip({ title, tone, steps, highlight }) {
  const pill = tone === 'red' ? 'bg-[#FEE8E7] text-[#D93025]' : 'bg-[#E6F4EA] text-[#1E8E6E]';
  const line = tone === 'red' ? '#D93025' : '#1E8E6E';
  return (
    <div className="bg-white rounded-2xl border border-[rgba(99,120,160,0.12)] shadow-sm p-5">
      <div className={`inline-flex px-3 py-1 rounded-full text-[11px] font-mono ${pill}`}>{title}</div>
      <div className="mt-5 relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-[2px] overflow-hidden">
          <div className="w-full h-full origin-top animate-[line-grow_1.1s_ease_forwards]" style={{ background: line }} />
        </div>
        <style>{`@keyframes line-grow { 0% { transform: scaleY(0); } 100% { transform: scaleY(1); } }`}</style>
        <div className="space-y-5">
          {steps.map(([time, text], idx) => (
            <div key={time} className="flex gap-3 relative">
              <div className="w-6 flex justify-center pt-0.5">
                <div className="w-3 h-3 rounded-full bg-white border-2" style={{ borderColor: line }} />
              </div>
              <div>
                <div className="text-[11px] font-mono text-[#5F6B7C]">{time}</div>
                <div className="text-[13px] text-[#1C2B4A]">
                  {text}{idx === steps.length - 1 && <span className="ml-2 font-bold" style={{ color: line }}>{highlight}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapMockup() {
  const cells = Array.from({ length: 20 });
  return (
    <div className="w-full max-w-[420px] h-[220px] rounded-xl border border-[rgba(99,120,160,0.15)] bg-[#0F1218] p-3 overflow-hidden">
      <div className="relative h-[160px]">
        <div className="grid grid-cols-5 gap-2 h-full">
          {cells.map((_, i) => (
            <div
              key={i}
              className="rounded-md opacity-90"
              style={{
                background:
                  i % 7 === 0 ? 'rgba(217,48,37,0.65)' : i % 5 === 0 ? 'rgba(227,116,0,0.65)' : 'rgba(30,142,110,0.65)',
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0">
          {[12, 36, 50, 88, 104, 120, 190, 240, 290, 330].map((left, i) => (
            <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-[#1A73E8] border border-white" style={{ left, top: 20 + ((i * 17) % 120) }} />
          ))}
        </div>
      </div>
      <div className="mt-4 text-[12px] text-white/80">Live Bengaluru ward map with pressure zones</div>
    </div>
  );
}

function SuggestionMockup() {
  return (
    <div className="max-w-[420px] rounded-xl border border-[rgba(99,120,160,0.15)] bg-white shadow-sm p-4 border-l-4 border-l-[#1E8E6E]">
      <div className="text-[16px] font-bold text-[#1C2B4A]">Move 2 units → Zone KR Puram</div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {['High pressure', 'Rain detected'].map((tag) => (
          <span key={tag} className="px-2 py-1 rounded-md bg-[#F8FAFF] border border-[rgba(99,120,160,0.15)] text-[11px] font-mono text-[#5F6B7C]">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex-1 h-9 rounded-lg bg-[#E6F4EA] border border-[rgba(30,142,110,0.25)] flex items-center justify-center text-[#1E8E6E] font-semibold text-sm">
          Accept
        </div>
        <div className="flex-1 h-9 rounded-lg bg-white border border-[rgba(99,120,160,0.2)] flex items-center justify-center text-[#5F6B7C] font-semibold text-sm">
          Dismiss
        </div>
      </div>
    </div>
  );
}

function OptimizerMockup() {
  return (
    <div className="max-w-[420px] rounded-xl border border-[rgba(99,120,160,0.15)] bg-white shadow-sm p-4">
      <div className="flex items-center gap-4">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" stroke="rgba(99,120,160,0.18)" strokeWidth="8" fill="none" />
          <circle cx="36" cy="36" r="28" stroke="#1E8E6E" strokeWidth="8" fill="none" strokeDasharray="128 176" transform="rotate(-90 36 36)" />
          <text x="36" y="40" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1C2B4A">73%</text>
        </svg>
        <div className="flex-1 space-y-3">
          {['KR Puram', 'Bellandur', 'HSR Layout'].map((z, i) => (
            <div key={z} className="flex items-center gap-2">
              <div className="w-24 text-[11px] text-[#1C2B4A] font-semibold">{z}</div>
              <div className="flex-1 h-2 rounded bg-[#EEF3FF]">
                <div className="h-2 rounded bg-[#1A73E8]" style={{ width: `${75 - i * 18}%` }} />
              </div>
              <span className="px-2 py-0.5 rounded border bg-[#E6F4EA] text-[#1E8E6E] text-[10px] font-mono">+2</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 h-10 rounded-xl bg-[#1A73E8] text-white flex items-center justify-center font-semibold">Apply All</div>
    </div>
  );
}

function ForecastMockup() {
  return (
    <div className="max-w-[420px] rounded-xl border border-[rgba(99,120,160,0.15)] bg-white shadow-sm p-4">
      <svg width="100%" height="190" viewBox="0 0 380 190">
        <line x1="30" y1="10" x2="30" y2="160" stroke="rgba(99,120,160,0.25)" />
        <line x1="30" y1="160" x2="360" y2="160" stroke="rgba(99,120,160,0.25)" />
        <path
          d="M30 130 C80 128, 110 126, 150 124 S220 120, 250 118 S290 105, 320 70 S350 40, 360 28"
          fill="none"
          stroke="#1A73E8"
          strokeWidth="3"
        />
        <path d="M230 20 L230 160" stroke="#D93025" strokeWidth="2" strokeDasharray="6 6" />
        <text x="236" y="25" fontSize="11" fill="#D93025">Surge</text>
        {[0, 15, 30, 45, 60].map((x, i) => (
          <text key={x} x={30 + i * 82.5} y="178" fontSize="10" fill="#5F6B7C">{x}</text>
        ))}
      </svg>
    </div>
  );
}

function AssistantMockup() {
  return (
    <div className="max-w-[420px] rounded-xl border border-[rgba(99,120,160,0.15)] bg-white shadow-sm p-4">
      <div className="flex justify-end">
        <div className="max-w-[240px] rounded-xl bg-[#1A73E8] text-white px-3 py-2 text-sm">What&apos;s most urgent?</div>
      </div>
      <div className="mt-3 flex justify-start">
        <div className="max-w-[300px] rounded-xl bg-[#F8FAFF] border-l-4 border-[#1A73E8] text-[#1C2B4A] px-3 py-2 text-sm">
          Zone KR Puram will hit critical in ~12 min. Pre-deploy 2 units from Whitefield.
        </div>
      </div>
      <div className="mt-5 h-10 rounded-lg border border-[rgba(99,120,160,0.18)] px-3 flex items-center text-[#9AA3B0] text-sm">
        Ask a question…
      </div>
    </div>
  );
}

function ImpactMockup() {
  return (
    <div className="max-w-[420px] rounded-xl border border-[rgba(99,120,160,0.15)] bg-white shadow-sm p-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['49', 'min saved', '#1A73E8'],
          ['18', 'zones protected', '#1E8E6E'],
          ['11', 'SDG aligned', '#7B61FF'],
        ].map(([v, l, c]) => (
          <div key={l} className="rounded-xl bg-[#F8FAFF] p-3 text-center">
            <div className="text-2xl font-extrabold" style={{ color: c }}>{v}</div>
            <div className="text-[10px] font-mono text-[#5F6B7C] uppercase tracking-widest mt-1">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 h-10 rounded-xl border border-[rgba(26,115,232,0.22)] bg-[#EEF3FF] text-[#1A73E8] flex items-center justify-center font-semibold">
        Download Report
      </div>
    </div>
  );
}

function ShieldLogo({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 7V12C3 17.5 7 21 12 22C17 21 21 17.5 21 12V7L12 2Z" fill="#1A73E8" />
      <path d="M12 22C12 22 17 21 21 12V7L12 2L3 7V12C3 17.5 7 21 12 22" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M3 12H7L10 7L14 17L17 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5V18.5L18 12L8 5.5Z" />
    </svg>
  );
}

function GlobeIcon({ className = 'w-4 h-4 text-[#1A73E8]' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12H21" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3C14.8 5.8 16.4 8.8 16.4 12C16.4 15.2 14.8 18.2 12 21" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3C9.2 5.8 7.6 8.8 7.6 12C7.6 15.2 9.2 18.2 12 21" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DatabaseIcon({ className = 'w-6 h-6 text-white' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="7" ry="3" fill="currentColor" />
      <path d="M5 6V12C5 13.7 8.1 15 12 15C15.9 15 19 13.7 19 12V6" fill="currentColor" opacity="0.85" />
      <path d="M5 12V18C5 19.7 8.1 21 12 21C15.9 21 19 19.7 19 18V12" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function BrainChipIcon({ className = 'w-6 h-6 text-white' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
      <path d="M10 3V7M14 3V7M10 17V21M14 17V21M3 10H7M3 14H7M17 10H21M17 14H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function OptimizeIcon({ className = 'w-6 h-6 text-white' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M6 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 6L18 12L12 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DispatchIcon({ className = 'w-6 h-6 text-white' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M5 12L10 17L19 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
