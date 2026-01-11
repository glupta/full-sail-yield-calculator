import { useState, useEffect } from 'react';
import PoolSelector from './PoolSelector';
import ScenarioPanel from './ScenarioPanel';
import { loadInputs, saveInputs } from '../lib/persistence';

const DEFAULT_SCENARIO = {
    depositAmount: 5000,
    priceRangeLow: null,  // Will be set based on pool's current price
    priceRangeHigh: null, // Will be set based on pool's current price
    timeline: 30,
    osailStrategy: 70,
};

// Round to reasonable significant figures for clean display
function roundToSigFigs(num, sigFigs = 4) {
    if (num === 0) return 0;
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, sigFigs - 1 - magnitude);
    return Math.round(num * scale) / scale;
}

export default function LPCalculator() {
    const [selectedPool, setSelectedPool] = useState(null);
    const [scenarios, setScenarios] = useState([{ ...DEFAULT_SCENARIO }]);

    // Restore saved state
    useEffect(() => {
        const saved = loadInputs('lp_calculator');
        if (saved) {
            if (saved.selectedPool) setSelectedPool(saved.selectedPool);
            if (saved.scenarios?.length) setScenarios(saved.scenarios);
        }
    }, []);

    // Persist on change
    useEffect(() => {
        saveInputs('lp_calculator', { selectedPool, scenarios });
    }, [selectedPool, scenarios]);

    // Handle pool selection - update price ranges to ±25% of current price
    const handlePoolSelect = (pool) => {
        setSelectedPool(pool);

        if (pool?.currentPrice) {
            const currentPrice = pool.currentPrice;
            const lowPrice = roundToSigFigs(currentPrice * 0.75);   // -25%
            const highPrice = roundToSigFigs(currentPrice * 1.25);  // +25%

            // Update all scenarios to use new price range defaults
            setScenarios(prev => prev.map(s => ({
                ...s,
                priceRangeLow: s.priceRangeLow === null ? lowPrice : s.priceRangeLow,
                priceRangeHigh: s.priceRangeHigh === null ? highPrice : s.priceRangeHigh,
            })));
        }
    };

    const updateScenario = (index, updates) => {
        setScenarios(prev => prev.map((s, i) =>
            i === index ? { ...s, ...updates } : s
        ));
    };

    const addScenario = () => {
        if (scenarios.length < 3) {
            // New scenarios get ±25% of current price
            const currentPrice = selectedPool?.currentPrice;
            const newScenario = {
                ...DEFAULT_SCENARIO,
                priceRangeLow: currentPrice ? roundToSigFigs(currentPrice * 0.75) : null,
                priceRangeHigh: currentPrice ? roundToSigFigs(currentPrice * 1.25) : null,
            };
            setScenarios([...scenarios, newScenario]);
        }
    };

    const removeScenario = (index) => {
        if (scenarios.length > 1) {
            setScenarios(scenarios.filter((_, i) => i !== index));
        }
    };

    return (
        <div>
            <div className="grid-2" style={{ gridTemplateColumns: '300px 1fr' }}>
                {/* Left sidebar */}
                <div className="flex flex-col gap-lg">
                    <PoolSelector
                        selectedPool={selectedPool}
                        onSelect={handlePoolSelect}
                    />
                </div>

                {/* Main content - scenarios */}
                <div>
                    <div className="flex justify-between items-center mb-md">
                        <h3>Scenarios</h3>
                        {scenarios.length < 3 && (
                            <button className="btn btn-secondary" onClick={addScenario}>
                                + Add Scenario
                            </button>
                        )}
                    </div>

                    <div className={`grid-${scenarios.length}`}>
                        {scenarios.map((scenario, index) => (
                            <ScenarioPanel
                                key={index}
                                index={index}
                                scenario={scenario}
                                pool={selectedPool}
                                onChange={(updates) => updateScenario(index, updates)}
                                onRemove={scenarios.length > 1 ? () => removeScenario(index) : null}
                                isWinner={false} // TODO: Calculate winner
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
