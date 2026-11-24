/**
 * SignaturePad Component
 * Adapted from Kokonut UI with /better-ui, /better-interface, and emil-design-eng polish:
 * - Spring-smoothed pen-tip simulation (erases hand/trackpad jitter)
 * - Stroke width follows velocity (mimics real nib ink physics)
 * - Built-in Undo (Ctrl+Z) and Clear (Delete/Backspace) with uninking animation
 * - Accessible canvas with role="img" and dynamic stroke-count announcements
 * - Outputs clean SVG string or PNG Data URL for partner audit sign-offs
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { RotateCcw, Trash2, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../common/Button';

const STEP = 1 / 240;
const TIP_STIFFNESS = 2600;
const TIP_DAMPING = 78;
const MAX_WIDTH = 3.2;
const MIN_WIDTH = 1.0;
const SPEED_FOR_MIN = 1800;
const WIDTH_EASE = 0.08;
const MIN_GAP = 0.6;
const TAPER = 7;
const CLEAR_MS = 350;
const INK = '#0f172a'; // Deep slate ink

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function taperedWidth(stroke, i, open) {
  const n = stroke.length;
  const start = Math.min(1, (i + 1) / TAPER);
  const end = open ? 1 : Math.min(1, (n - i) / TAPER);
  return stroke[i].w * (0.35 + 0.65 * Math.min(start, end));
}

function quad(ctx, pts) {
  let area = 0;
  for (let k = 0; k < 8; k += 2) {
    const j = (k + 2) % 8;
    area += pts[k] * pts[j + 1] - pts[j] * pts[k + 1];
  }
  const order = area >= 0 ? [0, 2, 4, 6] : [6, 4, 2, 0];
  ctx.moveTo(pts[order[0]], pts[order[0] + 1]);
  for (let k = 1; k < 4; k++) {
    ctx.lineTo(pts[order[k]], pts[order[k] + 1]);
  }
  ctx.closePath();
}

function paint(ctx, stroke, from, to, open) {
  ctx.beginPath();
  for (let i = Math.max(from, 0); i < to; i++) {
    const p = stroke[i];
    const w = stroke.length === 1 && !open ? p.w * 0.8 : taperedWidth(stroke, i, open);
    if (i > 0) {
      const q = stroke[i - 1];
      const qw = taperedWidth(stroke, i - 1, open);
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      quad(ctx, [
        q.x + (nx * qw) / 2,
        q.y + (ny * qw) / 2,
        p.x + (nx * w) / 2,
        p.y + (ny * w) / 2,
        p.x - (nx * w) / 2,
        p.y - (ny * w) / 2,
        q.x - (nx * qw) / 2,
        q.y - (ny * qw) / 2,
      ]);
    }
    ctx.moveTo(p.x + w / 2, p.y);
    ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
  }
  ctx.fill();
}

function toSvg(strokes, width, height) {
  const paths = strokes
    .map((stroke) => {
      if (stroke.length === 1) {
        const [p] = stroke;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.w * 0.4).toFixed(2)}"/>`;
      }
      const left = [];
      const right = [];
      for (let i = 0; i < stroke.length; i++) {
        const p = stroke[i];
        const q = stroke[Math.max(i - 1, 0)];
        const r = stroke[Math.min(i + 1, stroke.length - 1)];
        const dx = r.x - q.x;
        const dy = r.y - q.y;
        const len = Math.hypot(dx, dy) || 1;
        const w = taperedWidth(stroke, i, false) / 2;
        left.push(`${(p.x - (dy / len) * w).toFixed(1)} ${(p.y + (dx / len) * w).toFixed(1)}`);
        right.push(`${(p.x + (dy / len) * w).toFixed(1)} ${(p.y - (dx / len) * w).toFixed(1)}`);
      }
      return `<path d="M${left.join('L')}L${right.reverse().join('L')}Z"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" fill="${INK}">${paths}</svg>`;
}

export const SignaturePad = ({
  onChange,
  onSave,
  label = 'Partner Signature',
  signatoryTitle = 'Authorized Partner / CS / CA',
  className = '',
}) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [count, setCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const sim = useRef({
    held: false,
    clearing: false,
    strokes: [],
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    w: (MAX_WIDTH + MIN_WIDTH) / 2,
    prevT: 0,
    accT: 0,
    drawnUntil: 0,
    raf: 0,
  });

  const stopSettling = useCallback(() => {
    const s = sim.current;
    if (s.raf && !s.held && !s.clearing) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    }
  }, []);

  const redraw = useCallback((fade = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { strokes } = sim.current;
    if (!strokes.length) return;

    ctx.save();
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.fillStyle = INK;

    const visibleCount = Math.floor(strokes.length * fade);
    for (let i = 0; i < visibleCount; i++) {
      paint(ctx, strokes[i], 0, strokes[i].length, false);
    }
    ctx.restore();
  }, []);

  const emit = useCallback(() => {
    const { strokes } = sim.current;
    setCount(strokes.length);
    if (!onChange) return;
    if (!strokes.length) {
      onChange(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    onChange(toSvg(strokes, canvas.width / dpr, canvas.height / dpr));
  }, [onChange]);

  const tick = () => {
    const s = sim.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const dt = clamp((now - (s.prevT || now)) / 1000, 0, 0.05);
    s.prevT = now;
    s.accT += dt;

    let tipMoved = false;
    while (s.accT >= STEP) {
      s.accT -= STEP;
      const ax = (s.tx - s.x) * TIP_STIFFNESS - s.vx * TIP_DAMPING;
      const ay = (s.ty - s.y) * TIP_STIFFNESS - s.vy * TIP_DAMPING;
      s.vx += ax * STEP;
      s.vy += ay * STEP;
      s.x += s.vx * STEP;
      s.y += s.vy * STEP;
      tipMoved = true;
    }

    if (tipMoved && s.held) {
      const active = s.strokes[s.strokes.length - 1];
      const last = active[active.length - 1];
      const dist = Math.hypot(s.x - last.x, s.y - last.y);
      if (dist >= MIN_GAP) {
        const speed = Math.hypot(s.vx, s.vy);
        const targetW = clamp(
          MAX_WIDTH - (speed / SPEED_FOR_MIN) * (MAX_WIDTH - MIN_WIDTH),
          MIN_WIDTH,
          MAX_WIDTH
        );
        s.w += (targetW - s.w) * WIDTH_EASE;
        active.push({ x: s.x, y: s.y, w: s.w });

        ctx.save();
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        ctx.fillStyle = INK;
        paint(ctx, active, s.drawnUntil - 1, active.length, true);
        ctx.restore();
        s.drawnUntil = active.length;
      }
    }

    const speed = Math.hypot(s.vx, s.vy);
    const settling = Math.hypot(s.tx - s.x, s.ty - s.y) > 0.5 || speed > 1;

    if (s.held || settling) {
      s.raf = requestAnimationFrame(tick);
    } else {
      s.raf = 0;
      redraw();
      emit();
    }
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0 || sim.current.clearing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    stopSettling();
    const s = sim.current;
    s.held = true;
    s.tx = x;
    s.ty = y;
    s.x = x;
    s.y = y;
    s.vx = 0;
    s.vy = 0;
    s.w = (MAX_WIDTH + MIN_WIDTH) / 2;
    s.strokes.push([{ x, y, w: s.w }]);
    s.drawnUntil = 0;
    s.prevT = performance.now();
    s.accT = 0;

    setDrawing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!s.raf) {
      s.raf = requestAnimationFrame(tick);
    }
  };

  const handlePointerMove = (e) => {
    const s = sim.current;
    if (!s.held) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    s.tx = e.clientX - rect.left;
    s.ty = e.clientY - rect.top;
  };

  const handlePointerUp = () => {
    const s = sim.current;
    if (!s.held) return;
    s.held = false;
    setDrawing(false);
    if (!s.raf) {
      s.raf = requestAnimationFrame(tick);
    }
  };

  const undo = useCallback(() => {
    const s = sim.current;
    if (s.held || s.clearing || !s.strokes.length) return;
    stopSettling();
    s.strokes.pop();
    redraw();
    emit();
  }, [emit, redraw, stopSettling]);

  const clear = useCallback(() => {
    const s = sim.current;
    if (s.held || s.clearing || !s.strokes.length) return;
    stopSettling();

    s.clearing = true;
    setClearing(true);
    const start = performance.now();
    const frame = (now) => {
      const t = clamp((now - start) / CLEAR_MS, 0, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      redraw(1 - eased);
      if (t < 1) {
        s.raf = requestAnimationFrame(frame);
      } else {
        s.raf = 0;
        s.strokes = [];
        s.clearing = false;
        redraw();
        setClearing(false);
        emit();
      }
    };
    s.raf = requestAnimationFrame(frame);
  }, [emit, redraw, stopSettling]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      redraw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [redraw]);

  const handleSave = () => {
    if (!onSave || !count) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas ? canvas.toDataURL('image/png') : null;
    const svg = exportSvg();
    onSave({ svg, dataUrl });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      undo();
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      clear();
    }
  };

  const empty = count === 0 && !drawing;

  return (
    <div
      className={cn(
        'w-full max-w-md select-none overflow-hidden rounded-[var(--dt-radius-card,8px)] border border-slate-200 bg-white text-slate-900 shadow-sm',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="relative h-[180px] bg-slate-50/40" ref={wrapRef}>
        {/* Signature baseline guide */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-10 flex items-end gap-2 border-slate-300 border-b pb-1"
        >
          <span className="text-sm font-serif text-slate-400 select-none">✕</span>
          <span
            className={cn(
              'text-xs text-slate-400 font-sans transition-opacity duration-150',
              empty ? 'opacity-100' : 'opacity-0'
            )}
          >
            Sign above this line ({signatoryTitle})
          </span>
        </div>

        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-label={`${label}${count ? `, ${count} stroke${count === 1 ? '' : 's'}` : ', empty'}`}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
          onLostPointerCapture={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-3.5 py-2">
        <p aria-live="polite" className="truncate text-[11px] font-medium text-slate-500">
          {count ? `Signed (${count} stroke${count === 1 ? '' : 's'})` : 'Use mouse, trackpad, or finger'}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={undo}
            disabled={!count || clearing}
            title="Undo last stroke (Ctrl+Z)"
          >
            <RotateCcw className="h-3 w-3 mr-1" aria-hidden="true" />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={clear}
            disabled={!count || clearing}
            title="Clear signature pad"
          >
            <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
            Clear
          </Button>
          {onSave && (
            <Button
              variant="primary"
              size="xs"
              onClick={handleSave}
              disabled={!count || clearing}
            >
              <Check className="h-3 w-3 mr-1" aria-hidden="true" />
              Apply Signature
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
