/**
 * BlockVision API Client
 * Used for fetching on-chain SAIL token holder data
 * 
 * API Docs: https://docs.blockvision.org
 * Endpoint: https://api.blockvision.org/v2/sui/coin/holders
 */

const BLOCKVISION_ENDPOINT = 'https://api.blockvision.org/v2/sui';

// SAIL coin type on Sui mainnet
export const SAIL_COIN_TYPE = '0x1d4a2bdbc1602a0adaa98194942c220202dcc56bb0a205838dfaa63db0d5497e::SAIL::SAIL';

export interface SailHolder {
    /** Wallet address of the holder */
    address: string;
    /** Amount of SAIL held (raw, needs decimal conversion) */
    quantity: string;
    /** Percentage of total supply held */
    percentage: number;
}

export interface SailHoldersResponse {
    holders: SailHolder[];
    total: number;
    nextCursor?: string;
}

interface BlockVisionResponse {
    code: number;
    message: string;
    result?: {
        data: Array<{
            address: string;
            quantity: string;
            percentage: number;
        }>;
        nextPageCursor?: string;
        total?: number;
    };
}

/**
 * Get API key from environment
 * BlockVision requires Pro membership for Coin Holders API
 */
function getApiKey(): string {
    const apiKey = process.env.BLOCKVISION_API_KEY;
    if (!apiKey) {
        throw new Error('BLOCKVISION_API_KEY environment variable is required');
    }
    return apiKey;
}

/**
 * Fetch SAIL token holders from BlockVision
 * @param limit - Max number of holders to fetch (max 50)
 * @param cursor - Pagination cursor for next page
 */
export async function fetchSailHolders(
    limit: number = 20,
    cursor?: string
): Promise<SailHoldersResponse> {
    const apiKey = getApiKey();

    const params = new URLSearchParams({
        coinType: SAIL_COIN_TYPE,
        limit: Math.min(limit, 50).toString(),
    });

    if (cursor) {
        params.append('cursor', cursor);
    }

    const response = await fetch(
        `${BLOCKVISION_ENDPOINT}/coin/holders?${params.toString()}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`BlockVision API error: ${response.status} ${response.statusText}`);
    }

    const data: BlockVisionResponse = await response.json();

    if (data.code !== 0 || !data.result) {
        throw new Error(`BlockVision API error: ${data.message}`);
    }

    return {
        holders: data.result.data.map(h => ({
            address: h.address,
            quantity: h.quantity,
            percentage: h.percentage,
        })),
        total: data.result.total ?? 0,
        nextCursor: data.result.nextPageCursor,
    };
}

/**
 * Fetch all SAIL holders (paginated, use with caution for large holder counts)
 * @param maxHolders - Maximum number of holders to fetch
 */
export async function fetchAllSailHolders(maxHolders: number = 1000): Promise<SailHolder[]> {
    const allHolders: SailHolder[] = [];
    let cursor: string | undefined;

    while (allHolders.length < maxHolders) {
        const response = await fetchSailHolders(50, cursor);
        allHolders.push(...response.holders);

        if (!response.nextCursor || response.holders.length === 0) {
            break;
        }

        cursor = response.nextCursor;
    }

    return allHolders.slice(0, maxHolders);
}

// SAIL has 6 decimals
export const SAIL_DECIMALS = 6;

/**
 * Convert raw SAIL quantity to human-readable format
 */
export function formatSailQuantity(rawQuantity: string): number {
    return Number(rawQuantity) / Math.pow(10, SAIL_DECIMALS);
}

/**
 * Format holder percentage for display
 */
export function formatPercentage(percentage: number): string {
    if (percentage >= 1) {
        return `${percentage.toFixed(2)}%`;
    } else if (percentage >= 0.01) {
        return `${percentage.toFixed(3)}%`;
    } else {
        return `${percentage.toFixed(4)}%`;
    }
}
