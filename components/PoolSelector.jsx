'use client';

import { useState, useEffect } from 'react';
import { fetchPools } from '@/lib/api-client';

export default function PoolSelector({ selectedPool, onSelect }) {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('tvl');

    useEffect(() => {
        loadPools();
    }, []);

    async function loadPools() {
        setLoading(true);
        setError(null);

        const fetchedPools = await fetchPools();

        if (fetchedPools.length === 0) {
            setError('Failed to load pools');
        } else {
            setPools(fetchedPools);
            // Auto-select first pool if none selected
            if (!selectedPool && fetchedPools.length > 0) {
                onSelect(fetchedPools[0]);
            }
        }

        setLoading(false);
    }

    const sortedPools = [...pools].sort((a, b) => {
        if (filter === 'tvl') return (b.dinamic_stats?.tvl || 0) - (a.dinamic_stats?.tvl || 0);
        if (filter === 'apr') return (b.full_apr || 0) - (a.full_apr || 0);
        return 0;
    });

    const formatTVL = (tvl) => {
        if (!tvl) return '$0';
        if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
        if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
        return `$${tvl.toFixed(0)}`;
    };

    return (
        <div className="glass-card">
            <h4 className="mb-md">Pool Selection</h4>

            {loading ? (
                <div className="text-muted">Loading pools...</div>
            ) : error ? (
                <div className="text-error">{error}</div>
            ) : (
                <>
                    <select
                        value={selectedPool?.id || ''}
                        onChange={(e) => {
                            const pool = pools.find(p => p.id === e.target.value);
                            onSelect(pool);
                        }}
                        style={{ width: '100%', marginBottom: 'var(--space-md)' }}
                    >
                        {sortedPools.map(pool => (
                            <option key={pool.id} value={pool.id}>
                                {pool.token0_symbol}/{pool.token1_symbol} (
                                {filter === 'apr'
                                    ? `${pool.full_apr?.toFixed(1) || 0}%`
                                    : formatTVL(pool.dinamic_stats?.tvl)})
                            </option>
                        ))}
                    </select>

                    <div className="flex gap-sm mb-md">
                        <button
                            className={`btn ${filter === 'tvl' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('tvl')}
                            style={{ flex: 1, padding: 'var(--space-xs) var(--space-sm)' }}
                        >
                            By TVL
                        </button>
                        <button
                            className={`btn ${filter === 'apr' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('apr')}
                            style={{ flex: 1, padding: 'var(--space-xs) var(--space-sm)' }}
                        >
                            By APR
                        </button>
                    </div>
                </>
            )}

            {/* Pool Stats Card */}
            {selectedPool && (
                <div className="mt-md">
                    <h4 className="mb-sm">Pool Stats</h4>
                    <div className="flex flex-col gap-sm">
                        <div className="flex justify-between">
                            <span className="text-muted">TVL</span>
                            <span>{formatTVL(selectedPool.dinamic_stats?.tvl)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">APR</span>
                            <span className="text-success">
                                {selectedPool.full_apr ? `${selectedPool.full_apr.toFixed(1)}%` : 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Fee Tier</span>
                            <span>{selectedPool.fee_tier ? `${selectedPool.fee_tier * 100}%` : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
