/**
 * Tests for leverage-calculator.js
 * Full coverage for leverage and APR calculations
 */

import { describe, it, expect } from 'vitest';
import {
    calculateLeverage,
    calculateEstimatedAPR,
    deriveBaseAPR,
    calculateRangeAPR,
    getPriceRangeFromPercent,
    RANGE_PRESETS
} from './leverage-calculator';

describe('calculateLeverage', () => {
    describe('edge cases and validation', () => {
        it('should return 1 when currentPrice is 0', () => {
            expect(calculateLeverage(0, 0.9, 1.1)).toBe(1);
        });

        it('should return 1 when currentPrice is negative', () => {
            expect(calculateLeverage(-1, 0.9, 1.1)).toBe(1);
        });

        it('should return 1 when currentPrice is null', () => {
            expect(calculateLeverage(null, 0.9, 1.1)).toBe(1);
        });

        it('should return 1 when currentPrice is undefined', () => {
            expect(calculateLeverage(undefined, 0.9, 1.1)).toBe(1);
        });

        it('should return 1 when priceLow is null', () => {
            expect(calculateLeverage(1, null, 1.1)).toBe(1);
        });

        it('should return 1 when priceHigh is null', () => {
            expect(calculateLeverage(1, 0.9, null)).toBe(1);
        });

        it('should return 1 when priceLow is 0', () => {
            expect(calculateLeverage(1, 0, 1.1)).toBe(1);
        });

        it('should return 1 when priceHigh is 0', () => {
            expect(calculateLeverage(1, 0.9, 0)).toBe(1);
        });

        it('should return 1 when priceLow is negative', () => {
            expect(calculateLeverage(1, -0.5, 1.1)).toBe(1);
        });

        it('should return 1 when priceHigh is negative', () => {
            expect(calculateLeverage(1, 0.9, -0.5)).toBe(1);
        });

        it('should return 1 when priceLow >= priceHigh', () => {
            expect(calculateLeverage(1, 1.1, 0.9)).toBe(1);
        });

        it('should return 1 when priceLow equals priceHigh', () => {
            expect(calculateLeverage(1, 1.0, 1.0)).toBe(1);
        });
    });

    describe('out of range positions', () => {
        it('should return 1 when currentPrice <= priceLow (out of range)', () => {
            const leverage = calculateLeverage(0.5, 0.9, 1.1);
            expect(leverage).toBe(1);
        });

        it('should return 1 when currentPrice >= priceHigh (out of range)', () => {
            const leverage = calculateLeverage(1.5, 0.9, 1.1);
            expect(leverage).toBe(1);
        });
    });

    describe('standard leverage calculation', () => {
        it('should return leverage > 1 for concentrated ranges', () => {
            const leverage = calculateLeverage(1, 0.9, 1.1);
            expect(leverage).toBeGreaterThan(1);
        });

        it('should return higher leverage for narrower ranges', () => {
            const wideLeverage = calculateLeverage(1, 0.5, 1.5);
            const narrowLeverage = calculateLeverage(1, 0.9, 1.1);
            const veryNarrowLeverage = calculateLeverage(1, 0.99, 1.01);

            expect(narrowLeverage).toBeGreaterThan(wideLeverage);
            expect(veryNarrowLeverage).toBeGreaterThan(narrowLeverage);
        });

        it('should calculate ±10% range leverage around 19.5x (Full Sail formula)', () => {
            const leverage = calculateLeverage(1, 0.9, 1.1);
            // ±10% range: L = 1/(1-sqrt(0.9)) ≈ 19.49x
            expect(leverage).toBeCloseTo(19.49, 1);
        });

        it('should calculate ±1% range leverage around 199.5x (Full Sail formula)', () => {
            const leverage = calculateLeverage(1, 0.99, 1.01);
            // ±1% range: L = 1/(1-sqrt(0.99)) ≈ 199.5x
            expect(leverage).toBeCloseTo(199.5, 0);
        });

        it('should return minimum of 1 for very wide ranges', () => {
            const leverage = calculateLeverage(1, 0.01, 100);
            expect(leverage).toBeGreaterThanOrEqual(1);
        });
    });
});

describe('calculateEstimatedAPR', () => {
    it('should return 0 when baseAPR is 0', () => {
        expect(calculateEstimatedAPR(0, 5)).toBe(0);
    });

    it('should return 0 when baseAPR is null', () => {
        expect(calculateEstimatedAPR(null, 5)).toBe(0);
    });

    it('should return 0 when baseAPR is negative', () => {
        expect(calculateEstimatedAPR(-5, 5)).toBe(0);
    });

    it('should return baseAPR when leverage is 0', () => {
        expect(calculateEstimatedAPR(10, 0)).toBe(10);
    });

    it('should return baseAPR when leverage is null', () => {
        expect(calculateEstimatedAPR(10, null)).toBe(10);
    });

    it('should return baseAPR when leverage is negative', () => {
        expect(calculateEstimatedAPR(10, -2)).toBe(10);
    });

    it('should multiply baseAPR by leverage', () => {
        expect(calculateEstimatedAPR(10, 5)).toBe(50);
    });

    it('should handle decimal APR values', () => {
        expect(calculateEstimatedAPR(2.5, 4)).toBe(10);
    });
});

