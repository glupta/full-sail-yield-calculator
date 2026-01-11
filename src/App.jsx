import { useState, useEffect } from 'react';
import PersonaToggle from './components/PersonaToggle';
import LPCalculator from './components/LPCalculator';
import TokenBuyerCalculator from './components/TokenBuyerCalculator';
import { loadInputs, saveInputs } from './lib/persistence';

function App() {
    const [persona, setPersona] = useState('lp');

    // Restore persona on mount
    useEffect(() => {
        const saved = loadInputs('app');
        if (saved?.persona) {
            setPersona(saved.persona);
        }
    }, []);

    // Persist persona changes
    useEffect(() => {
        saveInputs('app', { persona });
    }, [persona]);

    return (
        <div className="animated-bg">
            <div className="container">
                <header className="flex justify-between items-center mb-md" style={{ paddingTop: 'var(--space-lg)' }}>
                    <h1>Full Sail Yield Calculator</h1>
                    <input
                        type="text"
                        placeholder="0x... (optional address)"
                        style={{ width: '280px' }}
                        aria-label="Wallet address"
                    />
                </header>

                <PersonaToggle persona={persona} onChange={setPersona} />

                <main className="mt-lg">
                    {persona === 'lp' ? (
                        <LPCalculator />
                    ) : (
                        <TokenBuyerCalculator />
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
