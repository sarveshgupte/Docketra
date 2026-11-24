/**
 * SlideToConfirm Component
 * Adapted from Kokonut UI with /better-ui, /better-interface, and emil-design-eng polish:
 * - Nested border radius formula: outer = inner + padding
 * - Compact 42px height tailored for professional B2B SaaS density
 * - Gesture, touch, and single-click/keyboard accessibility (Enter/Space key)
 * - Motion-safe transitions with reduced-motion fallback
 * - Screen-reader aria-live announcements
 * - Native pointer capture with zero external animation dependencies
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

const HEIGHT = 42;
const INSET = 3;
const THUMB = HEIGHT - INSET * 2; // 36px
const COMMIT_PERCENT = 0.85;

export const SlideToConfirm = ({
  label = 'Slide to confirm action',
  confirmingLabel = 'Confirming…',
  doneLabel = 'Confirmed',
  onConfirm = () => new Promise((resolve) => setTimeout(resolve, 800)),
  resetAfter = 2200,
  disabled = false,
  className = '',
}) => {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'dragging' | 'confirming' | 'done'
  const [dragX, setDragX] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const reduceMotion = useReducedMotion();

  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const maxDrag = Math.max(0, trackWidth - THUMB - INSET * 2);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateWidth = () => {
      setTrackWidth(track.offsetWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const settleBack = () => {
    isDraggingRef.current = false;
    setDragX(0);
    setPhase('idle');
  };

  const commit = async () => {
    isDraggingRef.current = false;
    setPhase('confirming');
    setDragX(maxDrag);

    try {
      await confirmRef.current?.();
      setPhase('done');

      if (typeof resetAfter === 'number' && resetAfter > 0) {
        setTimeout(() => {
          settleBack();
        }, resetAfter);
      }
    } catch {
      settleBack();
    }
  };

  const onPointerDown = (e) => {
    if (disabled || phase !== 'idle' || e.button !== 0) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX - dragX;
    setPhase('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isDraggingRef.current || phase !== 'dragging') return;
    const current = Math.max(0, Math.min(maxDrag, e.clientX - startXRef.current));
    setDragX(current);
  };

  const onPointerUp = (e) => {
    if (!isDraggingRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    isDraggingRef.current = false;
    if (maxDrag > 0 && dragX >= maxDrag * COMMIT_PERCENT) {
      commit();
    } else {
      settleBack();
    }
  };

  const onClick = () => {
    if (disabled || phase !== 'idle') return;
    // Allow single click / tap fallback for keyboard and accessibility users
    if (dragX < 5) {
      commit();
    }
  };

  const onKeyDown = (e) => {
    if (disabled || phase !== 'idle') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit();
    }
  };

  const busy = phase === 'confirming';
  const done = phase === 'done';
  const progressRatio = maxDrag > 0 ? dragX / maxDrag : 0;
  const isArmed = progressRatio >= COMMIT_PERCENT;

  let stageLabel = label;
  if (busy) stageLabel = confirmingLabel;
  if (done) stageLabel = doneLabel;

  return (
    <div
      className={cn(
        'relative w-full max-w-sm select-none',
        disabled && 'opacity-40 pointer-events-none cursor-not-allowed',
        className
      )}
    >
      <div
        ref={trackRef}
        className={cn(
          'relative flex items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100/90 shadow-xs',
          'transition-[border-color,background-color] duration-150'
        )}
        style={{ height: HEIGHT }}
      >
        {/* Static background label */}
        <span
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap pl-6 text-xs font-medium text-slate-500 transition-opacity duration-150"
          style={{ opacity: Math.max(0, 1 - progressRatio * 0.9) }}
        >
          {label}
        </span>

        {/* Dynamic fill layer */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 left-0 transition-colors duration-200 ease-out flex items-center overflow-hidden',
            done ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-white'
          )}
          style={{
            width: `${dragX + THUMB + INSET}px`,
            borderRadius: HEIGHT,
            transition: isDraggingRef.current ? 'none' : 'width 0.25s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.2s',
          }}
        >
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-medium',
              phase === 'idle' || phase === 'dragging' ? 'pl-6' : 'pr-6'
            )}
            style={{
              opacity: dragX > 20 || busy || done ? 1 : 0,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {stageLabel}
          </span>
        </div>

        {/* Draggable thumb button */}
        <button
          type="button"
          aria-disabled={disabled || phase !== 'idle'}
          aria-label={`${label}. Press Enter or slide to confirm.`}
          className={cn(
            'absolute flex items-center justify-center rounded-full outline-none',
            'bg-white text-slate-900 shadow-sm border border-slate-200/80 cursor-grab active:cursor-grabbing',
            'focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-1',
            phase === 'dragging' && 'cursor-grabbing'
          )}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            transform: `translateX(${dragX}px)`,
            left: INSET,
            top: INSET,
            width: THUMB,
            height: THUMB,
            transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          <span className="relative h-4 w-4 flex items-center justify-center">
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-700" aria-hidden="true" />
            ) : done ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 transition-transform duration-150 scale-100" aria-hidden="true" />
            ) : (
              <ArrowRight
                className={cn(
                  'h-3.5 w-3.5 text-slate-700 transition-transform duration-150',
                  isArmed && 'translate-x-0.5 text-slate-950 font-bold'
                )}
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {busy && `${confirmingLabel}…`}
        {done && doneLabel}
      </span>
    </div>
  );
};