describe('deriveBaseAPR', () => {
    it('should return 0 when poolAPR is 0', () => {
        expect(deriveBaseAPR(0)).toBe(0);
    });

    it('should return 0 when poolAPR is null', () => {
        expect(deriveBaseAPR(null)).toBe(0);
    });

    it('should return 0 when poolAPR is negative', () => {
        expect(deriveBaseAPR(-50)).toBe(0);
    });

    it('should divide poolAPR by baseline leverage (17.5)', () => {
        expect(deriveBaseAPR(100)).toBeCloseTo(5.714, 2); // 100 / 17.5 ≈ 5.714
    });

    it('should handle decimal poolAPR values', () => {
        expect(deriveBaseAPR(50)).toBeCloseTo(2.857, 2); // 50 / 17.5 ≈ 2.857
    });
});

describe('calculateRangeAPR', () => {
    it('should return complete APR breakdown', () => {
        const result = calculateRangeAPR(100, 1, 0.9, 1.1);

        expect(result).toHaveProperty('leverage');
        expect(result).toHaveProperty('estimatedAPR');
        expect(result).toHaveProperty('baseAPR');
        expect(result).toHaveProperty('isConcentrated');
    });

    it('should mark concentrated positions correctly', () => {
        const concentrated = calculateRangeAPR(100, 1, 0.9, 1.1);
        expect(concentrated.isConcentrated).toBe(true);
        expect(concentrated.leverage).toBeGreaterThan(1);
    });

    it('should derive baseAPR from poolAPR', () => {
        const result = calculateRangeAPR(100, 1, 0.9, 1.1);
        expect(result.baseAPR).toBeCloseTo(5.714, 2); // 100 / 17.5 ≈ 5.714
    });

    it('should calculate estimatedAPR as baseAPR * leverage', () => {
        const result = calculateRangeAPR(100, 1, 0.9, 1.1);
        expect(result.estimatedAPR).toBeCloseTo(result.baseAPR * result.leverage, 6);
    });
});

describe('getPriceRangeFromPercent', () => {
    it('should return 0 for both when currentPrice is 0', () => {
        const result = getPriceRangeFromPercent(0, -10, 10);
        expect(result.priceLow).toBe(0);
        expect(result.priceHigh).toBe(0);
    });

    it('should return 0 for both when currentPrice is null', () => {
        const result = getPriceRangeFromPercent(null, -10, 10);
        expect(result.priceLow).toBe(0);
        expect(result.priceHigh).toBe(0);
    });

    it('should return 0 for both when currentPrice is negative', () => {
        const result = getPriceRangeFromPercent(-1, -10, 10);
        expect(result.priceLow).toBe(0);
        expect(result.priceHigh).toBe(0);
    });

    it('should calculate ±10% range correctly', () => {
        const result = getPriceRangeFromPercent(100, -10, 10);
        expect(result.priceLow).toBeCloseTo(90, 6);
        expect(result.priceHigh).toBeCloseTo(110, 6);
    });

    it('should calculate ±1% range correctly', () => {
        const result = getPriceRangeFromPercent(100, -1, 1);
        expect(result.priceLow).toBe(99);
        expect(result.priceHigh).toBe(101);
    });

    it('should handle asymmetric ranges', () => {
        const result = getPriceRangeFromPercent(100, -50, 100);
        expect(result.priceLow).toBe(50);
        expect(result.priceHigh).toBe(200);
    });

    it('should ensure priceLow is never negative', () => {
        const result = getPriceRangeFromPercent(10, -200, 10);
        expect(result.priceLow).toBe(0); // -200% would be -10, capped at 0
    });

    it('should handle decimal prices', () => {
        const result = getPriceRangeFromPercent(0.00256, -10, 10);
        expect(result.priceLow).toBeCloseTo(0.00256 * 0.9, 8);
        expect(result.priceHigh).toBeCloseTo(0.00256 * 1.1, 8);
    });
});

describe('RANGE_PRESETS', () => {
    it('should be an array with preset configurations', () => {
        expect(Array.isArray(RANGE_PRESETS)).toBe(true);
        expect(RANGE_PRESETS.length).toBeGreaterThan(0);
    });

    it('should have required properties in each preset', () => {
        RANGE_PRESETS.forEach(preset => {
            expect(preset).toHaveProperty('label');
            expect(preset).toHaveProperty('lowerPct');
            expect(preset).toHaveProperty('upperPct');
            expect(preset).toHaveProperty('description');
        });
    });

    it('should include Narrow preset (±10%)', () => {
        const preset = RANGE_PRESETS.find(p => p.label === 'Narrow');
        expect(preset).toBeDefined();
        expect(preset.lowerPct).toBe(-10);
        expect(preset.upperPct).toBe(10);
    });

    it('should include Spot preset (±2%)', () => {
        const preset = RANGE_PRESETS.find(p => p.label === 'Spot');
        expect(preset).toBeDefined();
        expect(preset.lowerPct).toBe(-2);
        expect(preset.upperPct).toBe(2);
    });

    it('should include Wide and Balanced presets', () => {
        const wide = RANGE_PRESETS.find(p => p.label === 'Wide');
        const balanced = RANGE_PRESETS.find(p => p.label === 'Balanced');
        expect(wide).toBeDefined();
        expect(balanced).toBeDefined();
    });
});
