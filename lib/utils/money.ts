/**
 * Canonical money display: database stores amounts in HALALAS (int).
 * All UI must use this utility — never display halalas directly.
 * Displays whole SAR only (no halalas/fils).
 */

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/**
 * Format halala integer as SAR string for display — whole SAR only, no decimals.
 * Example: 17023500 → "170,235 SAR", 19000000 → "190,000 SAR"
 */
export function formatSarFromHalala(halala: number): string {
  const n = Number(halala);
  if (!Number.isFinite(n)) return '—';
  if (DEV) {
    if (n > 10_000_000 && n === Math.floor(n)) {
      console.warn(
        '[formatSarFromHalala] Very large integer (possible raw halalas):',
        n,
        '→ displaying as',
        Math.round(n / 100).toLocaleString('en-US'),
        'SAR'
      );
    }
    if (n > 0 && n < 10000 && n !== Math.floor(n)) {
      console.warn(
        '[formatSarFromHalala] Decimal value (possible SAR passed as halalas):',
        n,
        '→ display will be wrong. Expect halalas (int).'
      );
    }
  }
  const sarInt = Math.round(n / 100);
  return `${sarInt.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 })} SAR`;
}
