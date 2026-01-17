'use client';

/**
 * VeSailMarketPanel - veSAIL secondary market analytics
 * Inspired by Vexy.fi design patterns
 */
import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Activity, ShoppingCart, ExternalLink, RefreshCw, HelpCircle, Clock } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

export default function VeSailMarketPanel() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sailPriceUsd, setSailPriceUsd] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [vesailRes, priceRes] = await Promise.all([
                fetch('/api/vesail'),
                fetch('/api/sail-price')
            ]);
            if (!vesailRes.ok) throw new Error('Failed to fetch');
            const result = await vesailRes.json();
            setData(result);
            if (priceRes.ok) {
                const priceData = await priceRes.json();
                setSailPriceUsd(priceData.price);
            }
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

    // Prepare scatter chart data - listings (blue) and sales (green)
    const listingsChartData = listings.map(l => ({
        lockedSail: l.lockedSail,
        discount: l.discountPct,
        priceSui: l.priceSui,
        lockType: l.lockType,
        type: 'listing'
    }));

    const salesChartData = recentSales.map(s => ({
        lockedSail: s.lockedSail,
        discount: s.discountPct,
        priceSui: s.priceSui,
        lockType: s.lockType,
        type: 'sale'
    }));

    return (
        <div className="vesail-market" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Header with Hero Stats */}
            <div className="glass-card">
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>veSAIL Secondary Market</h2>
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
                        value={sailPriceUsd && stats.veSailPriceInSail
                            ? `$${(sailPriceUsd * stats.veSailPriceInSail).toFixed(6)}`
                            : 'N/A'}
                        sublabel={stats.veSailPriceInSail < 1
                            ? `${(100 - stats.veSailPriceInSail * 100).toFixed(0)}% discount`
                            : `${((stats.veSailPriceInSail - 1) * 100).toFixed(0)}% premium`}
                        icon={null}
                        positive={stats.veSailPriceInSail < 1}
                        tooltip="Weighted average veSAIL price based on recent trades"
                    />
                    <StatCard
                        label="Best Available"
                        value={stats.bestListingDiscountPct != null
                            ? `${stats.bestListingDiscountPct > 0 ? '-' : '+'}${Math.abs(stats.bestListingDiscountPct).toFixed(0)}%`
                            : 'N/A'}
                        sublabel={stats.bestListingPriceSui ? `${stats.bestListingPriceSui.toFixed(1)} SUI` : 'No listings'}
                        icon={<ShoppingCart size={18} />}
                        positive={stats.bestListingDiscountPct > 0}
                        highlight={true}
                        tooltip="Best current listing: lowest price per SAIL locked. Click listings below to buy."
                    />
                    <StatCard
                        label="Best Trade"
                        value={`${stats.bestDiscountPct > 0 ? '-' : '+'}${Math.abs(stats.bestDiscountPct).toFixed(0)}%`}
                        sublabel={stats.bestDiscountPct > 0 ? 'discount' : 'premium'}
                        icon={stats.bestDiscountPct > 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                        positive={stats.bestDiscountPct > 0}
                        tooltip="Best historical discount or premium seen vs SAIL spot price"
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
            <div className="vesail-content-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-lg)',
            }}>
                {/* Current Listings */}
                <div className="glass-card">
                    <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem', margin: 0 }}>
                        <ShoppingCart size={18} style={{ color: 'var(--color-primary)' }} />
                        Current Listings
                    </h3>
                    {/* Column Headers with tooltips */}
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
                        <span style={{ minWidth: '60px' }}>
                            Price
                            <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                <HelpCircle size={8} className="tooltip-icon" />
                                <span className="tooltip-text">Price in SUI to purchase this veSAIL position</span>
                            </span>
                        </span>
                        <span style={{ minWidth: '50px', textAlign: 'right' }}>
                            SAIL
                            <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                <HelpCircle size={8} className="tooltip-icon" />
                                <span className="tooltip-text">Amount of SAIL locked in this veSAIL position</span>
                            </span>
                        </span>
                        <span style={{ minWidth: '45px', textAlign: 'right' }}>
                            vs Spot
                            <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                <HelpCircle size={8} className="tooltip-icon" />
                                <span className="tooltip-text">Discount (-) or premium (+) compared to SAIL spot price</span>
                            </span>
                        </span>
                        <span style={{ minWidth: '45px', textAlign: 'right' }}>
                            Lock
                            <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                <HelpCircle size={8} className="tooltip-icon" />
                                <span className="tooltip-text">PERM = permanent lock, or remaining lock duration</span>
                            </span>
                        </span>
                        <span style={{ minWidth: '40px' }}></span>
                    </div>
                    {/* Listings rows */}
                    <div style={{ fontSize: '0.8rem' }}>
                        {listings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                                No active listings
                            </div>
                        ) : (
                            listings.slice(0, 8).map((listing, i) => (
                                <div
                                    key={listing.tokenId}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-xs) 0',
                                        borderBottom: i < 7 ? '1px solid var(--border-subtle)' : 'none'
                                    }}
                                >
                                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: '60px' }}>
                                        {listing.priceSui.toFixed(1)} SUI
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: '50px', textAlign: 'right' }}>
                                        {listing.lockedSail >= 1000 ? `${(listing.lockedSail / 1000).toFixed(1)}K` : listing.lockedSail.toFixed(0)}
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        color: listing.discountPct > 0 ? 'var(--color-success)' : 'var(--color-warning)',
                                        minWidth: '45px',
                                        textAlign: 'right'
                                    }}>
                                        {listing.discountPct > 0 ? '-' : '+'}
                                        {Math.abs(listing.discountPct).toFixed(0)}%
                                    </span>
                                    <span style={{
                                        background: listing.lockType === 'PERM' ? 'var(--color-primary-muted)' : 'var(--surface-elevated)',
                                        color: listing.lockType === 'PERM' ? 'var(--color-primary)' : 'var(--text-secondary)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                        minWidth: '45px',
                                        textAlign: 'center'
                                    }}>
                                        {listing.lockType}
                                    </span>
                                    <a
                                        href={listing.tradeportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-ghost"
                                        style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: '40px' }}
                                    >
                                        Buy <ExternalLink size={8} />
                                    </a>
                                </div>
                            ))
                        )}
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
                            <span style={{ minWidth: '55px' }}>
                                Date
                                <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                    <HelpCircle size={8} className="tooltip-icon" />
                                    <span className="tooltip-text">Date this veSAIL NFT was sold</span>
                                </span>
                            </span>
                            <span style={{ minWidth: '55px', textAlign: 'right' }}>
                                Price
                                <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                    <HelpCircle size={8} className="tooltip-icon" />
                                    <span className="tooltip-text">Sale price in SUI</span>
                                </span>
                            </span>
                            <span style={{ minWidth: '45px', textAlign: 'right' }}>
                                SAIL
                                <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                    <HelpCircle size={8} className="tooltip-icon" />
                                    <span className="tooltip-text">Amount of SAIL locked in the sold position</span>
                                </span>
                            </span>
                            <span style={{ minWidth: '40px', textAlign: 'right' }}>
                                vs Spot
                                <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                    <HelpCircle size={8} className="tooltip-icon" />
                                    <span className="tooltip-text">Discount (-) or premium (+) vs SAIL spot at time of sale</span>
                                </span>
                            </span>
                            <span style={{ minWidth: '45px', textAlign: 'right' }}>
                                Lock
                                <span className="tooltip-wrapper" style={{ marginLeft: '2px' }}>
                                    <HelpCircle size={8} className="tooltip-icon" />
                                    <span className="tooltip-text">PERM = permanent lock, or remaining lock duration</span>
                                </span>
                            </span>
                        </div>
                        <div style={{ fontSize: '0.8rem' }}>
                            {recentSales.slice(0, 8).map((sale, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-xs) 0',
                                        borderBottom: i < 7 ? '1px solid var(--border-subtle)' : 'none',
                                        opacity: sale.lockType === 'UNAVAILABLE' ? 0.5 : 1
                                    }}
                                >
                                    <span style={{ color: 'var(--text-muted)', minWidth: '55px' }}>
                                        {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: '55px', textAlign: 'right' }}>
                                        {sale.priceSui.toFixed(1)} SUI
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', minWidth: '45px', textAlign: 'right' }}>
                                        {sale.lockType === 'UNAVAILABLE'
                                            ? '—'
                                            : (sale.lockedSail >= 1000 ? `${(sale.lockedSail / 1000).toFixed(1)}K` : sale.lockedSail.toFixed(0))}
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        color: sale.lockType === 'UNAVAILABLE'
                                            ? 'var(--text-muted)'
                                            : (sale.discountPct > 0 ? 'var(--color-success)' : 'var(--color-warning)'),
                                        minWidth: '40px',
                                        textAlign: 'right'
                                    }}>
                                        {sale.lockType === 'UNAVAILABLE'
                                            ? '—'
                                            : `${sale.discountPct > 0 ? '-' : '+'}${Math.abs(sale.discountPct).toFixed(0)}%`}
                                    </span>
                                    <span style={{
                                        background: sale.lockType === 'UNAVAILABLE'
                                            ? 'var(--color-error-muted, rgba(255,50,50,0.15))'
                                            : (sale.lockType === 'PERM' ? 'var(--color-primary-muted)' : 'var(--surface-elevated)'),
                                        color: sale.lockType === 'UNAVAILABLE'
                                            ? 'var(--color-error, #ff6b6b)'
                                            : (sale.lockType === 'PERM' ? 'var(--color-primary)' : 'var(--text-secondary)'),
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                        minWidth: '45px',
                                        textAlign: 'center'
                                    }}>
                                        {sale.lockType === 'UNAVAILABLE' ? 'N/A' : sale.lockType}
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
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                margin: 0
            }}>
                Data from <a href="https://tradeport.xyz" target="_blank" rel="noopener noreferrer">Tradeport</a>.
                Negative % = discount to SAIL spot.
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
