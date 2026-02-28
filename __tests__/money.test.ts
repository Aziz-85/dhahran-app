/**
 * Money display utility: halalas → SAR string.
 * Ensures no page displays raw halalas as SAR.
 */

import { formatSarFromHalala } from '@/lib/utils/money';

describe('formatSarFromHalala', () => {
  it('converts 191950 halalas to "1,919.50 SAR"', () => {
    expect(formatSarFromHalala(191950)).toBe('1,919.50 SAR');
  });

  it('formats zero as "0.00 SAR"', () => {
    expect(formatSarFromHalala(0)).toBe('0.00 SAR');
  });

  it('formats small halalas with two decimals', () => {
    expect(formatSarFromHalala(50)).toBe('0.50 SAR');
    expect(formatSarFromHalala(1)).toBe('0.01 SAR');
  });

  it('returns "—" for non-finite input', () => {
    expect(formatSarFromHalala(NaN)).toBe('—');
    expect(formatSarFromHalala(Infinity)).toBe('—');
  });
});
