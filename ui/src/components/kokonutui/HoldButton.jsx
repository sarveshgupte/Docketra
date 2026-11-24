/**
 * HoldButton Component
 * Adapted from Kokonut UI with /better-ui, /better-interface, and emil-design-eng polish:
 * - Press and hold to confirm high-stakes compliance actions (e.g. MCA filings, audits)
 * - Motion-safe smooth drain-back when released early
 * - Drawn check indicator upon completion
 * - Full keyboard accessibility (Enter / Space bar holding)
 * - Screen-reader aria-live announcements
 * - Native 60fps requestAnimationFrame loop with zero external animation dependencies
 */

import React, { useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import {
  Archive,
  Ban,
  Check,
  FileCheck2,
  LogOut,
  Send,
  Trash2,
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

export const holdButtonVariants = cva(
  [
    'group/hold relative inline-flex min-h-8 min-w-36 select-none items-center justify-center overflow-hidden rounded-[var(--dt-radius-control,2px)] px-3 text-xs font-medium',
    'border transition-[background-color,border-color,color] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      variant: {
        red: [
          'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100/70',
          'data-complete:border-rose-600 data-complete:bg-rose-600 data-complete:text-white',
        ],
        green: [
          'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70',
          'data-complete:border-emerald-600 data-complete:bg-emerald-600 data-complete:text-white',
        ],
        blue: [
          'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100/70',
          'data-complete:border-blue-600 data-complete:bg-blue-600 data-complete:text-white',
        ],
        compliance: [
          'border-slate-300 bg-slate-900 text-white hover:bg-slate-800',
          'data-complete:border-emerald-700 data-complete:bg-emerald-700 data-complete:text-white',
        ],
        neutral: [
          'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100/70',
          'data-complete:border-slate-900 data-complete:bg-slate-900 data-complete:text-white',
        ],
      },
      size: {
        sm: 'min-h-7 px-2.5 py-1 text-xs gap-1.5',
        md: 'min-h-8 px-3 py-1.5 text-xs gap-2',
        lg: 'min-h-9 px-4 py-2 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'compliance',
      size: 'md',
    },
  }
);

const VARIANT_DEFAULTS = {
  red: { icon: Trash2, label: 'Hold to delete', completeLabel: 'Deleted' },
  green: { icon: FileCheck2, label: 'Hold to file', completeLabel: 'Filed' },
  blue: { icon: Send, label: 'Hold to send', completeLabel: 'Sent' },
  compliance: { icon: FileCheck2, label: 'Hold to file to MCA', completeLabel: 'Filing confirmed' },
  neutral: { icon: Archive, label: 'Hold to confirm', completeLabel: 'Confirmed' },
};

const HOLD_KEYS = new Set([' ', 'Enter']);
const LABEL_DELAY_MS = 140;

function DrawnCheck() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-in fade-in zoom-in-75 duration-200"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export const HoldButton = ({
  children,
  holdDuration = 1400,
  holdingLabel = 'Keep holding…',
  completeLabel,
  resetAfter = 2400,
  onHoldComplete,
  variant = 'compliance',
  size = 'md',
  className = '',
  icon: customIcon,
  disabled = false,
  type = 'button',
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}) => {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'holding' | 'complete'
  const [progress, setProgress] = useState(0); // 0 to 1
  const [showHoldingLabel, setShowHoldingLabel] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const phaseRef = useRef('idle');
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const startProgressRef = useRef(0);
  const resetTimerRef = useRef(null);
  const labelTimerRef = useRef(null);
  const onHoldCompleteRef = useRef(onHoldComplete);
  onHoldCompleteRef.current = onHoldComplete;

  const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.compliance;
  const Icon = customIcon || defaults.icon;

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    };
  }, []);

  const updatePhase = (next) => {
    phaseRef.current = next;
    setPhase(next);
    if (labelTimerRef.current) {
      clearTimeout(labelTimerRef.current);
      labelTimerRef.current = null;
    }
    if (next === 'holding') {
      labelTimerRef.current = setTimeout(
        () => setShowHoldingLabel(true),
        LABEL_DELAY_MS
      );
    } else {
      setShowHoldingLabel(false);
    }
  };

  const complete = () => {
    updatePhase('complete');
    setProgress(1);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onHoldCompleteRef.current?.();

    if (resetAfter > 0) {
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null;
        setProgress(0);
        updatePhase('idle');
      }, resetAfter);
    }
  };

  const startHold = () => {
    if (phaseRef.current !== 'idle' || disabled) return;
    updatePhase('holding');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (shouldReduceMotion) {
      complete();
      return;
    }

    startTimeRef.current = performance.now();
    startProgressRef.current = progress;

    const tick = (now) => {
      const elapsed = now - startTimeRef.current;
      const current = Math.min(1, startProgressRef.current + elapsed / holdDuration);
      setProgress(current);

      if (current >= 1) {
        complete();
      } else if (phaseRef.current === 'holding') {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const endHold = () => {
    if (phaseRef.current !== 'holding') return;
    updatePhase('idle');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (shouldReduceMotion) {
      setProgress(0);
      return;
    }

    const drainStart = performance.now();
    const currentProgress = progress;
    const DRAIN_MS = 250;

    const drainTick = (now) => {
      const elapsed = now - drainStart;
      const factor = Math.min(1, elapsed / DRAIN_MS);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - factor, 3);
      const remaining = Math.max(0, currentProgress * (1 - eased));
      setProgress(remaining);

      if (remaining > 0 && phaseRef.current === 'idle') {
        rafRef.current = requestAnimationFrame(drainTick);
      } else {
        setProgress(0);
      }
    };

    rafRef.current = requestAnimationFrame(drainTick);
  };

  const handlePointerDown = (e) => {
    onPointerDown?.(e);
    if (e.button !== 0) return;
    startHold();
  };

  const handleKeyDown = (e) => {
    onKeyDown?.(e);
    if (HOLD_KEYS.has(e.key)) {
      e.preventDefault();
      if (!e.repeat) startHold();
    }
  };

  const handleKeyUp = (e) => {
    onKeyUp?.(e);
    if (HOLD_KEYS.has(e.key)) endHold();
  };

  let label = children ?? defaults.label;
  if (phase === 'holding' && showHoldingLabel) {
    label = holdingLabel;
  } else if (phase === 'complete') {
    label = completeLabel ?? defaults.completeLabel;
  }

  return (
    <button
      {...props}
      type={type}
      aria-disabled={phase === 'complete' || undefined}
      className={cn(holdButtonVariants({ variant, size }), className)}
      data-complete={phase === 'complete' || undefined}
      data-holding={phase === 'holding' || undefined}
      disabled={disabled}
      onBlur={(e) => {
        onBlur?.(e);
        endHold();
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerCancel={(e) => {
        onPointerCancel?.(e);
        endHold();
      }}
      onPointerDown={handlePointerDown}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        endHold();
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e);
        endHold();
      }}
    >
      {/* Progress fill bar */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 bg-current/20 transition-opacity duration-150 group-data-complete/hold:opacity-0"
        style={{ width: `${progress * 100}%` }}
      />

      <span className="relative flex items-center justify-center overflow-hidden">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap transition-transform duration-150 ease-out">
          {phase === 'complete' ? (
            <DrawnCheck />
          ) : (
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{label}</span>
        </span>
      </span>

      <span aria-live="polite" className="sr-only">
        {phase === 'complete' ? (completeLabel ?? defaults.completeLabel) : ''}
      </span>
    </button>
  );
};
