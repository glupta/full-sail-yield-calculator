/**
 * Enhanced veSAIL Market Analysis - Voting Power Valuation
 * Calculates price per voting power unit and compares to SAIL spot price
 * 
 * Run with: node test-vesail-voting-power.mjs
 */

const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';
const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';

const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';
const MIST_PER_SUI = 1_000_000_000n;
const MIST_PER_SAIL = 1_000_000_000n;

// veSAIL max lock time is 4 years (in milliseconds)
const MAX_LOCK_TIME_MS = 4 * 365 * 24 * 60 * 60 * 1000;

async function graphqlQuery(query) {
    const response = await fetch(TRADEPORT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-user': API_USER,
            'x-api-key': API_KEY,
        },
        body: JSON.stringify({ query }),
    });
    const result = await response.json();
    if (result.errors) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.data.sui;
}

async function fetchSuiObject(objectId) {
    const response = await fetch(SUI_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getObject',
            params: [objectId, { showContent: true, showType: true }],
        }),
    });
    const result = await response.json();
    return result.result;
}

/**
 * Calculate voting power at a given point in time
 * For permanent locks: voting_power = locked_amount (constant)
 * For time locks: voting_power = locked_amount * (time_remaining / MAX_LOCK_TIME)
 */
function calculateVotingPower(lockedSail, endTimestamp, isPermanent, atDate) {
    if (isPermanent) {
        // Permanent locks have full voting power forever
        return lockedSail;
    }

    if (endTimestamp === 0) {
        // If end is 0 but not permanent, treat as expired
        return 0;
    }

    const endTime = endTimestamp * 1000; // Convert to ms if in seconds
    const atTime = atDate.getTime();

    if (atTime >= endTime) {
        // Lock has expired, no voting power
        return 0;
    }

    const timeRemaining = endTime - atTime;
    const votingPowerRatio = Math.min(timeRemaining / MAX_LOCK_TIME_MS, 1);
    return lockedSail * votingPowerRatio;
}

