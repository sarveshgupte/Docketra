/**
 * TimedUndoToast Component
 * Adapted from Kokonut UI undo feedback components with /better-interface polish:
 * - High-speed power-user action reversal (Linear/Gmail pattern)
 * - WCAG 2.2.1 Timing Adjustable: pauses countdown on hover or keyboard focus
 * - Circular SVG progress indicator tracking remaining window
 * - Accessible live region (role="status", aria-live="polite")
 * - Native requestAnimationFrame loop with zero external animation dependencies
 */

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, CheckCircle2 } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

export const TimedUndoToast = ({
  message = 'Action completed successfully',
  undoLabel = 'Undo',
  duration = 6000, // 6 seconds default
  onUndo,
  onCommit,
  onClose,
  className = '',
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const remainingAtPauseRef = useRef(duration);
  const isPausedRef = useRef(false);
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    startTimeRef.current = performance.now();

    const tick = (now) => {
      if (!isPausedRef.current) {
        const elapsed = now - startTimeRef.current;
        const remaining = Math.max(0, remainingAtPauseRef.current - elapsed);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          onCommitRef.current?.();
          onCloseRef.current?.();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pause = () => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
    remainingAtPauseRef.current = timeLeft;
  };

  const resume = () => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);
    startTimeRef.current = performance.now();
  };

  const handleUndo = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onUndoRef.current?.();
    onCloseRef.current?.();
  };

  const handleDismiss = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onCommitRef.current?.();
    onCloseRef.current?.();
  };

  const progress = duration > 0 ? timeLeft / duration : 0;
  const secondsLeft = Math.ceil(timeLeft / 1000);

  // SVG circle metric
  const size = 18;
  const strokeWidth = 2.2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={cn(
        'inline-flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--dt-radius-card,8px)]',
        'bg-slate-900 text-white shadow-xl border border-slate-800 text-xs font-medium select-none',
        'transition-[transform,opacity] duration-150 animate-in fade-in slide-in-from-bottom-2',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
        <span className="truncate text-slate-100">{message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0 border-l border-slate-700 pl-3">
        {/* Undo button with countdown circle */}
        <button
          type="button"
          onClick={handleUndo}
          aria-label={`${undoLabel}. ${secondsLeft} seconds remaining to cancel.`}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white active:scale-95'
          )}
        >
          {/* Circular Countdown Gauge */}
          {!shouldReduceMotion && (
            <svg
              className="h-4 w-4 -rotate-90 text-slate-600"
              viewBox={`0 0 ${size} ${size}`}
              aria-hidden="true"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="stroke-current opacity-30"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="stroke-emerald-400 transition-[stroke-dashoffset] duration-75"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          )}

          <RotateCcw className="h-3 w-3 text-slate-300" aria-hidden="true" />
          <span className="font-semibold text-[11px] text-white">
            {undoLabel} ({secondsLeft}s)
          </span>
        </button>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss undo notification"
          className="text-slate-400 hover:text-white p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
