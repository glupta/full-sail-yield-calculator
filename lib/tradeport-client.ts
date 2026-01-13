/**
 * Tradeport GraphQL API Client
 * Used for fetching veSAIL NFT trading data
 */

const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';

// veSAIL collection ID on Tradeport
const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';
const VESAIL_COLLECTION_SLUG = '0xe616397e503278d406e184d2258bcbe7a263d0192cc0848de2b54b518165f832::voting_escrow::Lock';

export interface VeSailTrade {
    id: string;
    type: string;
    /** Price in MIST (1 SUI = 1,000,000,000 MIST) */
    price: number;
    nftId: string;
    blockTime: string;
}

export interface VeSailListing {
    id: string;
    /** Price in MIST (1 SUI = 1,000,000,000 MIST), null if unlisted */
    price: number | null;
    nftId: string;
}

export interface VeSailNft {
    id: string;
    name: string;
    tokenId: string;
}

interface GraphQLResponse<T> {
    data?: { sui: T };
    errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query against Tradeport
 */
async function executeQuery<T>(query: string): Promise<T> {
    const response = await fetch(TRADEPORT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-user': API_USER,
            'x-api-key': API_KEY,
        },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        throw new Error(`Tradeport API error: ${response.status}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    if (!result.data) {
        throw new Error('No data returned from Tradeport');
    }

    return result.data.sui;
}

/**
 * Fetch recent veSAIL trades (buy actions)
 */
export async function fetchVeSailTrades(limit: number = 25): Promise<VeSailTrade[]> {
    const query = `{ sui {
    actions(
      where: { 
        collection_id: { _eq: "${VESAIL_COLLECTION_ID}" },
        type: { _eq: "buy" }
      },
      limit: ${limit}
    ) {
      id
      type
      price
      nft_id
      block_time
    }
  } }`;

    const result = await executeQuery<{
        actions: Array<{
            id: string;
            type: string;
            price: number;
            nft_id: string;
            block_time: string;
        }>
    }>(query);

    return result.actions.map(action => ({
        id: action.id,
        type: action.type,
        price: action.price,
        nftId: action.nft_id,
        blockTime: action.block_time,
    }));
}

/**
 * Fetch current veSAIL listings
 */
export async function fetchVeSailListings(limit: number = 25): Promise<VeSailListing[]> {
    const query = `{ sui {
    listings(
      where: { 
        collection_id: { _eq: "${VESAIL_COLLECTION_ID}" }
      },
      limit: ${limit}
    ) {
      id
      price
      nft_id
    }
  } }`;

    const result = await executeQuery<{
        listings: Array<{
            id: string;
            price: number | null;
            nft_id: string;
        }>
    }>(query);

    return result.listings.map(listing => ({
        id: listing.id,
        price: listing.price,
        nftId: listing.nft_id,
    }));
}

/**
 * Fetch veSAIL NFT details by internal ID
 */
export async function fetchVeSailNft(nftId: string): Promise<VeSailNft | null> {
    const query = `{ sui {
    nfts(where: { id: { _eq: "${nftId}" } }) {
      id
      name
      token_id
    }
  } }`;

    const result = await executeQuery<{
        nfts: Array<{
            id: string;
            name: string;
            token_id: string;
        }>
    }>(query);

    if (result.nfts.length === 0) {
        return null;
    }

    const nft = result.nfts[0];
    return {
        id: nft.id,
        name: nft.name,
        tokenId: nft.token_id,
    };
}

/**
 * Fetch multiple veSAIL NFTs by their internal IDs
 */
export async function fetchVeSailNfts(nftIds: string[]): Promise<VeSailNft[]> {
    if (nftIds.length === 0) return [];

    const idsJson = JSON.stringify(nftIds);
    const query = `{ sui {
    nfts(where: { id: { _in: ${idsJson} } }) {
      id
      name
      token_id
    }
  } }`;

    const result = await executeQuery<{
        nfts: Array<{
            id: string;
            name: string;
            token_id: string;
        }>
    }>(query);

    return result.nfts.map(nft => ({
        id: nft.id,
        name: nft.name,
        tokenId: nft.token_id,
    }));
}

// Constants for conversions
export const MIST_PER_SUI = 1_000_000_000;

/**
 * Convert MIST to SUI
 */
export function mistToSui(mist: number): number {
    return mist / MIST_PER_SUI;
}
