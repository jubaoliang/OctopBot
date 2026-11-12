/**
 * Bar chart geometry — pure maths, no rendering. The SVG component draws
 * what this returns; any other surface (a canvas, a mini program) can draw
 * the same numbers.
 */

export interface AxisScale {
  /** Top of the value axis, a "nice" number at or above the data maximum. */
  max: number;
  /** Tick values from 0 to `max`, ascending. */
  ticks: number[];
}

/**
 * A value axis that ends on a round number (1, 2 or 5 × a power of ten per
 * step) with about `targetSteps` steps. Token counts are whole numbers, so
 * steps never go below 1.
 */
export function niceScale(maxValue: number, targetSteps = 3): AxisScale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { max: 1, ticks: [0, 1] };
  }
  const rough = maxValue / Math.max(1, targetSteps);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, factor * magnitude);
  const stepCount = Math.max(1, Math.ceil(maxValue / step - 1e-9));
  const ticks = Array.from({ length: stepCount + 1 }, (_, index) => index * step);
  return { max: stepCount * step, ticks };
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Horizontal center, for labels. */
  center: number;
}

export interface BarLayout {
  bars: BarRect[];
  /** Width of one slot (bar plus gap). */
  step: number;
  /** Y of the zero line. */
  baseline: number;
  ticks: { value: number; y: number }[];
}

export interface BarLayoutInput {
  values: readonly number[];
  width: number;
  height: number;
  /** Space kept above the tallest tick so its label is not clipped. */
  topInset?: number;
  /** Bars never grow wider than this, however few there are. */
  maxBarWidth?: number;
  /** Portion of each slot taken by the bar (0–1). */
  fill?: number;
  /** A non-zero value is drawn at least this tall, so it stays visible. */
  minBarHeight?: number;
}

export function layoutBars({
  values,
  width,
  height,
  topInset = 0,
  maxBarWidth = 28,
  fill = 0.64,
  minBarHeight = 2,
}: BarLayoutInput): BarLayout {
  // Negatives and non-numbers count as zero, so one bad value can neither
  // draw below the baseline nor poison the scale for the rest.
  const safeValues = values.map(value => (Number.isFinite(value) && value > 0 ? value : 0));
  const count = safeValues.length;
  const plotHeight = Math.max(0, height - topInset);
  const baseline = height;
  const scale = niceScale(Math.max(0, ...safeValues));
  const ticks = scale.ticks.map(value => ({
    value,
    y: baseline - (value / scale.max) * plotHeight,
  }));
  if (count === 0 || width <= 0) {
    return { bars: [], step: 0, baseline, ticks };
  }

  const step = width / count;
  const barWidth = Math.max(1, Math.min(maxBarWidth, step * fill));
  const bars = safeValues.map((value, index) => {
    const scaled = (value / scale.max) * plotHeight;
    const barHeight = value > 0 ? Math.max(minBarHeight, scaled) : 0;
    const center = step * index + step / 2;
    return {
      x: center - barWidth / 2,
      y: baseline - barHeight,
      width: barWidth,
      height: barHeight,
      center,
    };
  });
  return { bars, step, baseline, ticks };
}

/** Which bar slot an x coordinate falls in, clamped to the valid range. */
export function barIndexAt(x: number, width: number, count: number): number {
  'worklet';
  if (count <= 0 || width <= 0) {
    return -1;
  }
  const index = Math.floor((x / width) * count);
  return Math.min(count - 1, Math.max(0, index));
}

/**
 * Scale a laid-out bar toward its final height from the baseline — used
 * when the chart plays its entrance / data-change grow (HIG Charts).
 */
export function growBar(rect: BarRect, progress: number): BarRect {
  'worklet';
  const p = Math.max(0, Math.min(1, progress));
  const height = rect.height * p;
  return {
    x: rect.x,
    width: rect.width,
    center: rect.center,
    height,
    y: rect.y + rect.height - height,
  };
}

/** SVG path for a bar with only its top corners rounded. */
export function barPath(rect: BarRect, radius: number): string {
  'worklet';
  if (rect.height <= 0 || rect.width <= 0) {
    return '';
  }
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height));
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  return [
    `M${left},${bottom}`,
    `V${top + r}`,
    `Q${left},${top} ${left + r},${top}`,
    `H${right - r}`,
    `Q${right},${top} ${right},${top + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

/**
 * Indices of the bars that get an axis label: always the first and last,
 * with the rest spread evenly, never more than `maxLabels`.
 */
export function axisLabelIndices(count: number, maxLabels: number): number[] {
  if (count <= 0 || maxLabels <= 0) {
    return [];
  }
  if (count <= maxLabels) {
    return Array.from({ length: count }, (_, index) => index);
  }
  if (maxLabels === 1) {
    return [count - 1];
  }
  const indices = new Set<number>();
  for (let i = 0; i < maxLabels; i += 1) {
    indices.add(Math.round((i * (count - 1)) / (maxLabels - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}
