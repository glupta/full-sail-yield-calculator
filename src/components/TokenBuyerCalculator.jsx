import { useState, useEffect } from 'react';
import { loadInputs, saveInputs } from '../lib/persistence';

export default function TokenBuyerCalculator() {
    const [inputs, setInputs] = useState({
        sailAmount: 10000,
        lockDuration: 4, // years
        timeline: 30, // days
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

    const update = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    // Calculate projections
    const sailPrice = 0.5; // TODO: Fetch from SDK
    const globalVotingAPR = 0.35; // 35% assumed global average

    const veSailAmount = inputs.sailAmount; // 1:1 for max lock
    const votingPower = veSailAmount; // Simplified - max lock gives full power

    const projectedRewards = (inputs.sailAmount * sailPrice * globalVotingAPR * inputs.timeline) / 365;
    const effectiveAPR = globalVotingAPR; // Simplified

    // DCF valuation
    const discountRate = 0.15; // 15% crypto risk premium
    const remainingYears = inputs.lockDuration;
    const annualReward = inputs.sailAmount * sailPrice * globalVotingAPR;

    // PV = Σ (reward / (1 + r)^t)
    let dcfValue = 0;
    for (let t = 1; t <= remainingYears; t++) {
        dcfValue += annualReward / Math.pow(1 + discountRate, t);
    }

    const votingPowerRatio = veSailAmount / inputs.sailAmount;
    const sailValue = inputs.sailAmount * sailPrice;

    const formatUsd = (val) => `$${val.toFixed(2)}`;

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
                        Value: {formatUsd(sailValue)}
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
                            <span className="text-success">{(globalVotingAPR * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Projected Rewards</span>
                            <span className="text-success">{formatUsd(projectedRewards)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Effective APR</span>
                            <span className="text-primary-color">{(effectiveAPR * 100).toFixed(1)}%</span>
                        </div>
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
                                {((dcfValue / sailValue - 1) * 100).toFixed(1)}%
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
