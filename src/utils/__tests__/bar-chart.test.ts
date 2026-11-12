import {
  axisLabelIndices,
  barIndexAt,
  barPath,
  growBar,
  layoutBars,
  niceScale,
} from '../bar-chart';

describe('niceScale', () => {
  it('ends on a round number at or above the maximum', () => {
    expect(niceScale(45_000)).toEqual({ max: 60_000, ticks: [0, 20_000, 40_000, 60_000] });
    expect(niceScale(100)).toEqual({ max: 100, ticks: [0, 50, 100] });
    expect(niceScale(7)).toEqual({ max: 10, ticks: [0, 5, 10] });
    expect(niceScale(12)).toEqual({ max: 15, ticks: [0, 5, 10, 15] });
  });

  it('never uses fractional steps for small counts', () => {
    expect(niceScale(1)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(2)).toEqual({ max: 2, ticks: [0, 1, 2] });
  });

  it('has a usable axis when there is no data', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(Number.NaN)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(-3)).toEqual({ max: 1, ticks: [0, 1] });
  });

  it('always covers the maximum', () => {
    for (const value of [3, 11, 99, 101, 2_788_473, 123_456_789]) {
      const scale = niceScale(value);
      expect(scale.max).toBeGreaterThanOrEqual(value);
      expect(scale.ticks.at(-1)).toBe(scale.max);
      expect(scale.ticks.length).toBeLessThanOrEqual(6);
    }
  });
});

describe('layoutBars', () => {
  it('spreads bars across the width and scales them to the axis', () => {
    const layout = layoutBars({ values: [50, 100], width: 200, height: 100 });
    expect(layout.step).toBe(100);
    expect(layout.baseline).toBe(100);
    expect(layout.bars.map(b => b.center)).toEqual([50, 150]);
    // Axis max is 100, so the second bar fills the height and the first half.
    expect(layout.bars[1]).toMatchObject({ y: 0, height: 100 });
    expect(layout.bars[0]).toMatchObject({ y: 50, height: 50 });
  });

  it('caps the bar width and keeps bars centered in their slot', () => {
    const [bar] = layoutBars({ values: [10], width: 300, height: 100, maxBarWidth: 28 }).bars;
    expect(bar.width).toBe(28);
    expect(bar.x).toBe(150 - 14);
  });

  it('keeps room above the top tick', () => {
    const layout = layoutBars({ values: [100], width: 100, height: 108, topInset: 8 });
    expect(layout.ticks.at(-1)).toEqual({ value: 100, y: 8 });
    expect(layout.ticks[0]).toEqual({ value: 0, y: 108 });
    expect(layout.bars[0]).toMatchObject({ y: 8, height: 100 });
  });

  it('draws tiny values at a visible minimum and zeros not at all', () => {
    const layout = layoutBars({ values: [1, 0, 100_000], width: 300, height: 100 });
    expect(layout.bars[0].height).toBe(2);
    expect(layout.bars[1].height).toBe(0);
  });

  it('treats negatives and non-numbers as zero', () => {
    const layout = layoutBars({ values: [-5, Number.NaN, 10], width: 300, height: 100 });
    expect(layout.bars[0].height).toBe(0);
    expect(layout.bars[1].height).toBe(0);
    // The axis is scaled by the one valid value (10), which fills it.
    expect(layout.bars[2].height).toBe(100);
  });

  it('returns no bars before it has data or a width', () => {
    expect(layoutBars({ values: [], width: 300, height: 100 }).bars).toEqual([]);
    expect(layoutBars({ values: [1, 2], width: 0, height: 100 }).bars).toEqual([]);
  });
});

describe('barIndexAt', () => {
  it('maps an x position to its slot', () => {
    expect(barIndexAt(0, 300, 30)).toBe(0);
    expect(barIndexAt(15, 300, 30)).toBe(1);
    expect(barIndexAt(299, 300, 30)).toBe(29);
  });

  it('clamps positions outside the plot', () => {
    expect(barIndexAt(-40, 300, 30)).toBe(0);
    expect(barIndexAt(900, 300, 30)).toBe(29);
  });

  it('is -1 when there is nothing to hit', () => {
    expect(barIndexAt(10, 300, 0)).toBe(-1);
    expect(barIndexAt(10, 0, 5)).toBe(-1);
  });
});

describe('growBar', () => {
  const full = { x: 10, y: 20, width: 8, height: 40, center: 14 };

  it('keeps the baseline and scales height with progress', () => {
    expect(growBar(full, 0)).toEqual({ ...full, y: 60, height: 0 });
    expect(growBar(full, 0.5)).toEqual({ ...full, y: 40, height: 20 });
    expect(growBar(full, 1)).toEqual(full);
  });

  it('clamps progress outside 0–1', () => {
    expect(growBar(full, -1).height).toBe(0);
    expect(growBar(full, 2)).toEqual(full);
  });
});

describe('barPath', () => {
  it('rounds only the top corners', () => {
    expect(barPath({ x: 10, y: 20, width: 8, height: 30, center: 14 }, 3)).toBe(
      'M10,50 V23 Q10,20 13,20 H15 Q18,20 18,23 V50 Z',
    );
  });

  it('shrinks the radius to fit a short or narrow bar', () => {
    expect(barPath({ x: 0, y: 8, width: 8, height: 2, center: 4 }, 3)).toBe(
      'M0,10 V10 Q0,8 2,8 H6 Q8,8 8,10 V10 Z',
    );
  });

  it('is empty for a bar with no height', () => {
    expect(barPath({ x: 0, y: 10, width: 8, height: 0, center: 4 }, 3)).toBe('');
  });
});

describe('axisLabelIndices', () => {
  it('labels every bar when they all fit', () => {
    expect(axisLabelIndices(7, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps first and last and spreads the rest', () => {
    expect(axisLabelIndices(30, 5)).toEqual([0, 7, 15, 22, 29]);
    expect(axisLabelIndices(8, 4)).toEqual([0, 2, 5, 7]);
  });

  it('handles degenerate inputs', () => {
    expect(axisLabelIndices(0, 5)).toEqual([]);
    expect(axisLabelIndices(5, 0)).toEqual([]);
    expect(axisLabelIndices(10, 1)).toEqual([9]);
  });
});
