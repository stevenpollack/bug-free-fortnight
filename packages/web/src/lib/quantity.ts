const FRACTIONS: Array<[number, string]> = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

const TOLERANCE = 0.01;

/**
 * Format a quantity number as a human-readable string.
 * Renders common fractions (½, ⅓, ¼, etc.) when within tolerance.
 * Returns "" for null/undefined/non-finite values.
 */
export function formatQuantity(q: number | null | undefined): string {
  if (q == null || !Number.isFinite(q)) return "";

  const whole = Math.floor(q);
  const frac = q - whole;

  for (const [val, sym] of FRACTIONS) {
    if (Math.abs(frac - val) < TOLERANCE) {
      return whole === 0 ? sym : `${whole} ${sym}`;
    }
  }

  // Integer (or very close to it)
  if (Math.abs(frac) < TOLERANCE) {
    return String(whole);
  }

  // Decimal up to 2 places, no trailing zeros
  return Number.parseFloat(q.toFixed(2)).toString();
}

/**
 * Scale a quantity from baseServings to targetServings.
 * Returns null if the quantity is null/undefined.
 * Returns q unchanged if baseServings is 0 to avoid division by zero.
 */
export function scaleQuantity(
  q: number | null | undefined,
  baseServings: number,
  targetServings: number,
): number | null {
  if (q == null) return null;
  if (baseServings === 0) return q;
  return (q * targetServings) / baseServings;
}
