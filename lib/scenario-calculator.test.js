/**
 * Tests for scenario-calculator.js
 * Focus on external rewards (SUI incentives) parsing
 */

// Jest globals (describe, it, expect) are provided automatically
import { calculateScenarioResults, calculateTotalResults } from './scenario-calculator';

describe('calculateExternalRewards', () => {
    // Baseline pool structure from sdk.Pool.getById
    const basePool = {
        id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980',
        name: 'SUI/USDC',
        dinamic_stats: { tvl: 1000000 },
        distributed_osail_24h: 1e9 * 100, // 100 oSAIL/day
        currentPrice: 3.5,
    };

    describe('when pool.rewards is undefined', () => {
        it('should return empty external rewards', () => {
            const scenario = {
                pool: { ...basePool, rewards: undefined },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards).toEqual([]);
            expect(result.externalRewardsValue).toBe(0);
        });
    });

    describe('when pool.rewards is empty array', () => {
        it('should return empty external rewards', () => {
            const scenario = {
                pool: { ...basePool, rewards: [] },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards).toEqual([]);
            expect(result.externalRewardsValue).toBe(0);
        });
    });

    describe('when pool.rewards has string token format', () => {
        it('should parse token name from module path', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { token: '0x2::sui::SUI', apr: 50 },
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards.length).toBe(1);
            expect(result.externalRewards[0].token).toBe('SUI');
            expect(result.externalRewards[0].apr).toBe(50);
            // APR 50% = daily 0.1370%, 30 days = 4.109% of $10000 = ~$410.96
            expect(result.externalRewards[0].projectedValue).toBeCloseTo(410.96, 0);
        });
    });

    describe('when pool.rewards has object token format', () => {
        it('should extract token from symbol property', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { token: { symbol: 'SUI' }, apr: 25 },
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards.length).toBe(1);
            expect(result.externalRewards[0].token).toBe('SUI');
        });

        it('should fall back to name property if symbol is missing', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { token: { name: 'Sui' }, apr: 25 },
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards[0].token).toBe('Sui');
        });
    });

    describe('when pool.rewards has no token property', () => {
        it('should filter out invalid rewards without token', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { apr: 50 }, // Missing token
                        { token: '0x2::sui::SUI', apr: 25 },
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards.length).toBe(1);
            expect(result.externalRewards[0].token).toBe('SUI');
        });

        it('should filter out rewards without apr', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { token: '0x2::sui::SUI' }, // Missing apr
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards.length).toBe(0);
        });
    });

    describe('when pool.rewards has apr=0', () => {
        it('should filter out zero APR rewards (falsy check)', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { token: '0x2::sui::SUI', apr: 0 },
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            // The filter `r.apr` will be false for apr=0
            expect(result.externalRewards.length).toBe(0);
        });
    });

    describe('SUI pool real-world data format', () => {
        // This test simulates what the actual SDK might return
        // Update this test with real observed data to debug

        it('should handle SDK reward object with nested structure', () => {
            // Example: SDK might return rewards with different structure
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        {
                            token: {
                                symbol: 'SUI',
                                address: '0x2::sui::SUI',
                                decimals: 9,
                            },
                            apr: 15.5,
                            rewardPerSecond: '123456789',
                        },
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards.length).toBe(1);
            expect(result.externalRewards[0].token).toBe('SUI');
            expect(result.externalRewardsValue).toBeGreaterThan(0);
        });

        it('should handle edge case: token is nested object with no standard props', () => {
            const scenario = {
                pool: {
                    ...basePool,
                    rewards: [
                        { token: { id: 'some-id' }, apr: 10 }, // No symbol or name
                    ],
                },
                depositAmount: 10000,
                timeline: 30,
                osailStrategy: 0,
            };
            const result = calculateScenarioResults(scenario);
            expect(result.externalRewards.length).toBe(1);
            expect(result.externalRewards[0].token).toBe('Unknown');
        });
    });
});

