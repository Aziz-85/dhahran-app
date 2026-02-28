/**
 * Canonical money display: database stores amounts in HALALAS (int).
 * All UI must use this utility — never display halalas directly.
 */

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/**
 * Format halala integer as SAR string for display (e.g. 191950 → "1,919.50 SAR").
 * In dev, logs a warning if a large value is passed that looks like halalas not converted.
 */
export function formatSarFromHalala(halala: number): string {
  const n = Number(halala);
  if (!Number.isFinite(n)) return '—';
  if (DEV && n > 10_000_000 && n === Math.floor(n)) {
    // Value looks like raw halalas passed as SAR (would show 100× too big)
    console.warn(
      '[formatSarFromHalala] Very large integer (possible raw halalas):',
      n,
      '→ displaying as',
      (n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'SAR'
    );
  }
  const sar = n / 100;
  return `${sar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}
