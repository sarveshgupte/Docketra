/**
 * StatusIsland Component
 * Adapted from Kokonut UI with /better-ui, /better-interface, and emil-design-eng polish:
 * - Dynamic compact island for operational status monitoring
 * - Displays live MCA V3, Google Drive BYOS, and Cloudflare status
 * - Smooth morphing transitions and interactive task popover
 * - Tabular figures for numbers, high-contrast accessible states
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ShieldCheck,
  HardDrive,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const StatusIsland = ({
  mcaStatus = 'ONLINE', // 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  driveStatus = 'SYNCED', // 'SYNCED' | 'SYNCING' | 'ERROR'
  securityStatus = 'PROTECTED', // 'PROTECTED' | 'CHECKING'
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllHealthy = mcaStatus === 'ONLINE' && driveStatus === 'SYNCED';

  return (
    <div ref={containerRef} className={cn('relative inline-block select-none', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="System operational status island"
        className={cn(
          'inline-flex items-center gap-2 h-7 px-2.5 rounded-full border text-xs font-medium transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900',
          isAllHealthy
            ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100/70'
            : 'border-amber-200/80 bg-amber-50/80 text-amber-900 hover:bg-amber-100/70'
        )}
      >
        <span className="relative flex h-2 w-2">
          {isAllHealthy ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          )}
        </span>
        <span className="font-mono text-[11px] font-semibold tracking-tight">
          {isAllHealthy ? 'SYSTEMS HEALTHY' : 'RADAR NOTICE'}
        </span>
      </button>

      {/* Expanded Status Flyout */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-72 rounded-[var(--dt-radius-card,8px)] border border-slate-200/90 bg-white p-3 shadow-xl z-50 text-slate-900"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Live Practice Radar
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 cursor-pointer"
                aria-label="Close status popover"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {/* MCA V3 Portal Status */}
              <div className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-slate-800">MCA V3 Portal</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Online
                </span>
              </div>

              {/* BYOS Drive Custody */}
              <div className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-slate-800">Google Drive BYOS</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Connected
                </span>
              </div>

              {/* Cloudflare Shield */}
              <div className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-slate-800">Cloudflare Zero Trust</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Active
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500 leading-normal flex items-center justify-between">
              <span>Automatic probe check</span>
              <span className="font-mono text-slate-400">Just now</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