describe('calculateScenarioResults - full integration', () => {
    it('should calculate net yield including external rewards', () => {
        const scenario = {
            pool: {
                id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980',
                name: 'SUI/USDC',
                dinamic_stats: { tvl: 500000 },
                distributed_osail_24h: 1e9 * 50, // 50 oSAIL/day
                currentPrice: 3.5,
                rewards: [
                    { token: '0x2::sui::SUI', apr: 30 },
                ],
            },
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 0,
            exitPrice: 3.5, // Same as entry = 0 IL
        };
        const result = calculateScenarioResults(scenario);

        // External rewards at 30% APR
        expect(result.externalRewardsValue).toBeGreaterThan(0);
        expect(result.externalRewards[0].token).toBe('SUI');

        // Net yield should include external rewards
        expect(result.netYield).toBeGreaterThan(result.osailValue);
    });
});

describe('calculateScenarioResults - APR calculations', () => {
    const basePool = {
        id: 'test-pool',
        name: 'TEST/USDC',
        dinamic_stats: { tvl: 1000000 },
        distributed_osail_24h: 1e9 * 1000, // 1000 oSAIL/day
        currentPrice: 1.0,
    };

    it('should return lockAPR, redeemAPR, and sailAPR fields', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50, // 50% lock, 50% redeem
            exitPrice: 1.0,
        };
        const result = calculateScenarioResults(scenario);

        // All APR fields should be defined
        expect(result.lockAPR).toBeDefined();
        expect(result.redeemAPR).toBeDefined();
        expect(result.sailAPR).toBeDefined();
    });

    it('should calculate lockAPR as 2x redeemAPR (1:1 vs 50% value)', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: 1.0,
        };
        const result = calculateScenarioResults(scenario);

        // Lock APR should be exactly 2x redeem APR
        // Lock: 100% SAIL value, Redeem: 50% SAIL value
        expect(result.lockAPR).toBeCloseTo(result.redeemAPR * 2, 6);
    });

    it('should calculate blended sailAPR based on strategy', () => {
        // 100% lock strategy
        const scenarioAllLock = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 100, // 100% lock
            exitPrice: 1.0,
        };
        const resultAllLock = calculateScenarioResults(scenarioAllLock);
        expect(resultAllLock.sailAPR).toBeCloseTo(resultAllLock.lockAPR, 6);

        // 0% lock strategy (all redeem)
        const scenarioAllRedeem = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 0, // 0% lock = 100% redeem
            exitPrice: 1.0,
        };
        const resultAllRedeem = calculateScenarioResults(scenarioAllRedeem);
        expect(resultAllRedeem.sailAPR).toBeCloseTo(resultAllRedeem.redeemAPR, 6);

        // 50% lock strategy - should be average
        const scenarioHalf = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: 1.0,
        };
        const resultHalf = calculateScenarioResults(scenarioHalf);
        const expectedBlended = (resultHalf.lockAPR + resultHalf.redeemAPR) / 2;
        expect(resultHalf.sailAPR).toBeCloseTo(expectedBlended, 6);
    });
});

describe('calculateScenarioResults - IL calculation', () => {
    const basePool = {
        id: 'test-pool',
        name: 'TEST/USDC',
        dinamic_stats: { tvl: 1000000 },
        distributed_osail_24h: 1e9 * 100,
        currentPrice: 10.0, // Entry price
    };

    it('should calculate 0 IL when exit price equals current price', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: 10.0, // Same as entry
        };
        const result = calculateScenarioResults(scenario);
        expect(result.ilPercent).toBe(0);
        expect(result.ilDollar).toBe(0);
    });

    it('should calculate IL correctly for price increase', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: 20.0, // 2x price increase
        };
        const result = calculateScenarioResults(scenario);

        // IL for 2x price: 2*sqrt(2)/(1+2) - 1 ≈ -5.72%
        expect(result.ilPercent).toBeCloseTo(-0.0572, 3);
        expect(result.ilDollar).toBeCloseTo(572, 0);
    });

    it('should calculate IL correctly for price decrease', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: 5.0, // 0.5x price decrease
        };
        const result = calculateScenarioResults(scenario);

        // IL for 0.5x price: 2*sqrt(0.5)/(1+0.5) - 1 ≈ -5.72%
        expect(result.ilPercent).toBeCloseTo(-0.0572, 3);
        expect(result.ilDollar).toBeCloseTo(572, 0);
    });

    it('should default to 0 IL when no exit price provided (defaults to current price)', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: null, // No exit price - should default to current price
        };
        const result = calculateScenarioResults(scenario);

        // When no exit price is set, it defaults to current price = 0 IL
        expect(result.ilPercent).toBe(0);
        expect(result.ilDollar).toBe(0);
    });
});

