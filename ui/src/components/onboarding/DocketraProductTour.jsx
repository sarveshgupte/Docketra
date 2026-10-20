import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Building2,
  HardDrive,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Compass,
  UserPlus,
} from './OnboardingIcons';

const TOUR_STEPS = [
  {
    step: 1,
    title: 'Financial Year & Fast Controls',
    category: 'Persistent Shell',
    icon: Calendar,
    color: 'text-amber-400',
    description: 'Switch between financial years (25-26 / 26-27) seamlessly. Use Ctrl/⌘+K to jump anywhere in Docketra, or use the persistent "+ New" menu for instant matters and statutory dates.',
    tip: 'Financial year context is preserved across all compliance views.',
  },
  {
    step: 2,
    title: 'PCS Daily Command Center',
    category: 'Statutory Radar',
    icon: Compass,
    color: 'text-sky-400',
    description: 'Your morning operational radar. Track Overdue MCA/GST filings, T-7 deadlines, NCLT/RD tribunal cause list listings, and pending client Director DSC signatures with zero layout shift.',
    tip: 'Table rows are compacted to 36px with monospace CIN & DIN formatting.',
  },
  {
    step: 3,
    title: 'Dockets & Operational Workbaskets',
    category: 'Work Execution',
    icon: Layers,
    color: 'text-purple-400',
    description: 'Work flows through Intake → Pull Queue (Workbaskets) → Execution (My Worklist) → QC Review → Completion. Nothing slips through unassigned cracks.',
    tip: 'Dockets carry immutable audit history for every status transition.',
  },
  {
    step: 4,
    title: 'Corporate Client Workspace',
    category: 'Entity Master',
    icon: Building2,
    color: 'text-emerald-400',
    description: 'Comprehensive 3-pane client workspace. View entity master (CIN, PAN, authorized capital), key directors, active litigation timelines, and statutory due dates side-by-side.',
    tip: 'Click any CIN or SRN to copy directly to your clipboard.',
  },
  {
    step: 5,
    title: 'Zero-Custody Document Vault (BYOS)',
    category: 'Document Storage',
    icon: HardDrive,
    color: 'text-amber-400',
    description: 'All dockets and filings are saved directly into your firm’s cloud storage (Google Drive / S3). Docketra never takes permanent custody of confidential files.',
    tip: 'Deterministic folder structure: Google Drive > Docketra > Firm > Cases.',
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
      if (onCompleteTour) onCompleteTour();
      if (onAddFirstClient) onAddFirstClient();
      if (onClose) onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    if (onCompleteTour) onCompleteTour();
    if (onClose) onClose();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-5 backdrop-blur text-slate-200 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
              Docketra Tour · Step {currentStep.step} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Close Tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <StepIcon className={`h-5 w-5 ${currentStep.color}`} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                {currentStep.category}
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          <div className="p-2.5 rounded-xl bg-[#070A11] border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{currentStep.tip}</span>
          </div>
        </div>

        {/* Footer Navigation Controls */}
        <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'w-5 bg-amber-400'
                    : idx < currentStepIndex
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
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
