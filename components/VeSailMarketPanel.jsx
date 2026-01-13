'use client';

/**
 * VeSailMarketPanel - veSAIL secondary market analytics
 * Inspired by Vexy.fi design patterns
 */
import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Activity, ShoppingCart, ExternalLink, RefreshCw, HelpCircle } from 'lucide-react';
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
        <div className="vesail-market" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Header with Hero Stats */}
            <div className="glass-card">
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>veSAIL Secondary Market</h2>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Buy veSAIL positions at a discount on Tradeport
                        </p>
                    </div>
                    <div className="flex items-center gap-sm">
                        <span style={{
                            fontSize: '0.65rem',
                            color: 'var(--color-success)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                background: 'var(--color-success)',
                                borderRadius: '50%',
                            }}></span>
                            LIVE
                        </span>
                        <button
                            onClick={fetchData}
                            className="btn btn-ghost"
                            style={{ padding: 'var(--space-xs)' }}
                            title="Refresh data"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Hero Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 'var(--space-md)',
                }}>
                    <StatCard
                        label="veSAIL Price"
                        value={`${stats.veSailPriceInSail?.toFixed(2) || 'N/A'} SAIL`}
                        sublabel={stats.veSailPriceInSail < 1 ? `${(100 - stats.veSailPriceInSail * 100).toFixed(0)}% discount` : `${((stats.veSailPriceInSail - 1) * 100).toFixed(0)}% premium`}
                        icon={null}
                        positive={stats.veSailPriceInSail < 1}
                        highlight={true}
                        tooltip="Weighted average veSAIL price in SAIL terms based on recent trades"
                    />
                    <StatCard
                        label="Best Trade"
                        value={`${stats.bestDiscountPct > 0 ? '-' : '+'}${Math.abs(stats.bestDiscountPct).toFixed(0)}%`}
                        sublabel={stats.bestDiscountPct > 0 ? 'discount' : 'premium'}
                        icon={stats.bestDiscountPct > 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                        positive={stats.bestDiscountPct > 0}
                        tooltip="Best discount or premium seen vs SAIL spot price"
                    />
                    <StatCard
                        label="Total Sales"
                        value={stats.totalSales}
                        icon={<Activity size={18} />}
                        tooltip="Number of veSAIL NFTs traded on secondary market"
                    />
                    <StatCard
                        label="Volume"
                        value={`${stats.totalVolumeSui.toFixed(0)} SUI`}
                        icon={<ShoppingCart size={18} />}
                        tooltip="Total SUI volume traded on secondary market"
                    />
                </div>
            </div>

            {/* Main content grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-lg)',
            }}>
                {/* Listings Table */}
                <div className="glass-card">
                    <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem', margin: 0 }}>
                        <ShoppingCart size={18} style={{ color: 'var(--color-primary)' }} />
                        Current Listings
                        <span style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            fontWeight: 'normal',
                        }}>
                            Sorted by best deal
                        </span>
                    </h3>

                    <div style={{ overflowX: 'auto', marginTop: 'var(--space-md)' }}>
                        <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th style={{ textAlign: 'right' }}>Price</th>
                                    <th style={{ textAlign: 'right' }}>Locked SAIL</th>
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
                                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {listing.priceSui.toFixed(2)} SUI
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {listing.lockedSail >= 1000 ? `${(listing.lockedSail / 1000).toFixed(1)}K` : listing.lockedSail.toFixed(0)}
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
                                                <span style={{
                                                    background: listing.lockType === 'PERM' ? 'var(--color-primary-muted)' : 'var(--surface-elevated)',
                                                    color: listing.lockType === 'PERM' ? 'var(--color-primary)' : 'var(--text-secondary)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem'
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
                                                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                                >
                                                    Buy <ExternalLink size={10} />
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right column: Sales History + Chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Recent Sales */}
                    <div className="glass-card">
                        <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem', margin: 0 }}>
                            <Activity size={18} style={{ color: 'var(--color-primary)' }} />
                            Recent Sales
                        </h3>
                        {/* Column Headers */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.65rem',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginTop: 'var(--space-sm)',
                            paddingBottom: 'var(--space-xs)',
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <span style={{ minWidth: '60px' }}>Date</span>
                            <span style={{ minWidth: '60px', textAlign: 'right' }}>Price</span>
                            <span style={{ minWidth: '50px', textAlign: 'right' }}>SAIL</span>
                            <span style={{ minWidth: '45px', textAlign: 'right' }}>vs Spot</span>
                        </div>
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
                                    <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>
                                        {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: '60px', textAlign: 'right' }}>
                                        {sale.priceSui.toFixed(1)} SUI
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: '50px', textAlign: 'right' }}>
                                        {sale.lockedSail >= 1000 ? `${(sale.lockedSail / 1000).toFixed(1)}K` : sale.lockedSail.toFixed(0)}
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        color: sale.discountPct > 0 ? 'var(--color-success)' : 'var(--color-warning)',
                                        minWidth: '45px',
                                        textAlign: 'right'
                                    }}>
                                        {sale.discountPct > 0 ? '-' : '+'}
                                        {Math.abs(sale.discountPct).toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scatter Chart */}
                    <div className="glass-card" style={{ flex: 1 }}>
                        <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem', margin: 0 }}>
                            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
                            Discount vs Size
                        </h3>
                        <div style={{ height: '180px', marginTop: 'var(--space-sm)' }}>
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
                                        width={40}
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

function StatCard({ label, value, sublabel, icon, positive, tooltip, highlight }) {
    return (
        <div style={{
            background: highlight
                ? 'linear-gradient(135deg, rgba(0, 160, 255, 0.1) 0%, rgba(10, 22, 40, 0.8) 100%)'
                : 'var(--surface-elevated)',
            border: highlight ? '1px solid rgba(0, 160, 255, 0.25)' : 'none',
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
                {tooltip && (
                    <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                        <HelpCircle size={10} className="tooltip-icon" />
                        <span className="tooltip-text">{tooltip}</span>
                    </span>
                )}
            </div>
            <div style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                fontFamily: 'var(--font-mono)',
                color: positive !== undefined
                    ? (positive ? 'var(--color-success)' : 'var(--color-warning)')
                    : (highlight ? 'var(--color-success)' : 'var(--text-primary)')
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
