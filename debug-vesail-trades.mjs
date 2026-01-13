const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';
const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';
const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';

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

async function main() {
    // Get recent trades
    const query = `{ sui {
        actions(
            where: { 
                collection_id: { _eq: "${VESAIL_COLLECTION_ID}" },
                type: { _eq: "buy" }
            },
            limit: 20
        ) {
            id price nft_id block_time
        }
    } }`;

    const tradesResult = await graphqlQuery(query);

    // Sort by block_time descending to get most recent
    const trades = tradesResult.actions.sort((a, b) =>
        new Date(b.block_time) - new Date(a.block_time)
    ).slice(0, 5);

    console.log('\n=== 5 MOST RECENT veSAIL TRADES (RAW DATA) ===\n');

    // Get NFT token_ids
    const nftIds = trades.map(t => t.nft_id);
    const nftQuery = `{ sui { nfts(where: { id: { _in: ${JSON.stringify(nftIds)} } }) { id token_id } } }`;
    const nftsResult = await graphqlQuery(nftQuery);
    const nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));

    for (const trade of trades) {
        const tokenId = nftMap.get(trade.nft_id);
        const priceInSui = Number(trade.price) / 1e9;
        const tradeDate = new Date(trade.block_time);

        console.log(`Trade: ${tradeDate.toISOString()}`);
        console.log(`  Price: ${priceInSui} SUI (${trade.price} MIST)`);
        console.log(`  NFT ID: ${tokenId}`);

        if (tokenId) {
            const obj = await fetchSuiObject(tokenId);
            if (obj?.data?.content?.fields) {
                const fields = obj.data.content.fields;
                console.log(`  On-chain data:`);
                console.log(`    amount (raw): ${fields.amount}`);
                console.log(`    amount (SAIL): ${Number(fields.amount) / 1e9}`);
                console.log(`    start: ${fields.start} (${new Date(Number(fields.start) * 1000).toISOString()})`);
                console.log(`    end: ${fields.end}${fields.end !== '0' ? ` (${new Date(Number(fields.end) * 1000).toISOString()})` : ' (no expiry)'}`);
                console.log(`    permanent: ${fields.permanent}`);
                console.log(`    perpetual: ${fields.perpetual}`);

                const lockedSail = Number(fields.amount) / 1e9;
                const pricePerSail = lockedSail > 0 ? priceInSui / lockedSail : 0;
                console.log(`  => Price per locked SAIL: ${pricePerSail.toFixed(4)} SUI`);
            } else {
                console.log(`  On-chain: NFT not found (burned/transferred after sale)`);
            }
        }
        console.log('');
    }

    // Also get current SAIL price for comparison
    console.log('=== CURRENT SAIL SPOT PRICE ===');
    const sailPriceUsd = 0.00204; // From API earlier
    const suiPriceUsd = 1.82;
    const sailPriceInSui = sailPriceUsd / suiPriceUsd;
    console.log(`SAIL: $${sailPriceUsd} = ${sailPriceInSui.toFixed(6)} SUI`);
    console.log(`Compare: If veSAIL trades at ${sailPriceInSui.toFixed(6)} SUI per locked SAIL, it's at parity with spot`);
}

main().catch(console.error);
