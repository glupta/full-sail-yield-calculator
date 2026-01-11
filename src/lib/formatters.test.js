/**
 * Tests for formatters.js
 * Full coverage for formatting utilities
 */

import { describe, it, expect } from 'vitest';
import { roundToSigFigs, formatUsd, formatPrice } from './formatters';

describe('roundToSigFigs', () => {
    it('should return 0 for 0', () => {
        expect(roundToSigFigs(0)).toBe(0);
    });

    it('should return 0 for non-finite numbers', () => {
        expect(roundToSigFigs(Infinity)).toBe(0);
        expect(roundToSigFigs(-Infinity)).toBe(0);
        expect(roundToSigFigs(NaN)).toBe(0);
    });

    it('should round to 4 sig figs by default', () => {
        expect(roundToSigFigs(12345)).toBe(12350);
        expect(roundToSigFigs(1.2345)).toBe(1.235);
        expect(roundToSigFigs(0.0012345)).toBe(0.001235);
    });

    it('should handle custom sig figs', () => {
        expect(roundToSigFigs(12345, 2)).toBe(12000);
        expect(roundToSigFigs(12345, 3)).toBe(12300);
        expect(roundToSigFigs(12345, 6)).toBe(12345);
    });

    it('should handle negative numbers', () => {
        // Function rounds -12345 to 4 sig figs = -12340
        expect(roundToSigFigs(-12345)).toBeCloseTo(-12340, 0);
        expect(roundToSigFigs(-0.0012345)).toBeCloseTo(-0.001234, 6);
    });

    it('should handle very small numbers', () => {
        expect(roundToSigFigs(0.000001234)).toBe(0.000001234);
    });

    it('should handle very large numbers', () => {
        expect(roundToSigFigs(123456789)).toBeCloseTo(123500000, -3);
    });
});

describe('formatUsd', () => {
    it('should format positive values with $ prefix and commas', () => {
        expect(formatUsd(100)).toBe('$100.00');
        expect(formatUsd(1234.56)).toBe('$1,234.56');
        expect(formatUsd(1000000)).toBe('$1,000,000.00');
    });

    it('should format zero as $0.00', () => {
        expect(formatUsd(0)).toBe('$0.00');
    });

    it('should format negative values with commas', () => {
        expect(formatUsd(-50)).toBe('$-50.00');
        expect(formatUsd(-1234.56)).toBe('$-1,234.56');
    });

    it('should handle decimal values', () => {
        expect(formatUsd(99.999)).toBe('$100.00');
        expect(formatUsd(99.994)).toBe('$99.99');
    });

    it('should return $0.00 for non-finite values', () => {
        expect(formatUsd(Infinity)).toBe('$0.00');
        expect(formatUsd(-Infinity)).toBe('$0.00');
        expect(formatUsd(NaN)).toBe('$0.00');
    });
});

describe('formatPrice', () => {
    it('should return "0" for 0', () => {
        expect(formatPrice(0)).toBe('0');
    });

    it('should return "0" for non-finite values', () => {
        expect(formatPrice(Infinity)).toBe('0');
        expect(formatPrice(-Infinity)).toBe('0');
        expect(formatPrice(NaN)).toBe('0');
    });

    it('should use sig figs for very small prices (<0.01)', () => {
        expect(formatPrice(0.00256)).toBe('0.00256');
        expect(formatPrice(0.001234)).toBe('0.001234');
    });

    it('should use 4 decimals for small prices (0.01 - 1)', () => {
        expect(formatPrice(0.5)).toBe('0.5000');
        expect(formatPrice(0.12345)).toBe('0.1235');
    });

    it('should use 2 decimals for medium prices (1 - 100)', () => {
        expect(formatPrice(50)).toBe('50.00');
        expect(formatPrice(3.789)).toBe('3.79');
    });

    it('should use 0 decimals for large prices (>=100)', () => {
        expect(formatPrice(100)).toBe('100');
        expect(formatPrice(1234.56)).toBe('1235');
    });
});