async function main() {
    console.log('='.repeat(70));
    console.log('veSAIL Market Analysis - Voting Power Valuation');
    console.log('='.repeat(70));

    // 1. Fetch recent veSAIL trades
    console.log('\n📊 Fetching recent veSAIL trades from Tradeport...\n');

    const tradesResult = await graphqlQuery(`{ sui {
        actions(
            where: { 
                collection_id: { _eq: "${VESAIL_COLLECTION_ID}" },
                type: { _eq: "buy" }
            },
            limit: 20
        ) {
            id price nft_id block_time
        }
    } }`);

    const trades = tradesResult.actions;
    console.log(`Found ${trades.length} trades\n`);

    // 2. Get NFT token_ids for the trades
    const nftIds = trades.map(t => t.nft_id);
    const nftIdList = JSON.stringify(nftIds);

    const nftsResult = await graphqlQuery(`{ sui {
        nfts(where: { id: { _in: ${nftIdList} } }) {
            id token_id
        }
    } }`);

    const nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));

    // 3. Process each trade
    console.log('-'.repeat(100));
    console.log(
        'Trade Date'.padEnd(14) +
        'Price SUI'.padStart(11) +
        'Locked SAIL'.padStart(14) +
        'Lock Type'.padStart(12) +
        'Voting Pwr'.padStart(12) +
        '$/veSAIL'.padStart(12) +
        '$/SAIL'.padStart(10) +
        'Premium'.padStart(10)
    );
    console.log('-'.repeat(100));

    const analysisResults = [];

    for (const trade of trades) {
        const tokenId = nftMap.get(trade.nft_id);
        if (!tokenId) continue;

        const priceInSui = Number(BigInt(trade.price)) / Number(MIST_PER_SUI);
        const tradeDate = new Date(trade.block_time);
        const tradeDateStr = tradeDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit',
        });

        try {
            const objectData = await fetchSuiObject(tokenId);

            if (objectData?.data?.content?.fields) {
                const fields = objectData.data.content.fields;

                const lockedAmountMist = BigInt(fields.amount || 0);
                const lockedSail = Number(lockedAmountMist) / Number(MIST_PER_SAIL);
                const endTimestamp = parseInt(fields.end || 0);
                const isPermanent = fields.permanent === true;
                const startTimestamp = parseInt(fields.start || 0);

                // Calculate voting power at time of trade
                const votingPower = calculateVotingPower(lockedSail, endTimestamp, isPermanent, tradeDate);

                // Lock type display
                let lockType = isPermanent ? 'PERMANENT' : 'TIME-LOCK';
                if (!isPermanent && endTimestamp > 0) {
                    const endDate = new Date(endTimestamp * 1000);
                    const yearsRemaining = (endDate.getTime() - tradeDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
                    lockType = `${yearsRemaining.toFixed(1)}yr`;
                }

                // Price per voting power unit (in SUI)
                const pricePerVotingPower = votingPower > 0 ? priceInSui / votingPower : 0;

                // Price per locked SAIL (in SUI) - baseline comparison
                const pricePerSail = lockedSail > 0 ? priceInSui / lockedSail : 0;

                // Premium: how much more is paid for voting power vs just the underlying SAIL
                // If premium > 1, voting power is being valued
                const premium = pricePerSail > 0 && pricePerVotingPower > 0
                    ? (pricePerVotingPower / pricePerSail - 1) * 100
                    : 0;

                console.log(
                    tradeDateStr.padEnd(14) +
                    priceInSui.toFixed(2).padStart(11) +
                    lockedSail.toFixed(2).padStart(14) +
                    lockType.padStart(12) +
                    votingPower.toFixed(2).padStart(12) +
                    (pricePerVotingPower > 0 ? pricePerVotingPower.toFixed(4) : 'N/A').padStart(12) +
                    (pricePerSail > 0 ? pricePerSail.toFixed(4) : 'N/A').padStart(10) +
                    (isPermanent ? 'MAX' : `${premium >= 0 ? '+' : ''}${premium.toFixed(0)}%`).padStart(10)
                );

                if (votingPower > 0) {
                    analysisResults.push({
                        date: tradeDate,
                        priceInSui,
                        lockedSail,
                        votingPower,
                        pricePerVotingPower,
                        pricePerSail,
                        isPermanent,
                    });
                }
            } else {
                console.log(
                    tradeDateStr.padEnd(14) +
                    priceInSui.toFixed(2).padStart(11) +
                    '(burned/moved)'.padStart(14) +
                    '-'.padStart(12) +
                    '-'.padStart(12) +
                    '-'.padStart(12) +
                    '-'.padStart(10) +
                    '-'.padStart(10)
                );
            }
        } catch (err) {
            console.log(
                tradeDateStr.padEnd(14) +
                priceInSui.toFixed(2).padStart(11) +
                'Error'.padStart(14) +
                '-'.padStart(12) +
                '-'.padStart(12) +
                '-'.padStart(12) +
                '-'.padStart(10) +
                '-'.padStart(10)
            );
        }
    }

    console.log('-'.repeat(100));

    // 4. Summary statistics
    if (analysisResults.length > 0) {
        const permanentLocks = analysisResults.filter(r => r.isPermanent);
        const timeLocks = analysisResults.filter(r => !r.isPermanent);

        console.log('\n📈 SUMMARY STATISTICS\n');

        if (permanentLocks.length > 0) {
            const avgPricePerVP = permanentLocks.reduce((s, r) => s + r.pricePerVotingPower, 0) / permanentLocks.length;
            console.log(`🔒 Permanent Locks (${permanentLocks.length} trades):`);
            console.log(`   Avg Price per Voting Power: ${avgPricePerVP.toFixed(4)} SUI/veSAIL`);
            console.log(`   (Permanent locks have 1:1 voting power to locked SAIL)`);
        }

        if (timeLocks.length > 0) {
            const avgPricePerVP = timeLocks.reduce((s, r) => s + r.pricePerVotingPower, 0) / timeLocks.length;
            const avgPricePerSail = timeLocks.reduce((s, r) => s + r.pricePerSail, 0) / timeLocks.length;
            console.log(`\n⏰ Time Locks (${timeLocks.length} trades):`);
            console.log(`   Avg Price per Voting Power: ${avgPricePerVP.toFixed(4)} SUI/veSAIL`);
            console.log(`   Avg Price per Locked SAIL:  ${avgPricePerSail.toFixed(4)} SUI/SAIL`);
        }

        console.log('\n💡 INTERPRETATION:');
        console.log('   - $/veSAIL = Price paid per unit of VOTING POWER');
        console.log('   - $/SAIL = Price paid per unit of LOCKED SAIL');
        console.log('   - Premium% = How much MORE paid for voting power vs underlying SAIL');
        console.log('   - Permanent locks: voting power = locked SAIL (no decay)');
        console.log('   - Time locks: voting power decays linearly to 0 at expiry');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Analysis complete!');
    console.log('='.repeat(70));
}

main().catch(console.error);
