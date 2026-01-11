import { useState, useEffect } from 'react';
import { loadInputs, saveInputs } from '../lib/persistence';
import { fetchConfig, fetchSailPrice } from '../lib/sdk';

const SAIL_DECIMALS = 6;
const EPOCH_DAYS = 7;

export default function TokenBuyerCalculator() {
    const [inputs, setInputs] = useState({
        sailAmount: 10000,
        lockDuration: 4, // years
        timeline: 30, // days
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

    // Fetch protocol data on mount
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

    // Calculate yields from real protocol data
    const sailPrice = protocolData.sailPrice || 0;
    const feesToDistribute = (protocolData.votingFeesUsd || 0) + (protocolData.exerciseFeesUsd || 0);

    // Global veSAIL locked (convert from raw to human-readable)
    const globalLockedSail = (protocolData.globalVotingPower || 0) / Math.pow(10, SAIL_DECIMALS);
    const globalLockedUsd = globalLockedSail * sailPrice;

    // Calculate voting reward APR: (weekly_fees / locked_value) * (365/7)
    const votingRewardAPR = globalLockedUsd > 0
        ? (feesToDistribute / globalLockedUsd) * (365 / EPOCH_DAYS)
        : 0;

    // User's veSAIL position calculations
    const veSailAmount = inputs.sailAmount; // 1:1 for max lock
    const votingPower = veSailAmount;
    const sailValue = inputs.sailAmount * sailPrice;

    // User's projected rewards over timeline
    const projectedRewards = sailValue * votingRewardAPR * inputs.timeline / 365;

    // DCF valuation
    const discountRate = 0.15; // 15% crypto risk premium
    const remainingYears = inputs.lockDuration;
    const annualReward = sailValue * votingRewardAPR;

    // PV = Σ (reward / (1 + r)^t)
    let dcfValue = 0;
    for (let t = 1; t <= remainingYears; t++) {
        dcfValue += annualReward / Math.pow(1 + discountRate, t);
    }

    const votingPowerRatio = veSailAmount / inputs.sailAmount;

    const formatUsd = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;

    return (
        <div className="grid-2" style={{ gridTemplateColumns: '400px 1fr' }}>
            {/* Configuration */}
            <div className="glass-card">
                <h3 className="mb-lg">Lock Configuration</h3>

                {/* SAIL Amount */}
                <div className="mb-md">
                    <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                        SAIL Amount
                    </label>
                    <input
                        type="number"
                        value={inputs.sailAmount}
                        onChange={(e) => update('sailAmount', Number(e.target.value))}
                        style={{ width: '100%' }}
                    />
                    <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        Value: {formatUsd(sailValue)} @ {formatUsd(sailPrice)}/SAIL
                    </div>
                </div>

                {/* Lock Duration */}
                <div className="mb-md">
                    <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
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
                    <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                        4-year lock provides maximum voting power (permanent lock)
                    </div>
                </div>

                {/* Timeline */}
                <div className="mb-md">
                    <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
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

            {/* Results */}
            <div className="flex flex-col gap-lg">
                {/* Protocol Stats */}
                <div className="glass-card">
                    <h4 className="mb-md">Protocol Stats (Live)</h4>
                    {protocolData.loading ? (
                        <div className="text-muted">Loading protocol data...</div>
                    ) : protocolData.error ? (
                        <div className="text-warning">{protocolData.error}</div>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">Fees to Distribute (7d)</span>
                                <span className="text-success">{formatUsd(feesToDistribute)}</span>
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

                {/* veSAIL Stats */}
                <div className="glass-card">
                    <h4 className="mb-md">veSAIL Position</h4>
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

                {/* Projected Yields */}
                <div className="glass-card">
                    <h4 className="mb-md">Projected Yields ({inputs.timeline}d)</h4>
                    <div className="flex flex-col gap-sm">
                        <div className="flex justify-between">
                            <span className="text-muted">Voting Reward APR</span>
                            <span className="text-success">{formatPercent(votingRewardAPR)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Projected Rewards</span>
                            <span className="text-success">{formatUsd(projectedRewards)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Period Return</span>
                            <span className="text-primary-color">{sailValue > 0 ? formatPercent(projectedRewards / sailValue) : '0%'}</span>
                        </div>
                    </div>
                    <div className="text-muted mt-md" style={{ fontSize: '0.75rem' }}>
                        APR = (Weekly Fees ÷ Locked Value) × 52
                    </div>
                </div>

                {/* veSAIL Valuation */}
                <div className="glass-card">
                    <h4 className="mb-md">veSAIL Valuation</h4>
                    <div className="flex flex-col gap-sm">
                        <div className="flex justify-between">
                            <span className="text-muted">DCF Value</span>
                            <span>{formatUsd(dcfValue)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Discount Rate</span>
                            <span>{(discountRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">vs SAIL Value</span>
                            <span className={dcfValue > sailValue ? 'text-success' : 'text-warning'}>
                                {sailValue > 0 ? ((dcfValue / sailValue - 1) * 100).toFixed(1) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="text-muted mt-md" style={{ fontSize: '0.75rem' }}>
                        DCF = Present value of projected voting rewards over lock period
                    </div>
                </div>
            </div>
        </div>
    );
}

