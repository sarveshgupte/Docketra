import { qrcode } from './qr-lib.js';

/**
 * Generate a clean, responsive, high-contrast SVG string for a UPI Intent URI.
 */
export function generateUpiQrSvg(upiText, size = 260) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(upiText);
    qr.make();
    const count = qr.getModuleCount();
    const cellSize = Math.max(4, Math.floor(size / count));
    const margin = 8;
    const totalDim = count * cellSize + margin * 2;

    let pathData = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          const x = c * cellSize + margin;
          const y = r * cellSize + margin;
          pathData += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="100%" height="100%" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff" rx="12" />
      <path d="${pathData}" fill="#0f172a" />
    </svg>`;
  } catch (err) {
    console.error('[QR_GENERATOR_ERROR]', err);
    return null;
  }
}
