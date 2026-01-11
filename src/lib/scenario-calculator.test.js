/**
 * Tests for scenario-calculator.js
 * Focus on external rewards (SUI incentives) parsing
 */

import { describe, it, expect, vi } from 'vitest';
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

    it('should use volatility-based IL when no exit price provided', () => {
        const scenario = {
            pool: basePool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 50,
            exitPrice: null, // No exit price
        };
        const result = calculateScenarioResults(scenario);

        // Should use volatility estimation (expected scenario)
        expect(result.ilPercent).toBeLessThan(0); // IL is always negative
        expect(result.ilDollar).toBeGreaterThan(0);
    });
});