describe('calculateScenarioResults - Range-based IL amplification', () => {
    const basePool = {
        id: 'test-pool',
        name: 'TEST/USDC',
        dinamic_stats: { tvl: 1000000 },
        distributed_osail_24h: 1e9 * 100,
        currentPrice: 1.0, // Entry price
    };

    it('should have higher IL for narrower price ranges', () => {
        // Wide range: ±50%
        const wideRangeScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.5,  // -50%
            priceRangeHigh: 1.5, // +50%
            exitPrice: 1.1, // 10% increase, still in range
        };
        const wideResult = calculateScenarioResults(wideRangeScenario);

        // Narrow range: ±10%
        const narrowRangeScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.9,  // -10%
            priceRangeHigh: 1.1, // +10%
            exitPrice: 1.1, // 10% increase, at edge of range
        };
        const narrowResult = calculateScenarioResults(narrowRangeScenario);

        console.log('Wide range IL:', wideResult.ilDollar, 'ilPercent:', wideResult.ilPercent);
        console.log('Narrow range IL:', narrowResult.ilDollar, 'ilPercent:', narrowResult.ilPercent);

        // Narrower range should have HIGHER IL (worse)
        expect(Math.abs(narrowResult.ilPercent)).toBeGreaterThan(Math.abs(wideResult.ilPercent));
        expect(narrowResult.ilDollar).toBeGreaterThan(wideResult.ilDollar);
    });

    it('should have very high IL for very narrow (±1%) range', () => {
        // Narrow range: ±1%
        const veryNarrowScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.99,  // -1%
            priceRangeHigh: 1.01, // +1%
            exitPrice: 1.01, // 1% increase, at edge of range
        };
        const veryNarrowResult = calculateScenarioResults(veryNarrowScenario);

        // Standard range: ±10%
        const standardRangeScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.9,  // -10%
            priceRangeHigh: 1.1, // +10%
            exitPrice: 1.01, // Same 1% increase
        };
        const standardResult = calculateScenarioResults(standardRangeScenario);

        console.log('±1% range IL:', veryNarrowResult.ilDollar, 'leverage ~50x');
        console.log('±10% range IL:', standardResult.ilDollar, 'leverage ~5x');

        // ±1% range should have ~10x higher IL than ±10% range for same price move
        expect(veryNarrowResult.ilDollar).toBeGreaterThan(standardResult.ilDollar * 5);
    });

    it('should have MORE IL for ±1% range than full range', () => {
        // Narrow range: ±1%
        const narrowScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.99,  // ±1%
            priceRangeHigh: 1.01,
            exitPrice: 1.05, // 5% increase
        };
        const narrowResult = calculateScenarioResults(narrowScenario);

        // Full range (essentially no concentration)
        const fullRangeScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.01,  // ~full range
            priceRangeHigh: 100,
            exitPrice: 1.05, // Same 5% increase
        };
        const fullResult = calculateScenarioResults(fullRangeScenario);

        console.log('±1% range IL:', narrowResult.ilDollar, 'ilPercent:', narrowResult.ilPercent);
        console.log('Full range IL:', fullResult.ilDollar, 'ilPercent:', fullResult.ilPercent);

        // Log leverage ratio for debugging (IL ratio should match leverage ratio)
        const ilRatio = narrowResult.ilDollar / fullResult.ilDollar;
        console.log('IL ratio (±1% / Full):', ilRatio.toFixed(2), 'x');

        // ±1% range should have HIGHER IL (worse) than full range
        expect(narrowResult.ilDollar).toBeGreaterThan(fullResult.ilDollar);
    });

    it('should have worse IL as price moves further past range boundary', () => {
        // Narrow range: ±5%
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.95,  // -5%
            priceRangeHigh: 1.05, // +5%
            exitPrice: 1.20, // 20% increase, beyond range
        };
        const result = calculateScenarioResults(scenario);

        // Even further beyond range
        const scenarioMoreExtreme = {
            ...scenario,
            exitPrice: 1.50, // 50% increase, way beyond range
        };
        const resultExtreme = calculateScenarioResults(scenarioMoreExtreme);

        console.log('Exit at 1.20 IL:', result.ilDollar);
        console.log('Exit at 1.50 IL:', resultExtreme.ilDollar);

        // IL continues to worsen as price moves further past range
        // This is because HODL value keeps increasing, while LP position
        // is now 100% token1 and tracks linearly with price
        expect(resultExtreme.ilDollar).toBeGreaterThan(result.ilDollar);
    });

    it('should have 0 IL when exit price equals current price regardless of range', () => {
        const narrowScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            priceRangeLow: 0.99,
            priceRangeHigh: 1.01,
            exitPrice: 1.0, // Same as current
        };
        const result = calculateScenarioResults(narrowScenario);

        expect(result.ilPercent).toBe(0);
        expect(result.ilDollar).toBe(0);
    });
});

