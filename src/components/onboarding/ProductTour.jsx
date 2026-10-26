import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appClient } from '@/api/appClient';
import { toast } from 'sonner';

const STEPS = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Your Command Center',
    description: 'The Dashboard gives you a real-time overview of all active onboarding projects, health scores, and key metrics at a glance.',
    placement: 'right',
  },
  {
    target: '[data-tour="projects"]',
    title: 'Manage Your Projects',
    description: 'Create and track client onboarding projects here. Each project has milestones, timelines, and health scores to keep you on track.',
    placement: 'right',
  },
  {
    target: '[data-tour="calendar-bots"]',
    title: 'Meeting Bots',
    description: 'Connect your Google Calendar and our bot will automatically join every client meeting to capture transcripts — no manual note-taking.',
    placement: 'right',
  },
  {
    target: '[data-tour="call-insights"]',
    title: 'Call Intelligence',
    description: 'Configured rules scan each transcript for follow-up phrases, milestone changes, and risk keywords.',
    placement: 'right',
  },
  {
    target: '[data-tour="action-items"]',
    title: 'Action Items',
    description: 'Review action items detected from call notes. Approve them to sync to Monday.com boards.',
    placement: 'right',
  },
  {
    target: '[data-tour="risk-keywords"]',
    title: 'Risk Detection',
    description: 'Configure keywords that trigger alerts when detected in transcripts — like "churn", "cancel", or "disappointed".',
    placement: 'right',
  },
  {
    target: '[data-tour="integrations"]',
    title: 'Integrations',
    description: 'Connect Monday.com to sync action items and risk signals directly into your boards. Setup takes under 2 minutes.',
    placement: 'right',
  },
];

function getElementRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function Spotlight({ rect }) {
  if (!rect) return null;
  const pad = 8;
  return createPortal(
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {/* dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ mixBlendMode: 'normal' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - pad}
              y={rect.top - pad}
              width={rect.width + pad * 2}
              height={rect.height + pad * 2}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#spotlight-mask)" />
      </svg>
      {/* highlight ring */}
      <div
        className="absolute rounded-lg ring-2 ring-indigo-400 ring-offset-0 transition-all duration-300"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
    </div>,
    document.body
  );
}

function Tooltip({ step, stepIndex, total, rect, onNext, onPrev, onSkip }) {
  if (!rect) return null;

  const pad = 8;
  const tooltipWidth = 300;
  const gap = 16;

  let left = rect.right + gap;
  let top = rect.top + rect.height / 2 - 100;

  // Keep in viewport
  if (left + tooltipWidth > window.innerWidth - 16) {
    left = rect.left - tooltipWidth - gap;
  }
  if (top < 16) top = 16;
  if (top + 220 > window.innerHeight - 16) top = window.innerHeight - 236;

  return createPortal(
    <div
      className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 transition-all duration-300"
      style={{ left, top, width: tooltipWidth }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          {stepIndex + 1} of {total}
        </span>
        <button type="button" aria-label="Close tour" onClick={onSkip} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <h3 className="font-bold text-slate-900 text-base mb-1.5">{step.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-4">{step.description}</p>

      {/* Progress dots */}
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-4 bg-indigo-500' : 'w-1.5 bg-slate-200'}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="text-slate-400 text-xs">
          Skip tour
        </Button>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button variant="outline" size="sm" onClick={onPrev} className="gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            {stepIndex === total - 1 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ProductTour({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const finishing = useRef(false);

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    const update = () => {
      const r = getElementRect(currentStep.target);
      setRect(r);
      if (r) {
        // Scroll element into view
        const el = document.querySelector(currentStep.target);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    update();
    const t = setTimeout(update, 350); // after scroll settles
    return () => clearTimeout(t);
  }, [stepIndex]);

  const handleNext = () => {
    if (stepIndex === STEPS.length - 1) {
      finishTour();
    } else {
      setStepIndex(s => s + 1);
    }
  };

  const handlePrev = () => setStepIndex(s => s - 1);

  const finishTour = () => {
    if (finishing.current) return;
    finishing.current = true;
    onComplete();
    appClient.auth.updateMe({ onboarding_tour_completed: true }).catch(() => {
      toast.error('Tour closed, but your preference could not be saved. Please try again after reloading.');
    });
  };

  return (
    <>
      <Spotlight rect={rect} />
      <Tooltip
        step={currentStep}
        stepIndex={stepIndex}
        total={STEPS.length}
        rect={rect}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={finishTour}
      />
    </>
  );
}
