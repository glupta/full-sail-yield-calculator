import { useState, useEffect } from 'react';
import PersonaToggle from './components/PersonaToggle';
import LPCalculator from './components/LPCalculator';
import TokenBuyerCalculator from './components/TokenBuyerCalculator';
import { loadInputs, saveInputs } from './lib/persistence';
import { Heart, ExternalLink } from 'lucide-react';

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
                {/* Header */}
                <header
                    className="flex justify-between items-center mb-lg"
                    style={{
                        paddingTop: 'var(--space-xl)',
                        paddingBottom: 'var(--space-sm)'
                    }}
                >
                    <h1 style={{ margin: 0 }}>Full Sail Yield Calculator</h1>
                </header>

                {/* Navigation */}
                <nav style={{ marginBottom: 'var(--space-xl)' }}>
                    <PersonaToggle persona={persona} onChange={setPersona} />
                </nav>

                {/* Main Content */}
                <main>
                    {persona === 'lp' ? (
                        <LPCalculator />
                    ) : (
                        <TokenBuyerCalculator />
                    )}
                </main>

                {/* Footer */}
                <footer style={{
                    marginTop: 'var(--space-3xl)',
                    paddingTop: 'var(--space-lg)',
                    paddingBottom: 'var(--space-xl)',
                    borderTop: '1px solid var(--border-subtle)',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                }}>
                    <p style={{
                        marginBottom: 'var(--space-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}>
                        Made with
                        <Heart
                            size={14}
                            style={{
                                color: 'var(--color-error)',
                                animation: 'pulse 2s ease-in-out infinite'
                            }}
                            fill="currentColor"
                        />
                        by{' '}
                        <a
                            href="https://twitter.com/akshay"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: 'var(--color-primary)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                transition: 'opacity var(--duration-fast) var(--ease-out)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                        >
                            akshay
                            <ExternalLink size={10} />
                        </a>
                        {' '}& Claude
                    </p>
                    <p style={{ marginBottom: 'var(--space-xs)', opacity: 0.8 }}>
                        <strong>Disclaimer:</strong> This tool is for informational purposes only and does not constitute financial advice.
                    </p>
                    <p style={{ opacity: 0.6, maxWidth: '500px', margin: '0 auto' }}>
                        This is experimental software. Calculations may contain errors. Always verify independently before making investment decisions.
                    </p>
                </footer>
            </div>
        </div>
    );
}

export default App;
