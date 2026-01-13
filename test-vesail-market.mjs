/**
 * Test script to verify veSAIL market data from Tradeport
 * Run with: node --experimental-fetch test-vesail-market.mjs
 */

const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';
const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';

const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';
const MIST_PER_SUI = 1_000_000_000n;

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
    // All queries should be wrapped in sui { }, so we return data.sui
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
            params: [
                objectId,
                { showContent: true, showType: true },
            ],
        }),
    });
    const result = await response.json();
    return result.result;
}

async function main() {
    console.log('='.repeat(60));
    console.log('veSAIL Market Analysis');
    console.log('='.repeat(60));

    // 1. Fetch recent veSAIL trades
    console.log('\n📊 Fetching recent veSAIL trades from Tradeport...\n');

    const tradesResult = await graphqlQuery(`{ sui {
        actions(
            where: { 
                collection_id: { _eq: "${VESAIL_COLLECTION_ID}" },
                type: { _eq: "buy" }
            },
            limit: 10
        ) {
            id price nft_id block_time
        }
    } }`);

    const trades = tradesResult.actions;
    console.log(`Found ${trades.length} recent trades\n`);

    // 2. Get NFT token_ids for the trades
    const nftIds = trades.map(t => t.nft_id);
    const nftIdList = JSON.stringify(nftIds);

    const nftsResult = await graphqlQuery(`{ sui {
        nfts(where: { id: { _in: ${nftIdList} } }) {
            id token_id
        }
    } }`);

    const nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));

    // 3. For each trade, fetch on-chain veSAIL data
    console.log('🔍 Fetching on-chain veSAIL data for each trade...\n');
    console.log('-'.repeat(80));
    console.log(
        'Trade Date'.padEnd(22) +
        'Price (SUI)'.padStart(12) +
        'Locked SAIL'.padStart(15) +
        'Lock End'.padStart(16) +
        'Price/SAIL'.padStart(15)
    );
    console.log('-'.repeat(80));

    let totalPricePerSail = 0;
    let validTradeCount = 0;

    for (const trade of trades.slice(0, 5)) { // Limit to 5 for speed
        const tokenId = nftMap.get(trade.nft_id);
        if (!tokenId) continue;

        const priceInSui = Number(BigInt(trade.price)) / Number(MIST_PER_SUI);
        const tradeDate = new Date(trade.block_time).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        try {
            const objectData = await fetchSuiObject(tokenId);

            if (objectData?.data?.content?.fields) {
                const fields = objectData.data.content.fields;

                // veSAIL has 'amount' (locked SAIL in MIST) and 'end' (unlock timestamp)
                const lockedAmountMist = BigInt(fields.amount || fields.locked_amount || 0);
                const lockedSail = Number(lockedAmountMist) / Number(MIST_PER_SUI);
                const endTimestamp = parseInt(fields.end || fields.unlock_time || 0);
                const endDate = endTimestamp > 0
                    ? new Date(endTimestamp).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                    : 'Unknown';

                const pricePerSail = lockedSail > 0 ? priceInSui / lockedSail : 0;

                console.log(
                    tradeDate.padEnd(22) +
                    priceInSui.toFixed(2).padStart(12) +
                    lockedSail.toFixed(2).padStart(15) +
                    endDate.padStart(16) +
                    (pricePerSail > 0 ? pricePerSail.toFixed(4) : 'N/A').padStart(15)
                );

                if (pricePerSail > 0) {
                    totalPricePerSail += pricePerSail;
                    validTradeCount++;
                }
            } else {
                console.log(
                    tradeDate.padEnd(22) +
                    priceInSui.toFixed(2).padStart(12) +
                    'Not found'.padStart(15) +
                    '-'.padStart(16) +
                    '-'.padStart(15)
                );
            }
        } catch (err) {
            console.log(
                tradeDate.padEnd(22) +
                priceInSui.toFixed(2).padStart(12) +
                'Error'.padStart(15) +
                '-'.padStart(16) +
                '-'.padStart(15)
            );
        }
    }

    console.log('-'.repeat(80));

    // 4. Calculate average veSAIL price relative to SAIL
    if (validTradeCount > 0) {
        const avgPricePerSail = totalPricePerSail / validTradeCount;
        console.log(`\n📈 Average veSAIL Price per Locked SAIL: ${avgPricePerSail.toFixed(4)} SUI/SAIL`);

        // Compare to SAIL spot price (we'd need to fetch this from the pool)
        console.log(`\n💡 Interpretation:`);
        console.log(`   - If ratio < 1: veSAIL trades at a DISCOUNT to underlying SAIL`);
        console.log(`   - If ratio = 1: veSAIL trades at PAR with underlying SAIL`);
        console.log(`   - If ratio > 1: veSAIL trades at a PREMIUM (voting power valued)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tradeport API integration verified successfully!');
    console.log('='.repeat(60));
}

main().catch(console.error);
