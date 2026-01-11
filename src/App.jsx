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
                </header>

                <PersonaToggle persona={persona} onChange={setPersona} />

                <main className="mt-lg">
                    {persona === 'lp' ? (
                        <LPCalculator />
                    ) : (
                        <TokenBuyerCalculator />
                    )}
                </main>

                {/* Footer */}
                <footer style={{
                    marginTop: 'var(--space-2xl)',
                    paddingTop: 'var(--space-lg)',
                    paddingBottom: 'var(--space-xl)',
                    borderTop: '1px solid var(--border-subtle)',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                }}>
                    <p style={{ marginBottom: 'var(--space-sm)' }}>
                        Made with ❤️ by <a href="https://twitter.com/akshaygupta" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>akshay</a> & Claude
                    </p>
                    <p style={{ marginBottom: 'var(--space-xs)', opacity: 0.8 }}>
                        <strong>Disclaimer:</strong> This tool is for informational purposes only and does not constitute financial advice.
                    </p>
                    <p style={{ opacity: 0.7 }}>
                        This is experimental software. Calculations may contain errors. Always verify independently before making investment decisions.
                    </p>
                </footer>
            </div>
        </div>
    );
}

export default App;
