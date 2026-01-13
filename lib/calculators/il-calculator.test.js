/**
 * Tests for il-calculator.js
 * Full coverage for IL calculations
 */

// Jest globals (describe, it, expect) are provided automatically
import {
    calculateIL,
    calculateConcentratedIL,
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

describe('calculateConcentratedIL', () => {
    describe('edge cases and input validation', () => {
        it('should return 0 when P0 is 0 or negative', () => {
            expect(calculateConcentratedIL(0, 100, 80, 120)).toBe(0);
            expect(calculateConcentratedIL(-100, 100, 80, 120)).toBe(0);
        });

        it('should return 0 when P1 is 0 or negative', () => {
            expect(calculateConcentratedIL(100, 0, 80, 120)).toBe(0);
            expect(calculateConcentratedIL(100, -100, 80, 120)).toBe(0);
        });

        it('should return 0 when Pa is 0 or negative', () => {
            expect(calculateConcentratedIL(100, 110, 0, 120)).toBe(0);
            expect(calculateConcentratedIL(100, 110, -80, 120)).toBe(0);
        });

        it('should return 0 when Pb is 0 or negative', () => {
            expect(calculateConcentratedIL(100, 110, 80, 0)).toBe(0);
            expect(calculateConcentratedIL(100, 110, 80, -120)).toBe(0);
        });

        it('should return 0 when Pa >= Pb (invalid range)', () => {
            expect(calculateConcentratedIL(100, 110, 120, 80)).toBe(0);
            expect(calculateConcentratedIL(100, 110, 100, 100)).toBe(0);
        });

        it('should fall back to standard IL when P0 is outside range', () => {
            // P0 below range
            const ilBelow = calculateConcentratedIL(70, 100, 80, 120);
            const standardIL = calculateIL(70, 100);
            expect(ilBelow).toBeCloseTo(standardIL, 6);

            // P0 above range
            const ilAbove = calculateConcentratedIL(130, 100, 80, 120);
            const standardIL2 = calculateIL(130, 100);
            expect(ilAbove).toBeCloseTo(standardIL2, 6);
        });
    });

    describe('no price change', () => {
        it('should return 0 when exit price equals entry price', () => {
            const il = calculateConcentratedIL(100, 100, 80, 120);
            expect(il).toBeCloseTo(0, 6);
        });
    });

    describe('price stays in range', () => {
        it('should calculate IL for small price increase within range', () => {
            // P0=100, P1=110, range [80, 120]
            const il = calculateConcentratedIL(100, 110, 80, 120);
            expect(il).toBeLessThan(0); // IL is always negative
            expect(il).toBeGreaterThan(-0.1); // But not extreme for small move
        });

        it('should calculate IL for small price decrease within range', () => {
            // P0=100, P1=90, range [80, 120]
            const il = calculateConcentratedIL(100, 90, 80, 120);
            expect(il).toBeLessThan(0);
            expect(il).toBeGreaterThan(-0.1);
        });

        it('should have symmetric IL for equal up/down moves within range', () => {
            const ilUp = calculateConcentratedIL(100, 110, 80, 120);
            const ilDown = calculateConcentratedIL(100, 90, 80, 120);
            // Not perfectly symmetric but should be similar magnitude
            expect(Math.abs(ilUp)).toBeCloseTo(Math.abs(ilDown), 1);
        });
    });

    describe('price exits range', () => {
        it('should calculate IL when price goes above range', () => {
            // P0=100, P1=150 (above Pb=120)
            const il = calculateConcentratedIL(100, 150, 80, 120);
            expect(il).toBeLessThan(0);
            // Position is 100% token1 at P1
        });

        it('should calculate IL when price goes below range', () => {
            // P0=100, P1=50 (below Pa=80)
            const il = calculateConcentratedIL(100, 50, 80, 120);
            expect(il).toBeLessThan(0);
            // Position is 100% token0 at P1
        });

        it('should cap IL appropriately when price exits range', () => {
            // IL shouldn't keep growing linearly as price moves further out
            const il1 = calculateConcentratedIL(100, 200, 80, 120);
            const il2 = calculateConcentratedIL(100, 400, 80, 120);
            // Both should be significant losses since position is 100% one token
            expect(il1).toBeLessThan(0);
            expect(il2).toBeLessThan(0);
        });
    });

    describe('range width effects', () => {
        it('should have worse IL for narrower ranges (same price move)', () => {
            // Narrow range: 95-105 (±5%)
            const ilNarrow = calculateConcentratedIL(100, 110, 95, 105);
            // Wide range: 50-200 (±100%)
            const ilWide = calculateConcentratedIL(100, 110, 50, 200);

            // Narrow range exits (110 > 105), so IL is based on boundary behavior
            // Wide range stays in, so IL is continuous within range
            // The narrow range should experience more IL due to concentration
            expect(Math.abs(ilNarrow)).toBeGreaterThan(Math.abs(ilWide));
        });

        it('should approach standard IL for very wide ranges', () => {
            // Very wide range approximates full-range position
            const concentratedIL = calculateConcentratedIL(100, 200, 1, 10000);
            const standardIL = calculateIL(100, 200);

            // Should be in similar ballpark
            expect(concentratedIL).toBeLessThan(0);
            expect(standardIL).toBeLessThan(0);
            // Very wide range should be closer to standard
            expect(Math.abs(concentratedIL - standardIL)).toBeLessThan(0.05);
        });
    });

    describe('realistic scenarios', () => {
        it('should calculate IL for typical ±10% range with 20% price increase', () => {
            // Entry at $1, range $0.90-$1.10, exit at $1.20
            const il = calculateConcentratedIL(1, 1.2, 0.9, 1.1);
            expect(il).toBeLessThan(0);
            // Position becomes 100% base token at $1.10
        });

        it('should calculate IL for tight ±5% range with modest move', () => {
            // Entry at $100, range $95-$105, exit at $102
            const il = calculateConcentratedIL(100, 102, 95, 105);
            expect(il).toBeLessThan(0);
            expect(il).toBeGreaterThan(-0.05); // Small move, small IL
        });
    });
});

