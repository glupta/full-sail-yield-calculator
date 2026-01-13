/**
 * Tests for osail-strategy.js
 * Full coverage for oSAIL strategy calculations
 */

import { describe, it, expect } from 'vitest';
import {
    calculateStrategyValue,
    compareStrategies,
    STRATEGY_PRESETS
} from './osail-strategy';

describe('calculateStrategyValue', () => {
    describe('100% lock strategy', () => {
        it('should calculate full lock value', () => {
            const result = calculateStrategyValue(1000, 0.5, 1.0);
            expect(result.lockAmount).toBe(1000);
            expect(result.lockValue).toBe(500); // 1000 * $0.5
            expect(result.redeemAmount).toBe(0);
            expect(result.redeemValue).toBe(0);
            expect(result.totalValue).toBe(500);
        });

        it('should have 2x multiplier vs baseline', () => {
            const result = calculateStrategyValue(1000, 0.5, 1.0);
            // Baseline is 100% redeem = 250, 100% lock = 500, multiplier = 2
            expect(result.valueMultiplier).toBe(2);
        });
    });

    describe('100% redeem strategy', () => {
        it('should calculate full redeem value at 50%', () => {
            const result = calculateStrategyValue(1000, 0.5, 0);
            expect(result.lockAmount).toBe(0);
            expect(result.lockValue).toBe(0);
            expect(result.redeemAmount).toBe(1000);
            expect(result.redeemValue).toBe(250); // 1000 * $0.5 * 0.5
            expect(result.totalValue).toBe(250);
        });

        it('should have 1x multiplier (baseline)', () => {
            const result = calculateStrategyValue(1000, 0.5, 0);
            expect(result.valueMultiplier).toBe(1);
        });
    });

    describe('mixed strategies', () => {
        it('should calculate 70/30 lock/redeem correctly', () => {
            const result = calculateStrategyValue(1000, 0.5, 0.7);
            expect(result.lockAmount).toBeCloseTo(700, 6);
            expect(result.lockValue).toBeCloseTo(350, 6); // 700 * $0.5
            expect(result.redeemAmount).toBeCloseTo(300, 6);
            expect(result.redeemValue).toBeCloseTo(75, 6); // 300 * $0.5 * 0.5
            expect(result.totalValue).toBeCloseTo(425, 6);
        });

        it('should calculate 50/50 correctly', () => {
            const result = calculateStrategyValue(1000, 0.5, 0.5);
            expect(result.lockAmount).toBe(500);
            expect(result.redeemAmount).toBe(500);
            expect(result.totalValue).toBe(375); // 250 + 125
        });
    });

    describe('returned properties', () => {
        it('should return all required properties', () => {
            const result = calculateStrategyValue(1000, 0.5, 0.5);
            expect(result).toHaveProperty('lockAmount');
            expect(result).toHaveProperty('lockValue');
            expect(result).toHaveProperty('lockValuePct');
            expect(result).toHaveProperty('redeemAmount');
            expect(result).toHaveProperty('redeemValue');
            expect(result).toHaveProperty('redeemValuePct');
            expect(result).toHaveProperty('totalValue');
            expect(result).toHaveProperty('valueMultiplier');
        });

        it('should return correct percentages', () => {
            const result = calculateStrategyValue(1000, 0.5, 0.7);
            expect(result.lockValuePct).toBeCloseTo(0.7, 6);
            expect(result.redeemValuePct).toBeCloseTo(0.3, 6);
        });
    });

    describe('edge cases', () => {
        it('should handle 0 oSAIL amount', () => {
            const result = calculateStrategyValue(0, 0.5, 0.5);
            expect(result.totalValue).toBe(0);
            expect(result.valueMultiplier).toBe(1); // baseline is 0, defaults to 1
        });

        it('should scale with SAIL price', () => {
            const cheap = calculateStrategyValue(1000, 0.25, 0.5);
            const expensive = calculateStrategyValue(1000, 0.50, 0.5);
            expect(expensive.totalValue).toBe(cheap.totalValue * 2);
        });
    });
});

describe('compareStrategies', () => {
    it('should return positive diff when strategy1 is better', () => {
        const strategy1 = calculateStrategyValue(1000, 0.5, 1.0); // Lock all = $500
        const strategy2 = calculateStrategyValue(1000, 0.5, 0);   // Redeem all = $250
        const comparison = compareStrategies(strategy1, strategy2);

        expect(comparison.valueDiff).toBe(250);
        expect(comparison.winner).toBe(1);
    });

    it('should return negative diff when strategy2 is better', () => {
        const strategy1 = calculateStrategyValue(1000, 0.5, 0);   // $250
        const strategy2 = calculateStrategyValue(1000, 0.5, 1.0); // $500
        const comparison = compareStrategies(strategy1, strategy2);

        expect(comparison.valueDiff).toBe(-250);
        expect(comparison.winner).toBe(2);
    });

    it('should return 0 winner when strategies are equal', () => {
        const strategy1 = calculateStrategyValue(1000, 0.5, 0.5);
        const strategy2 = calculateStrategyValue(1000, 0.5, 0.5);
        const comparison = compareStrategies(strategy1, strategy2);

        expect(comparison.valueDiff).toBe(0);
        expect(comparison.winner).toBe(0);
    });

    it('should calculate percent difference correctly', () => {
        const strategy1 = calculateStrategyValue(1000, 0.5, 1.0); // $500
        const strategy2 = calculateStrategyValue(1000, 0.5, 0);   // $250
        const comparison = compareStrategies(strategy1, strategy2);

        // $250 diff / $250 baseline * 100 = 100%
        expect(comparison.percentDiff).toBe(100);
    });

    it('should handle 0 totalValue in strategy2', () => {
        const strategy1 = { totalValue: 100 };
        const strategy2 = { totalValue: 0 };
        const comparison = compareStrategies(strategy1, strategy2);

        expect(comparison.percentDiff).toBe(0);
    });
});

describe('STRATEGY_PRESETS', () => {
    it('should have all preset strategies', () => {
        expect(STRATEGY_PRESETS).toHaveProperty('LOCK_ALL');
        expect(STRATEGY_PRESETS).toHaveProperty('REDEEM_ALL');
        expect(STRATEGY_PRESETS).toHaveProperty('BALANCED');
        expect(STRATEGY_PRESETS).toHaveProperty('MOSTLY_LOCK');
    });

    it('should have correct lockPct values', () => {
        expect(STRATEGY_PRESETS.LOCK_ALL.lockPct).toBe(1.0);
        expect(STRATEGY_PRESETS.REDEEM_ALL.lockPct).toBe(0);
        expect(STRATEGY_PRESETS.BALANCED.lockPct).toBe(0.5);
        expect(STRATEGY_PRESETS.MOSTLY_LOCK.lockPct).toBe(0.7);
    });

    it('should have names for all presets', () => {
        expect(STRATEGY_PRESETS.LOCK_ALL.name).toBe('100% Lock');
        expect(STRATEGY_PRESETS.REDEEM_ALL.name).toBe('100% Redeem');
        expect(STRATEGY_PRESETS.BALANCED.name).toBe('50/50');
        expect(STRATEGY_PRESETS.MOSTLY_LOCK.name).toBe('70% Lock');
    });
});
