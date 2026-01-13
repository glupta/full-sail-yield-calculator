/**
 * VeSailMarketPanel - veSAIL secondary market analytics
 * Inspired by Vexy.fi design patterns
 */
import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Activity, ShoppingCart, ExternalLink, RefreshCw } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function VeSailMarketPanel() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/vesail');
            if (!response.ok) throw new Error('Failed to fetch');
            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                <RefreshCw size={32} className="spin" style={{ opacity: 0.5 }} />
                <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)' }}>
                    Loading veSAIL market data...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                <p style={{ color: 'var(--color-error)' }}>Error: {error}</p>
                <button onClick={fetchData} className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { stats, recentSales, listings } = data;

    // Prepare scatter chart data
    const chartData = listings.map(l => ({
        lockedSail: l.lockedSail,
        discount: l.discountPct,
        priceSui: l.priceSui,
        lockType: l.lockType,
    }));

    return (
        <div className="vesail-market">
            {/* Market KPIs */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>veSAIL Secondary Market</h2>
                    <button
                        onClick={fetchData}
                        className="btn btn-ghost"
                        style={{ padding: 'var(--space-xs)' }}
                        title="Refresh data"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div className="stats-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 'var(--space-md)'
                }}>
                    <StatCard
                        label="Total Sales"
                        value={stats.totalSales}
                        icon={<Activity size={18} />}
                    />
                    <StatCard
                        label="Volume"
                        value={`${stats.totalVolumeSui.toFixed(0)} SUI`}
                        icon={<ShoppingCart size={18} />}
                    />
                    <StatCard
                        label="Best Trade"
                        value={`${stats.bestDiscountPct > 0 ? '-' : '+'}${Math.abs(stats.bestDiscountPct).toFixed(0)}%`}
                        sublabel={stats.bestDiscountPct > 0 ? 'discount' : 'premium'}
                        icon={stats.bestDiscountPct > 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                        positive={stats.bestDiscountPct > 0}
                    />
                    <StatCard
                        label="SAIL Spot"
                        value={`${(stats.sailSpotPriceSui * 1000).toFixed(2)}m SUI`}
                        sublabel="per 1 SAIL"
                        icon={null}
                    />
                </div>
            </div>

            {/* Main content grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                gap: 'var(--space-lg)'
            }}>
                {/* Listings Table */}
                <div className="card">
                    <h3 style={{ marginTop: 0, marginBottom: 'var(--space-md)', fontSize: '1rem' }}>
                        Current Listings
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontWeight: 'normal',
                            marginLeft: 'var(--space-sm)'
                        }}>
                            Sorted by best deal
                        </span>
                    </h3>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%', fontSize: '0.875rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>#</th>
                                    <th style={{ textAlign: 'right' }}>Price</th>
                                    <th style={{ textAlign: 'right' }}>SAIL</th>
                                    <th style={{ textAlign: 'right' }}>vs Spot</th>
                                    <th>Lock</th>
                                    <th style={{ width: '60px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {listings.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                                            No active listings
                                        </td>
                                    </tr>
                                ) : (
                                    listings.slice(0, 10).map((listing, i) => (
                                        <tr key={listing.tokenId}>
                                            <td style={{ color: 'var(--text-muted)' }}>#{i + 1}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {listing.priceSui.toFixed(2)} SUI
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {listing.lockedSail.toLocaleString()}
                                            </td>
                                            <td style={{
                                                textAlign: 'right',
                                                fontFamily: 'var(--font-mono)',
                                                color: listing.discountPct > 0 ? 'var(--color-success)' : 'var(--color-warning)'
                                            }}>
                                                {listing.discountPct > 0 ? '-' : '+'}
                                                {Math.abs(listing.discountPct).toFixed(0)}%
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: listing.lockType === 'PERM' ? 'var(--color-primary-muted)' : 'var(--surface-elevated)',
                                                    color: listing.lockType === 'PERM' ? 'var(--color-primary)' : 'var(--text-secondary)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {listing.lockType}
                                                </span>
                                            </td>
                                            <td>
                                                <a
                                                    href={listing.tradeportUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost"
                                                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                >
                                                    Buy <ExternalLink size={12} />
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right column: Chart + Sales History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Scatter Chart */}
                    <div className="card">
                        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-md)', fontSize: '1rem' }}>
                            Discount vs Size
                        </h3>
                        <div style={{ height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                                    <XAxis
                                        dataKey="lockedSail"
                                        type="number"
                                        scale="log"
                                        domain={['auto', 'auto']}
                                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                                        label={{ value: 'Locked SAIL', position: 'bottom', fontSize: 10, fill: 'var(--text-muted)' }}
                                    />
                                    <YAxis
                                        dataKey="discount"
                                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                        tickFormatter={(v) => `${v > 0 ? '-' : '+'}${Math.abs(v).toFixed(0)}%`}
                                        width={45}
                                    />
                                    <ReferenceLine y={0} stroke="var(--border-default)" strokeDasharray="3 3" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Scatter
                                        data={chartData}
                                        fill="var(--color-primary)"
                                        fillOpacity={0.7}
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Sales */}
                    <div className="card" style={{ flex: 1 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-md)', fontSize: '1rem' }}>
                            Recent Sales
                        </h3>
                        <div style={{ fontSize: '0.8rem' }}>
                            {recentSales.slice(0, 5).map((sale, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: 'var(--space-xs) 0',
                                        borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none'
                                    }}
                                >
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                                        {sale.priceSui.toFixed(1)} SUI
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                                        {sale.lockedSail.toLocaleString()}
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        color: sale.discountPct > 0 ? 'var(--color-success)' : 'var(--color-warning)'
                                    }}>
                                        {sale.discountPct > 0 ? '-' : '+'}
                                        {Math.abs(sale.discountPct).toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer note */}
            <p style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--space-lg)'
            }}>
                Data from <a href="https://tradeport.xyz" target="_blank" rel="noopener noreferrer">Tradeport</a>.
                Negative % = discount to SAIL spot. Refreshes every 5 minutes.
            </p>
        </div>
    );
}

function StatCard({ label, value, sublabel, icon, positive }) {
    return (
        <div style={{
            background: 'var(--surface-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            textAlign: 'center'
        }}>
            <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)'
            }}>
                {icon}
                {label}
            </div>
            <div style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                fontFamily: 'var(--font-mono)',
                color: positive !== undefined
                    ? (positive ? 'var(--color-success)' : 'var(--color-warning)')
                    : 'var(--text-primary)'
            }}>
                {value}
            </div>
            {sublabel && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {sublabel}
                </div>
            )}
        </div>
    );
}

function CustomTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
        <div style={{
            background: 'var(--surface-glass)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-sm)',
            fontSize: '0.75rem'
        }}>
            <div><strong>{data.lockedSail.toLocaleString()}</strong> SAIL</div>
            <div>{data.priceSui.toFixed(2)} SUI</div>
            <div style={{ color: data.discount > 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {data.discount > 0 ? 'Discount' : 'Premium'}: {Math.abs(data.discount).toFixed(0)}%
            </div>
            <div style={{ color: 'var(--text-muted)' }}>{data.lockType}</div>
        </div>
    );
}
