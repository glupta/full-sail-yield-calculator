/**
 * Tests for emission-projector.js
 * Full coverage for emission projection calculations
 */

// Jest globals (describe, it, expect) are provided automatically
import {
    projectEmissions,
    calculateEmissionAPR,
    getEmissionValue
} from './emission-projector';

describe('projectEmissions', () => {
    describe('edge cases', () => {
        it('should return 0 when poolTVL is 0', () => {
            expect(projectEmissions(10000, 0, 1000, 30)).toBe(0);
        });

        it('should return 0 when poolTVL is negative', () => {
            expect(projectEmissions(10000, -1000000, 1000, 30)).toBe(0);
        });

        it('should return 0 when depositUsd is 0', () => {
            expect(projectEmissions(0, 1000000, 1000, 30)).toBe(0);
        });

        it('should return 0 when depositUsd is negative', () => {
            expect(projectEmissions(-10000, 1000000, 1000, 30)).toBe(0);
        });
    });

    describe('emission projection', () => {
        it('should project emissions based on TVL share', () => {
            // 1% of pool = 1% of emissions
            const emissions = projectEmissions(10000, 1000000, 1000, 1);
            expect(emissions).toBe(10); // 1% of 1000 = 10
        });

        it('should scale with timeline', () => {
            const daily = projectEmissions(10000, 1000000, 1000, 1);
            const monthly = projectEmissions(10000, 1000000, 1000, 30);
            expect(monthly).toBe(daily * 30);
        });

        it('should scale with deposit size', () => {
            const small = projectEmissions(10000, 1000000, 1000, 30);
            const large = projectEmissions(100000, 1000000, 1000, 30);
            expect(large).toBe(small * 10);
        });

        it('should handle very small TVL shares', () => {
            const emissions = projectEmissions(100, 1000000000, 1000, 30);
            expect(emissions).toBeCloseTo(0.003, 6);
        });
    });
});

describe('calculateEmissionAPR', () => {
    it('should return 0 when poolTVL is 0', () => {
        expect(calculateEmissionAPR(1000, 0.5, 0)).toBe(0);
    });

    it('should return 0 when poolTVL is negative', () => {
        expect(calculateEmissionAPR(1000, 0.5, -1000000)).toBe(0);
    });

    it('should calculate APR correctly', () => {
        // 1000 oSAIL/day * $0.5 = $500/day value
        // $500/day * 365 = $182,500/year
        // APR = $182,500 / $1,000,000 = 0.1825 = 18.25%
        const apr = calculateEmissionAPR(1000, 0.5, 1000000);
        expect(apr).toBeCloseTo(0.1825, 4);
    });

    it('should scale with emission rate', () => {
        const low = calculateEmissionAPR(100, 0.5, 1000000);
        const high = calculateEmissionAPR(1000, 0.5, 1000000);
        expect(high).toBe(low * 10);
    });

    it('should scale with SAIL price', () => {
        const cheap = calculateEmissionAPR(1000, 0.25, 1000000);
        const expensive = calculateEmissionAPR(1000, 0.50, 1000000);
        expect(expensive).toBe(cheap * 2);
    });

    it('should inversely scale with TVL', () => {
        const lowTvl = calculateEmissionAPR(1000, 0.5, 500000);
        const highTvl = calculateEmissionAPR(1000, 0.5, 1000000);
        expect(lowTvl).toBe(highTvl * 2);
    });
});

describe('getEmissionValue', () => {
    it('should calculate 100% lock value', () => {
        const result = getEmissionValue(1000, 0.5, 1.0);
        expect(result.lockPortion).toBe(1000);
        expect(result.lockValue).toBe(500); // 1000 * $0.5
        expect(result.redeemPortion).toBe(0);
        expect(result.redeemValue).toBe(0);
        expect(result.totalValue).toBe(500);
    });

    it('should calculate 100% redeem value (50% of SAIL price)', () => {
        const result = getEmissionValue(1000, 0.5, 0);
        expect(result.lockPortion).toBe(0);
        expect(result.lockValue).toBe(0);
        expect(result.redeemPortion).toBe(1000);
        expect(result.redeemValue).toBe(250); // 1000 * $0.5 * 0.5
        expect(result.totalValue).toBe(250);
    });

    it('should calculate 50/50 split correctly', () => {
        const result = getEmissionValue(1000, 0.5, 0.5);
        expect(result.lockPortion).toBe(500);
        expect(result.lockValue).toBe(250); // 500 * $0.5
        expect(result.redeemPortion).toBe(500);
        expect(result.redeemValue).toBe(125); // 500 * $0.5 * 0.5
        expect(result.totalValue).toBe(375);
    });

    it('should show lock is 2x more valuable than redeem', () => {
        const lockAll = getEmissionValue(1000, 0.5, 1.0);
        const redeemAll = getEmissionValue(1000, 0.5, 0);
        expect(lockAll.totalValue).toBe(redeemAll.totalValue * 2);
    });

    it('should return all required properties', () => {
        const result = getEmissionValue(1000, 0.5, 0.7);
        expect(result).toHaveProperty('lockPortion');
        expect(result).toHaveProperty('lockValue');
        expect(result).toHaveProperty('redeemPortion');
        expect(result).toHaveProperty('redeemValue');
        expect(result).toHaveProperty('totalValue');
    });
});
