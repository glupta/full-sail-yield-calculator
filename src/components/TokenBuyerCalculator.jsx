import { useState, useEffect } from 'react';
import { loadInputs, saveInputs } from '../lib/persistence';
import { fetchConfig, fetchSailPrice } from '../lib/sdk';
import { Lock, TrendingUp, Wallet, Calculator, Clock, DollarSign } from 'lucide-react';

const SAIL_DECIMALS = 6;
const EPOCH_DAYS = 7;

// Loading Skeleton
function TokenBuyerSkeleton() {
    return (
        <div className="grid-2 mobile-stack animate-in" style={{ '--grid-left-width': '400px' }}>
            <div className="glass-card">
                <div className="skeleton skeleton-heading" style={{ width: '150px' }}></div>
                <div className="skeleton" style={{ height: '48px', marginTop: 'var(--space-md)' }}></div>
                <div className="flex gap-sm" style={{ marginTop: 'var(--space-lg)' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ flex: 1, height: '44px' }}></div>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-md">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton skeleton-card" style={{ height: '120px' }}></div>
                ))}
            </div>
        </div>
    );
}

export default function TokenBuyerCalculator() {
    const [inputs, setInputs] = useState({
        sailAmount: 10000,
        lockDuration: 4,
        timeline: 30,
    });

    const [protocolData, setProtocolData] = useState({
        votingFeesUsd: null,
        exerciseFeesUsd: null,
        globalVotingPower: null,
        sailPrice: null,
        loading: true,
        error: null,
    });

    // Restore saved state
    useEffect(() => {
        const saved = loadInputs('token_buyer');
        if (saved) setInputs(saved);
    }, []);

    // Persist on change
    useEffect(() => {
        saveInputs('token_buyer', inputs);
    }, [inputs]);

    // Fetch protocol data
    useEffect(() => {
        async function loadProtocolData() {
            try {
                const [config, sailPrice] = await Promise.all([
                    fetchConfig(),
                    fetchSailPrice(),
                ]);

                if (config) {
                    setProtocolData({
                        votingFeesUsd: config.voting_fees_usd || 0,
                        exerciseFeesUsd: config.exercise_fees_usd || 0,
                        globalVotingPower: config.global_voting_power || 0,
                        sailPrice: sailPrice || 0,
                        loading: false,
                        error: null,
                    });
                } else {
                    setProtocolData(prev => ({
                        ...prev,
                        loading: false,
                        error: 'Failed to fetch protocol data',
                    }));
                }
            } catch (e) {
                setProtocolData(prev => ({
                    ...prev,
                    loading: false,
                    error: e.message,
                }));
            }
        }
        loadProtocolData();
    }, []);

    const update = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    // Calculations
    const sailPrice = protocolData.sailPrice || 0;
    const feesToDistribute = (protocolData.votingFeesUsd || 0) + (protocolData.exerciseFeesUsd || 0);
    const globalLockedSail = (protocolData.globalVotingPower || 0) / Math.pow(10, SAIL_DECIMALS);
    const globalLockedUsd = globalLockedSail * sailPrice;

    const votingRewardAPR = globalLockedUsd > 0
        ? (feesToDistribute / globalLockedUsd) * (365 / EPOCH_DAYS)
        : 0;

    const veSailAmount = inputs.sailAmount;
    const votingPower = veSailAmount;
    const sailValue = inputs.sailAmount * sailPrice;
    const projectedRewards = sailValue * votingRewardAPR * inputs.timeline / 365;

    const discountRate = 0.15;
    const remainingYears = inputs.lockDuration;
    const annualReward = sailValue * votingRewardAPR;

    let dcfValue = 0;
    for (let t = 1; t <= remainingYears; t++) {
        dcfValue += annualReward / Math.pow(1 + discountRate, t);
    }

    const votingPowerRatio = veSailAmount / inputs.sailAmount;
    const dailyReward = sailValue * votingRewardAPR / 365;
    const timeToRecoup = dailyReward > 0 ? sailValue / dailyReward : Infinity;

    const formatUsd = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatSailPrice = (val) => `$${val.toFixed(6)}`;
    const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;

    if (protocolData.loading) {
        return (
            <div role="tabpanel" id="panel-sail" aria-labelledby="tab-sail">
                <TokenBuyerSkeleton />
            </div>
        );
    }

    return (
        <div
            role="tabpanel"
            id="panel-sail"
            aria-labelledby="tab-sail"
            className="animate-in"
        >
            {/* Responsive Grid: 2-column on desktop, stacked on mobile */}
            <div
                className="grid-2"
                style={{
                    gridTemplateColumns: 'minmax(300px, 400px) 1fr',
                    gap: 'var(--space-lg)'
                }}
            >
                {/* Configuration Card */}
                <div className="glass-card" style={{ height: 'fit-content' }}>
                    <h3 className="mb-lg flex items-center gap-sm" style={{ fontSize: '1.25rem' }}>
                        <Lock size={20} style={{ color: 'var(--color-primary)' }} />
                        Lock Configuration
                    </h3>

                    {/* SAIL Amount */}
                    <div className="mb-lg">
                        <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                            SAIL Amount
                        </label>
                        <input
                            type="number"
                            value={inputs.sailAmount}
                            onChange={(e) => update('sailAmount', Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                        <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '6px' }}>
                            Value: <span style={{ color: 'var(--text-primary)' }}>{formatUsd(sailValue)}</span> @ {formatSailPrice(sailPrice)}/SAIL
                        </div>
                    </div>

                    {/* Lock Duration */}
                    <div className="mb-lg">
                        <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                            Lock Duration
                        </label>
                        <div className="flex gap-sm">
                            {[1, 2, 4].map(years => (
                                <button
                                    key={years}
                                    className={`btn ${inputs.lockDuration === years ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => update('lockDuration', years)}
                                    style={{ flex: 1 }}
                                >
                                    {years} Year{years > 1 ? 's' : ''}
                                </button>
                            ))}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '8px', opacity: 0.8 }}>
                            4-year lock provides maximum voting power (permanent lock)
                        </div>
                    </div>

                    {/* Timeline */}
                    <div>
                        <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                            Projection Timeline
                        </label>
                        <div className="flex gap-sm">
                            {[30, 60, 90].map(days => (
                                <button
                                    key={days}
                                    className={`btn ${inputs.timeline === days ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => update('timeline', days)}
                                    style={{ flex: 1 }}
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Results Column */}
                <div className="flex flex-col gap-md">
                    {/* Protocol Stats */}
                    <div className="glass-card">
                        <h4 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
                            Protocol Stats
                            <span className="pulse" style={{
                                fontSize: '0.6rem',
                                color: 'var(--color-success)',
                                marginLeft: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    background: 'var(--color-success)',
                                    borderRadius: '50%',
                                    display: 'inline-block'
                                }}></span>
                                LIVE
                            </span>
                        </h4>
                        {protocolData.error ? (
                            <div className="text-warning">{protocolData.error}</div>
                        ) : (
                            <div className="flex flex-col gap-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted">Fees to Distribute (7d)</span>
                                    <span className="text-success" style={{ fontWeight: 600 }}>{formatUsd(feesToDistribute)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted">Global veSAIL Locked</span>
                                    <span>{globalLockedSail.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAIL</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted">Locked Value (USD)</span>
                                    <span>{formatUsd(globalLockedUsd)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted">SAIL Price</span>
                                    <span>{formatUsd(sailPrice)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* veSAIL Position */}
                    <div className="glass-card">
                        <h4 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                            <Wallet size={18} style={{ color: 'var(--color-primary)' }} />
                            veSAIL Position
                        </h4>
                        <div className="flex flex-col gap-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">veSAIL Amount</span>
                                <span>{veSailAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Voting Power</span>
                                <span>{votingPower.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Power Ratio</span>
                                <span>{(votingPowerRatio * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Projected Yields - Hero card */}
                    <div
                        className="glass-card"
                        style={{
                            background: 'linear-gradient(135deg, rgba(0, 160, 255, 0.08) 0%, rgba(10, 22, 40, 0.9) 100%)',
                            border: '1px solid rgba(0, 160, 255, 0.2)'
                        }}
                    >
                        <h4 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                            <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
                            Projected Yields ({inputs.timeline}d)
                        </h4>
                        <div className="flex flex-col gap-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">Voting Reward APR</span>
                                <span className="text-success" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatPercent(votingRewardAPR)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Projected Rewards</span>
                                <span className="text-success" style={{ fontWeight: 600 }}>{formatUsd(projectedRewards)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Period Return</span>
                                <span className="text-primary-color">{sailValue > 0 ? formatPercent(projectedRewards / sailValue) : '0%'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Time to Recoup Principal</span>
                                <span className="text-primary-color">
                                    {timeToRecoup === Infinity ? '∞' :
                                        timeToRecoup < 365 ? `${Math.round(timeToRecoup)} days` :
                                            `${(timeToRecoup / 365).toFixed(1)} years`}
                                </span>
                            </div>
                        </div>
                        <div className="text-muted mt-md" style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                            APR = (Weekly Fees ÷ Locked Value) × 52
                        </div>
                    </div>

                    {/* veSAIL Valuation */}
                    <div className="glass-card">
                        <h4 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                            <Calculator size={18} style={{ color: 'var(--color-primary)' }} />
                            veSAIL Valuation
                        </h4>
                        <div className="flex flex-col gap-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">DCF Value</span>
                                <span style={{ fontWeight: 600 }}>{formatUsd(dcfValue)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Discount Rate</span>
                                <span>{(discountRate * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">vs SAIL Value</span>
                                <span className={dcfValue > sailValue ? 'text-success' : 'text-warning'} style={{ fontWeight: 600 }}>
                                    {sailValue > 0 ? ((dcfValue / sailValue - 1) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>
                        <div className="text-muted mt-md" style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                            DCF = Present value of projected voting rewards over lock period
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
