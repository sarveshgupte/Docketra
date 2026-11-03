import React, { useState } from 'react';
import {
  Layers,
  Building2,
  HardDrive,
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  UserPlus,
} from './OnboardingIcons';

const TOUR_STEPS = [
  {
    step: 1,
    title: 'My Worklist & Active Dockets',
    category: 'Work Management',
    icon: Layers,
    color: 'text-indigo-600',
    description: 'Track statutory filings, petitions, and advisory matters assigned to you. Move dockets from draft to partner review and final sign-off with a complete audit history.',
    tip: 'Click "New docket" in the top bar anytime to register a new matter or compliance task.',
  },
  {
    step: 2,
    title: 'Corporate Client Workspace',
    category: 'Client Records',
    icon: Building2,
    color: 'text-emerald-600',
    description: 'Maintain complete client profiles with CIN, PAN, authorized capital, directors, and statutory due dates in one structured view.',
    tip: 'Click any CIN or registration number to copy it directly to your clipboard.',
  },
  {
    step: 3,
    title: 'Compliance Radar & Deadlines',
    category: 'Statutory Deadlines',
    icon: Compass,
    color: 'text-sky-600',
    description: 'Stay ahead of MCA, GST, Income Tax, and tribunal cutoff dates. Track upcoming statutory deadlines and client director signatures before cutoffs.',
    tip: 'Press Ctrl+K (or ⌘K on Mac) to search across all clients, filings, and matters instantly.',
  },
  {
    step: 4,
    title: 'Firm-Owned Cloud Storage',
    category: 'Document Security',
    icon: HardDrive,
    color: 'text-amber-600',
    description: 'All filings, workpapers, and client documents are saved directly into your firm’s connected Google Drive. Docketra never takes custody of confidential files.',
    tip: 'Documents are automatically organized by client name and docket matter.',
  },
];

export function DocketraProductTour({ isOpen, onClose, onCompleteTour, onAddFirstClient }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;
  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (isLastStep) {
      if (onAddFirstClient) {
        onAddFirstClient(currentStepIndex);
      } else if (onCompleteTour) {
        onCompleteTour(currentStepIndex);
      }
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    if (onClose) onClose(currentStepIndex);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-white border border-slate-200/90 rounded-lg shadow-xl p-5 text-slate-900 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
              Docketra Tour · Step {currentStep.step} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Skip tour"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
              <StepIcon className={`h-5 w-5 ${currentStep.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                {currentStep.category}
              </span>
              <h3 className="text-sm sm:text-base font-semibold text-slate-950 tracking-tight">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {currentStep.description}
          </p>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{currentStep.tip}</span>
          </div>
        </div>

        {/* Footer Navigation Controls */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Progress indicators */}
          <div className="flex items-center gap-1.5" aria-label={`Step ${currentStep.step} of ${TOUR_STEPS.length}`}>
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === currentStepIndex
                    ? 'w-5 bg-slate-900'
                    : idx < currentStepIndex
                    ? 'w-2 bg-emerald-600'
                    : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
            >
              {isLastStep ? (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Add First Client
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocketraProductTour;
