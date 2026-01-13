const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';
const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';
const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';
const SAIL_DECIMALS = 6;
const SAIL_SPOT = 0.00112; // SUI per SAIL

async function graphqlQuery(query) {
    const response = await fetch(TRADEPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-user': API_USER, 'x-api-key': API_KEY },
        body: JSON.stringify({ query }),
    });
    return (await response.json()).data.sui;
}

async function fetchObjects(objectIds) {
    // Batch fetch using multiGetObjects
    const response = await fetch(SUI_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_multiGetObjects',
            params: [objectIds, { showContent: true }],
        }),
    });
    const result = await response.json();
    return result.result || [];
}

async function main() {
    console.log('Fetching data from Tradeport and Sui...\n');

    // Get all trades
    const tradesResult = await graphqlQuery(`{ sui { actions(where: { collection_id: { _eq: "${VESAIL_COLLECTION_ID}" }, type: { _eq: "buy" } }, limit: 100) { id price nft_id block_time } } }`);
    const trades = tradesResult.actions.sort((a, b) => new Date(b.block_time) - new Date(a.block_time));

    // Get all listings
    const listingsResult = await graphqlQuery(`{ sui { listings(where: { collection_id: { _eq: "${VESAIL_COLLECTION_ID}" } }, limit: 100) { id price nft_id } } }`);
    const activeListings = listingsResult.listings.filter(l => l.price && l.price > 0);

    // Get all NFT token IDs
    const allNftIds = [...new Set([...trades.map(t => t.nft_id), ...activeListings.map(l => l.nft_id)])];
    const nftsResult = await graphqlQuery(`{ sui { nfts(where: { id: { _in: ${JSON.stringify(allNftIds)} } }) { id token_id } } }`);
    const nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));

    // Batch fetch all on-chain objects
    const allTokenIds = [...new Set([...nftsResult.nfts.map(n => n.token_id)])];
    console.log(`Fetching ${allTokenIds.length} on-chain objects...`);

    const onChainData = await fetchObjects(allTokenIds);
    const onChainMap = new Map();
    for (const obj of onChainData) {
        if (obj?.data?.objectId && obj?.data?.content?.fields) {
            onChainMap.set(obj.data.objectId, obj.data.content.fields);
        }
    }

    // ========== PART 1: ALL SALES ==========
    console.log('\n' + '='.repeat(80));
    console.log('PART 1: ALL veSAIL SALES HISTORY');
    console.log('='.repeat(80) + '\n');

    console.log('Date'.padEnd(12) + 'Price SUI'.padStart(10) + 'Locked SAIL'.padStart(14) + '$/SAIL'.padStart(12) + 'vs Spot'.padStart(10) + 'Lock'.padStart(8));
    console.log('-'.repeat(66));

    let totalVolume = 0;
    let totalSail = 0;

    for (const trade of trades) {
        const tokenId = nftMap.get(trade.nft_id);
        const priceInSui = Number(trade.price) / 1e9;
        const tradeDate = new Date(trade.block_time);
        const dateStr = tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        totalVolume += priceInSui;

        if (!tokenId) {
            console.log(dateStr.padEnd(12) + priceInSui.toFixed(2).padStart(10) + '(no data)'.padStart(14));
            continue;
        }

        const fields = onChainMap.get(tokenId);
        if (!fields) {
            console.log(dateStr.padEnd(12) + priceInSui.toFixed(2).padStart(10) + '(burned)'.padStart(14));
            continue;
        }

        const lockedSail = Number(fields.amount) / Math.pow(10, SAIL_DECIMALS);
        const isPermanent = fields.permanent === true;
        const pricePerSail = lockedSail > 0 ? priceInSui / lockedSail : 0;
        const vsSpot = pricePerSail > 0 ? ((pricePerSail / SAIL_SPOT) * 100).toFixed(0) + '%' : '-';

        if (lockedSail > 0) totalSail += lockedSail;

        console.log(
            dateStr.padEnd(12) +
            priceInSui.toFixed(2).padStart(10) +
            (lockedSail > 0 ? lockedSail.toFixed(0) : '0').padStart(14) +
            (pricePerSail > 0 ? pricePerSail.toFixed(6) : '-').padStart(12) +
            vsSpot.padStart(10) +
            (isPermanent ? 'PERM' : 'TIME').padStart(8)
        );
    }
    console.log('-'.repeat(66));
    console.log(`Total: ${trades.length} sales, ${totalVolume.toFixed(2)} SUI volume`);
    if (totalSail > 0) {
        const avgPrice = totalVolume / totalSail;
        console.log(`Weighted avg: ${avgPrice.toFixed(6)} SUI/SAIL (${(avgPrice / SAIL_SPOT * 100).toFixed(0)}% of spot)`);
    }

    // ========== PART 2: CURRENT LISTINGS ==========
    console.log('\n' + '='.repeat(80));
    console.log('PART 2: CURRENT LISTINGS - SORTED BY BEST DEAL (MOST DISCOUNTED)');
    console.log('='.repeat(80) + '\n');

    const evaluatedListings = [];

    for (const listing of activeListings) {
        const tokenId = nftMap.get(listing.nft_id);
        const priceInSui = Number(listing.price) / 1e9;

        if (!tokenId) continue;

        const fields = onChainMap.get(tokenId);
        if (!fields) continue;

        const lockedSail = Number(fields.amount) / Math.pow(10, SAIL_DECIMALS);
        const isPermanent = fields.permanent === true;
        const endTimestamp = parseInt(fields.end || 0);

        if (lockedSail <= 0) continue;

        const pricePerSail = priceInSui / lockedSail;
        const vsSpotPct = (pricePerSail / SAIL_SPOT) * 100;
        const discount = 100 - vsSpotPct;

        let lockInfo = 'PERM';
        if (!isPermanent && endTimestamp > 0) {
            const yearsRemaining = (new Date(endTimestamp * 1000) - new Date()) / (365 * 24 * 60 * 60 * 1000);
            lockInfo = yearsRemaining > 0 ? `${yearsRemaining.toFixed(1)}yr` : 'EXPIRED';
        }

        evaluatedListings.push({
            tokenId,
            priceInSui,
            lockedSail,
            pricePerSail,
            vsSpotPct,
            discount,
            lockInfo,
            isPermanent,
        });
    }

    // Sort by best deal (highest discount / lowest % of spot)
    evaluatedListings.sort((a, b) => a.vsSpotPct - b.vsSpotPct);

    console.log('Rank'.padEnd(6) + 'Price SUI'.padStart(10) + 'Locked SAIL'.padStart(12) + '$/SAIL'.padStart(12) + 'vs Spot'.padStart(10) + 'Discount'.padStart(10) + 'Lock'.padStart(8));
    console.log('-'.repeat(68));

    evaluatedListings.forEach((l, i) => {
        const discountStr = l.discount > 0 ? `-${l.discount.toFixed(0)}%` : `+${Math.abs(l.discount).toFixed(0)}%`;
        console.log(
            `#${i + 1}`.padEnd(6) +
            l.priceInSui.toFixed(2).padStart(10) +
            l.lockedSail.toFixed(0).padStart(12) +
            l.pricePerSail.toFixed(6).padStart(12) +
            (l.vsSpotPct.toFixed(0) + '%').padStart(10) +
            discountStr.padStart(10) +
            l.lockInfo.padStart(8)
        );
    });

    console.log('-'.repeat(68));
    console.log(`\nReference: SAIL Spot = ${SAIL_SPOT} SUI (~$0.00204)`);
    console.log(`Total listings with SAIL: ${evaluatedListings.length}`);

    if (evaluatedListings.length > 0) {
        const best = evaluatedListings[0];
        console.log(`\n🏆 BEST DEAL:`);
        console.log(`   ${best.lockedSail.toFixed(0)} SAIL for ${best.priceInSui.toFixed(2)} SUI`);
        console.log(`   ${best.discount > 0 ? best.discount.toFixed(0) + '% DISCOUNT' : Math.abs(best.discount).toFixed(0) + '% premium'} to spot`);
        console.log(`   Lock: ${best.lockInfo}`);
        console.log(`   https://www.tradeport.xyz/sui/collection/0xe616397e503278d406e184d2258bcbe7a263d0192cc0848de2b54b518165f832%3A%3Avoting_escrow%3A%3ALock?tokenId=${best.tokenId}`);
    }
}

main().catch(console.error);
