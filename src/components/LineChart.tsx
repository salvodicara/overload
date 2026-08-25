import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type ChartPoint = { date: string; value: number; highlight?: boolean };

type LineChartProps = {
  points: ChartPoint[];
  label: string;
  height?: number;
  formatValue?: (value: number) => string;
};

const PAD = { top: 14, right: 14, bottom: 20, left: 40 };
const TICKS = 4;

/** Nice round step so the ~4 gridlines land on readable kg values. */
function niceStep(span: number): number {
  const raw = span / (TICKS - 1);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (raw <= m * pow) return m * pow;
  }
  return 10 * pow;
}

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** One visual series; the caller supplies the tracking-aware text alternative. */
export function LineChart({ points, label, height = 180, formatValue }: LineChartProps) {
  const { i18n } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const draw = (): void => {
      const width = wrap.clientWidth;
      if (width <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const accent = cssVar(canvas, '--accent', '#c9f73a');
      const muted = cssVar(canvas, '--muted', '#8b939c');
      const line = cssVar(canvas, '--line', '#262b31');
      const good = cssVar(canvas, '--good', '#55d187');
      const ink = cssVar(canvas, '--ink', '#f2f4f0');
      const surface = cssVar(canvas, '--surface', '#14171a');
      const mono = cssVar(canvas, '--font-mono', 'monospace');
      ctx.font = `11px ${mono}`;
      ctx.textBaseline = 'middle';

      const plotW = width - PAD.left - PAD.right;
      const plotH = height - PAD.top - PAD.bottom;
      if (plotW <= 0 || plotH <= 0 || points.length === 0) return;

      const values = points.map((p) => p.value);
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const step = niceStep(Math.max(rawMax - rawMin, 1));
      const min = Math.floor(rawMin / step) * step;
      const max = Math.max(min + step * (TICKS - 1), Math.ceil(rawMax / step) * step);

      const x = (i: number): number =>
        PAD.left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
      const y = (v: number): number => PAD.top + plotH - (plotH * (v - min)) / (max - min);

      // Gridlines and caller-formatted value labels.
      ctx.lineWidth = 1;
      ctx.strokeStyle = line;
      ctx.fillStyle = muted;
      ctx.textAlign = 'right';
      for (let v = min; v <= max + 0.001; v += step) {
        const gy = Math.round(y(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD.left, gy);
        ctx.lineTo(width - PAD.right, gy);
        ctx.stroke();
        ctx.fillText(formatValue ? formatValue(v) : v.toLocaleString(locale), PAD.left - 8, gy);
      }

      // series line
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(x(i), y(p.value)) : ctx.lineTo(x(i), y(p.value)),
      );
      ctx.stroke();

      // PR dots, ringed in the surface color so they stay legible on the line
      const dot = (cx: number, cy: number, r: number, fill: string): void => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = surface;
        ctx.stroke();
      };
      points.forEach((p, i) => {
        if (p.highlight) dot(x(i), y(p.value), 4, good);
      });

      // last point emphasised + its value direct-labelled (text never wears the series color)
      const lastI = points.length - 1;
      const last = points[lastI];
      dot(x(lastI), y(last.value), 4.5, accent);
      ctx.fillStyle = ink;
      ctx.textAlign = 'right';
      const labelY = Math.max(PAD.top - 4, y(last.value) - 12);
      ctx.fillText(
        formatValue ? formatValue(last.value) : last.value.toLocaleString(locale),
        width - PAD.right,
        labelY,
      );

      // first / last date labels only
      const fmt = (iso: string): string =>
        new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      ctx.fillStyle = muted;
      const baseY = height - PAD.bottom / 2;
      ctx.textAlign = 'left';
      ctx.fillText(fmt(points[0].date), PAD.left, baseY);
      if (points.length > 1) {
        ctx.textAlign = 'right';
        ctx.fillText(fmt(last.date), width - PAD.right, baseY);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [points, height, locale, formatValue]);

  return (
    <div ref={wrapRef} className="line-chart" role="img" aria-label={label}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
