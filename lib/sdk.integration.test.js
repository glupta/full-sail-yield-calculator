/**
 * SDK Integration Tests
 * Inspects actual SDK data structure to debug missing rewards
 *
 * Run with: npm run test -- lib/sdk.integration.test.js
 */

// Jest globals (describe, it, expect, beforeAll) are provided automatically
import { fetchGaugePools, fetchPool, getSDK } from './sdk';

describe('SDK Pool.getList API', () => {
    it('should fetch all pools using sdk.Pool.getList with page: 0', async () => {
        const sdk = await getSDK();
        expect(sdk).toBeDefined();

        const result = await sdk.Pool.getList({
            pagination: { page: 0, page_size: 100 }
        });

        console.log('Pool.getList result:', {
            poolsReturned: result.pools?.length,
            totalPools: result.pagination?.total,
        });

        expect(result.pools).toBeDefined();
        expect(result.pools.length).toBeGreaterThan(0);
        expect(result.pools.length).toBe(result.pagination.total);

        // Verify pool structure
        const firstPool = result.pools[0];
        expect(firstPool.address).toBeDefined();
        expect(firstPool.name).toBeDefined();
        expect(firstPool.dinamic_stats).toBeDefined();
        expect(firstPool.token_a).toBeDefined();
        expect(firstPool.token_b).toBeDefined();

        console.log('First pool:', {
            address: firstPool.address.slice(0, 20) + '...',
            name: firstPool.name,
            tvl: firstPool.dinamic_stats?.tvl,
            apr: firstPool.dinamic_stats?.apr,
        });
    }, 15000);

    it('should return 0 pools with page: 1 (0-indexed, so page 1 is empty)', async () => {
        const sdk = await getSDK();
        const result = await sdk.Pool.getList({
            pagination: { page: 1, page_size: 100 }
        });

        // page: 1 with 100 per page should return 0 if total is <= 100
        console.log('Page 1 result:', result.pools?.length, 'of', result.pagination?.total);
        expect(result.pools.length).toBe(0);
    }, 10000);
});

describe('SDK Pool Data Inspection', () => {
    let pools;
    let suiPool;

    // Increase timeout for network calls
    beforeAll(async () => {
        pools = await fetchGaugePools();
        suiPool = pools.find(p => p.name === 'SUI/USDC');
    }, 30000);

    it('should fetch gauge pools successfully', () => {
        expect(pools.length).toBeGreaterThan(0);
        console.log(`Fetched ${pools.length} gauge pools`);
    });

    it('should include SUI/USDC pool', () => {
        expect(suiPool).toBeDefined();
        console.log('SUI/USDC pool found:', {
            id: suiPool.id,
            name: suiPool.name,
            currentPrice: suiPool.currentPrice,
        });
    });

    describe('SUI/USDC pool rewards structure', () => {
        it('should inspect pool.rewards property', () => {
            console.log('\n=== SUI/USDC pool.rewards inspection ===');
            console.log('Type:', typeof suiPool?.rewards);
            console.log('Is Array:', Array.isArray(suiPool?.rewards));
            console.log('Value:', JSON.stringify(suiPool?.rewards, null, 2));

            if (suiPool?.rewards && Array.isArray(suiPool.rewards)) {
                console.log('Rewards count:', suiPool.rewards.length);
                suiPool.rewards.forEach((r, i) => {
                    console.log(`Reward ${i}:`, JSON.stringify(r, null, 2));
                    console.log(`  - token type: ${typeof r.token}`);
                    console.log(`  - apr type: ${typeof r.apr}`);
                    console.log(`  - apr value: ${r.apr}`);
                });
            }
        });

        it('should inspect full pool object keys for reward-related fields', () => {
            console.log('\n=== Full pool object keys ===');
            const keys = Object.keys(suiPool || {});
            console.log('All keys:', keys);

            // Look for any reward-related keys
            const rewardKeys = keys.filter(k =>
                k.toLowerCase().includes('reward') ||
                k.toLowerCase().includes('incentive') ||
                k.toLowerCase().includes('bonus') ||
                k.toLowerCase().includes('apr')
            );
            console.log('Reward-related keys:', rewardKeys);

            // Log each reward-related field
            rewardKeys.forEach(key => {
                console.log(`${key}:`, JSON.stringify(suiPool[key], null, 2));
            });
        });

        it('should check dinamic_stats for APR data', () => {
            console.log('\n=== dinamic_stats inspection ===');
            console.log('dinamic_stats:', JSON.stringify(suiPool?.dinamic_stats, null, 2));
        });
    });

    describe('Direct SDK API call', () => {
        it('should fetch raw pool data and inspect rewards', async () => {
            const sdk = await getSDK();
            if (!sdk) {
                console.log('SDK not available');
                return;
            }

            const SUI_USDC_POOL_ID = '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980';
            const rawPool = await sdk.Pool.getById(SUI_USDC_POOL_ID);

            console.log('\n=== Raw SDK Pool.getById response ===');
            console.log('All keys:', Object.keys(rawPool || {}));
            console.log('rewards:', JSON.stringify(rawPool?.rewards, null, 2));
            console.log('external_rewards:', JSON.stringify(rawPool?.external_rewards, null, 2));
            console.log('gauge_rewards:', JSON.stringify(rawPool?.gauge_rewards, null, 2));
            console.log('incentives:', JSON.stringify(rawPool?.incentives, null, 2));

            // Log full object for debugging
            console.log('\n=== Full raw pool object ===');
            console.log(JSON.stringify(rawPool, null, 2));
        }, 15000);
    });
});

describe('End-to-end: SDK pool -> calculateScenarioResults', () => {
    it('should include SUI external rewards in scenario results', async () => {
        const pools = await fetchGaugePools();
        const suiPool = pools.find(p => p.name === 'SUI/USDC');

        expect(suiPool).toBeDefined();
        console.log('\n=== Pool passed to calculator ===');
        console.log('pool.rewards exists:', !!suiPool.rewards);
        console.log('pool.rewards length:', suiPool.rewards?.length);
        console.log('SUI reward:', suiPool.rewards?.find(r => r.token?.symbol === 'SUI'));

        // Import the calculator
        const { calculateScenarioResults } = await import('./scenario-calculator');

        const scenario = {
            pool: suiPool,
            depositAmount: 10000,
            timeline: 30,
            osailStrategy: 0,
            exitPrice: suiPool.currentPrice, // Same price = 0 IL
        };

        const result = calculateScenarioResults(scenario);

        console.log('\n=== Scenario Results ===');
        console.log('externalRewards:', JSON.stringify(result.externalRewards, null, 2));
        console.log('externalRewardsValue:', result.externalRewardsValue);
        console.log('netYield:', result.netYield);

        // Assert SUI rewards are included
        expect(result.externalRewards.length).toBeGreaterThan(0);
        const suiReward = result.externalRewards.find(r => r.token === 'SUI');
        expect(suiReward).toBeDefined();
        expect(suiReward.apr).toBeGreaterThan(0);
        expect(result.externalRewardsValue).toBeGreaterThan(0);
    }, 30000);
});