describe('calculateScenarioResults - Range-based SAIL earnings', () => {
    const basePool = {
        id: 'test-pool',
        name: 'TEST/USDC',
        dinamic_stats: { tvl: 1000000 },
        distributed_osail_24h: 1e9 * 100, // 100 oSAIL/day
        currentPrice: 1.0,
    };

    it('should earn more SAIL with narrower price range (higher leverage)', () => {
        // Wide range
        const wideScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 100,
            priceRangeLow: 0.5,
            priceRangeHigh: 1.5,
            exitPrice: 1.0, // Stay at current price
        };
        const wideResult = calculateScenarioResults(wideScenario);

        // Narrow range
        const narrowScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 100,
            priceRangeLow: 0.9,
            priceRangeHigh: 1.1,
            exitPrice: 1.0, // Stay at current price
        };
        const narrowResult = calculateScenarioResults(narrowScenario);

        console.log('Wide range SAIL:', wideResult.projectedOsail);
        console.log('Narrow range SAIL:', narrowResult.projectedOsail);

        // Narrower range = higher leverage = more SAIL earned
        expect(narrowResult.projectedOsail).toBeGreaterThan(wideResult.projectedOsail);
        expect(narrowResult.osailValue).toBeGreaterThan(wideResult.osailValue);
    });

    it('should earn less SAIL if price exits range (time out of range)', () => {
        // Price stays in range
        const inRangeScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 100,
            priceRangeLow: 0.9,
            priceRangeHigh: 1.1,
            exitPrice: 1.05, // Within range
        };
        const inRangeResult = calculateScenarioResults(inRangeScenario);

        // Price exits range (linear movement to 1.2 means ~50% time in range)
        const outOfRangeScenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 100,
            priceRangeLow: 0.9,
            priceRangeHigh: 1.1,
            exitPrice: 1.2, // Beyond range - exits at 1.1, so only 50% time in range
        };
        const outOfRangeResult = calculateScenarioResults(outOfRangeScenario);

        console.log('In-range SAIL:', inRangeResult.projectedOsail);
        console.log('Out-of-range SAIL:', outOfRangeResult.projectedOsail);

        // Should earn less when price exits range
        expect(outOfRangeResult.projectedOsail).toBeLessThan(inRangeResult.projectedOsail);
    });
});

