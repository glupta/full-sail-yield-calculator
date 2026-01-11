/**
 * Tests for il-calculator.js
 * Full coverage for IL calculations
 */

import { describe, it, expect } from 'vitest';
import {
    calculateIL,
    estimateILFromVolatility,
    calculateILDollarValue
} from './il-calculator';

describe('calculateIL', () => {
    describe('edge cases', () => {
        it('should return 0 when P0 is 0', () => {
            expect(calculateIL(0, 100)).toBe(0);
        });

        it('should return 0 when P1 is 0', () => {
            expect(calculateIL(100, 0)).toBe(0);
        });

        it('should return 0 when P0 is negative', () => {
            expect(calculateIL(-100, 100)).toBe(0);
        });

        it('should return 0 when P1 is negative', () => {
            expect(calculateIL(100, -100)).toBe(0);
        });
    });

    describe('IL calculation accuracy', () => {
        it('should return 0 when prices are equal', () => {
            expect(calculateIL(100, 100)).toBe(0);
            expect(calculateIL(1, 1)).toBe(0);
        });

        it('should calculate IL for 2x price increase (≈-5.72%)', () => {
            const il = calculateIL(100, 200);
            // IL = 2 * sqrt(2) / (1 + 2) - 1 ≈ -0.0572
            expect(il).toBeCloseTo(-0.0572, 3);
        });

        it('should calculate IL for 0.5x price decrease (≈-5.72%)', () => {
            const il = calculateIL(100, 50);
            // IL = 2 * sqrt(0.5) / (1 + 0.5) - 1 ≈ -0.0572
            expect(il).toBeCloseTo(-0.0572, 3);
        });

        it('should calculate IL for 5x price increase (≈-25%)', () => {
            const il = calculateIL(100, 500);
            // IL = 2 * sqrt(5) / (1 + 5) - 1 ≈ -0.2546
            expect(il).toBeCloseTo(-0.2546, 3);
        });

        it('should calculate IL for 10x price increase (≈-42.5%)', () => {
            const il = calculateIL(100, 1000);
            // IL = 2 * sqrt(10) / (1 + 10) - 1 ≈ -0.425
            expect(il).toBeCloseTo(-0.425, 2);
        });

        it('should handle very small price changes', () => {
            const il = calculateIL(100, 101);
            expect(il).toBeLessThan(0);
            expect(il).toBeGreaterThan(-0.01);
        });

        it('should be symmetric for reciprocal price changes', () => {
            const il2x = calculateIL(100, 200);
            const ilHalf = calculateIL(100, 50);
            expect(il2x).toBeCloseTo(ilHalf, 4);
        });
    });
});

describe('estimateILFromVolatility', () => {
    it('should return scenarios object with all required properties', () => {
        const result = estimateILFromVolatility(0.8, 30);

        expect(result).toHaveProperty('optimistic');
        expect(result).toHaveProperty('expected');
        expect(result).toHaveProperty('pessimistic');
        expect(result).toHaveProperty('priceChanges');
    });

    it('should return negative IL values for all scenarios', () => {
        const result = estimateILFromVolatility(0.8, 30);

        expect(result.optimistic).toBeLessThan(0);
        expect(result.expected).toBeLessThan(0);
        expect(result.pessimistic).toBeLessThan(0);
    });

    it('should return worse IL for pessimistic than optimistic', () => {
        const result = estimateILFromVolatility(0.8, 30);

        expect(Math.abs(result.pessimistic)).toBeGreaterThan(Math.abs(result.optimistic));
        expect(Math.abs(result.pessimistic)).toBeGreaterThan(Math.abs(result.expected));
    });

    it('should scale with volatility', () => {
        const lowVol = estimateILFromVolatility(0.3, 30);
        const highVol = estimateILFromVolatility(0.9, 30);

        expect(Math.abs(highVol.expected)).toBeGreaterThan(Math.abs(lowVol.expected));
    });

    it('should scale with time', () => {
        const shortTime = estimateILFromVolatility(0.5, 7);
        const longTime = estimateILFromVolatility(0.5, 365);

        expect(Math.abs(longTime.expected)).toBeGreaterThan(Math.abs(shortTime.expected));
    });

    it('should include price change scenarios', () => {
        const result = estimateILFromVolatility(0.8, 30);

        expect(result.priceChanges.optimistic).toBeGreaterThan(1);
        expect(result.priceChanges.expected).toBeGreaterThan(1);
        expect(result.priceChanges.pessimistic).toBeGreaterThan(1);
    });
});

describe('calculateILDollarValue', () => {
    it('should convert IL percentage to dollar value', () => {
        const ilDollar = calculateILDollarValue(10000, -0.05);
        expect(ilDollar).toBe(500);
    });

    it('should handle 0% IL', () => {
        const ilDollar = calculateILDollarValue(10000, 0);
        expect(ilDollar).toBe(0);
    });

    it('should return positive value for negative IL percent', () => {
        const ilDollar = calculateILDollarValue(10000, -0.10);
        expect(ilDollar).toBe(1000);
        expect(ilDollar).toBeGreaterThan(0);
    });

    it('should scale with deposit amount', () => {
        const small = calculateILDollarValue(1000, -0.05);
        const large = calculateILDollarValue(10000, -0.05);
        expect(large).toBe(small * 10);
    });
});
