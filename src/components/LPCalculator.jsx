import { useState, useEffect } from 'react';
import PoolSelector from './PoolSelector';
import ScenarioPanel from './ScenarioPanel';
import { loadInputs, saveInputs } from '../lib/persistence';

const DEFAULT_SCENARIO = {
    depositAmount: 5000,
    priceRangeLow: 0.8,
    priceRangeHigh: 1.5,
    timeline: 30,
    osailStrategy: 70,
};

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

    const updateScenario = (index, updates) => {
        setScenarios(prev => prev.map((s, i) =>
            i === index ? { ...s, ...updates } : s
        ));
    };

    const addScenario = () => {
        if (scenarios.length < 3) {
            setScenarios([...scenarios, { ...DEFAULT_SCENARIO }]);
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
                        onSelect={setSelectedPool}
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