describe('calculateScenarioResults - effectiveAPR parameter', () => {
    const basePool = {
        id: 'test-pool',
        name: 'TEST/USDC',
        dinamic_stats: { tvl: 1000000 },
        distributed_osail_24h: 1e9 * 100, // 100 oSAIL/day
        currentPrice: 1.0,
    };

    const baseScenario = {
        pool: basePool,
        depositAmount: 10000,
        timeline: 30,
        osailStrategy: 50,
        exitPrice: 1.0,
        priceRangeLow: 0.8,
        priceRangeHigh: 1.2,
    };

    describe('when effectiveAPR is null', () => {
        it('should fall back to emission-based calculation', () => {
            const result = calculateScenarioResults(baseScenario, null);

            // Should have non-zero values from emission calculation
            expect(result).not.toBeNull();
            expect(result.sailAPR).toBeGreaterThan(0);
            expect(result.projectedOsail).toBeGreaterThan(0);
        });
    });

    describe('when effectiveAPR is 0', () => {
        it('should fall back to emission-based calculation (0 is falsy)', () => {
            const result = calculateScenarioResults(baseScenario, 0);

            // Should have non-zero values from emission calculation
            expect(result).not.toBeNull();
            expect(result.sailAPR).toBeGreaterThan(0);
        });
    });

    describe('when effectiveAPR is provided', () => {
        it('should use effectiveAPR for sailAPR', () => {
            const effectiveAPR = 25.5; // 25.5%
            const result = calculateScenarioResults(baseScenario, effectiveAPR);

            expect(result.sailAPR).toBe(effectiveAPR);
        });

        it('should calculate lockAPR equal to effectiveAPR', () => {
            const effectiveAPR = 30;
            const result = calculateScenarioResults(baseScenario, effectiveAPR);

            expect(result.lockAPR).toBe(effectiveAPR);
        });

        it('should calculate redeemAPR as 50% of effectiveAPR', () => {
            const effectiveAPR = 30;
            const result = calculateScenarioResults(baseScenario, effectiveAPR);

            expect(result.redeemAPR).toBe(effectiveAPR * 0.5);
        });

        it('should calculate projected value from APR correctly', () => {
            const effectiveAPR = 36.5; // 36.5% APR
            const result = calculateScenarioResults(baseScenario, effectiveAPR);

            // Expected yield: APR% * deposit * (days/365) * timeInRange
            // 36.5% * 10000 * (30/365) * 1.0 = ~300
            const dailyRate = effectiveAPR / 100 / 365;
            const expectedValue = 10000 * dailyRate * 30;

            // osailValue should be close to expected (accounting for lock/redeem split)
            // At 50% lock strategy: 50% gets 1:1, 50% gets 50% value = 75% average
            expect(result.osailValue).toBeCloseTo(expectedValue * 0.75, 0);
        });

        it('should apply timeInRangeFraction to APR-based yield', () => {
            // Scenario where price exits range
            const outOfRangeScenario = {
                ...baseScenario,
                priceRangeLow: 0.9,
                priceRangeHigh: 1.1,
                exitPrice: 1.2, // Price exits range at 1.1 (50% through timeline)
            };

            const effectiveAPR = 30;
            const resultInRange = calculateScenarioResults(baseScenario, effectiveAPR);
            const resultOutOfRange = calculateScenarioResults(outOfRangeScenario, effectiveAPR);

            // Out of range should earn less due to time fraction
            expect(resultOutOfRange.projectedOsail).toBeLessThan(resultInRange.projectedOsail);
        });
    });

    describe('when comparing APR-based vs emission-based', () => {
        it('SDK APR should produce different results than emission calc', () => {
            const emissionResult = calculateScenarioResults(baseScenario, null);
            const sdkResult = calculateScenarioResults(baseScenario, 50); // Different arbitrary APR

            // Results should differ since we're using different APR sources
            expect(sdkResult.sailAPR).not.toBeCloseTo(emissionResult.sailAPR, 0);
        });
    });

    describe('edge cases', () => {
        it('should handle very high APR values', () => {
            const result = calculateScenarioResults(baseScenario, 500); // 500% APR

            expect(result).not.toBeNull();
            expect(result.sailAPR).toBe(500);
            expect(result.osailValue).toBeGreaterThan(0);
        });

        it('should handle decimal APR values', () => {
            const result = calculateScenarioResults(baseScenario, 12.345);

            expect(result.sailAPR).toBe(12.345);
        });

        it('should not affect IL calculation (IL is independent of APR)', () => {
            const scenario = {
                ...baseScenario,
                exitPrice: 1.5, // 50% price increase
            };

            const resultWithAPR = calculateScenarioResults(scenario, 50);
            const resultWithoutAPR = calculateScenarioResults(scenario, null);

            // IL should be the same regardless of APR source
            expect(resultWithAPR.ilPercent).toBeCloseTo(resultWithoutAPR.ilPercent, 6);
            expect(resultWithAPR.ilDollar).toBeCloseTo(resultWithoutAPR.ilDollar, 1);
        });

        it('should not affect external rewards calculation', () => {
            const scenarioWithRewards = {
                ...baseScenario,
                pool: {
                    ...basePool,
                    rewards: [{ token: '0x2::sui::SUI', apr: 25 }],
                },
            };

            const resultWithAPR = calculateScenarioResults(scenarioWithRewards, 50);
            const resultWithoutAPR = calculateScenarioResults(scenarioWithRewards, null);

            // External rewards should be identical
            expect(resultWithAPR.externalRewardsValue).toBe(resultWithoutAPR.externalRewardsValue);
        });
    });
});
