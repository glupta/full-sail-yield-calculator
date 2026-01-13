import { useState, useEffect, useCallback } from 'react';
import PersonaToggle from './components/PersonaToggle';
import LPCalculator from './components/LPCalculator';
import TokenBuyerCalculator from './components/TokenBuyerCalculator';
import VeSailMarketPanel from './components/VeSailMarketPanel';
import { loadInputs, saveInputs } from './lib/persistence';
import { Heart, ExternalLink } from 'lucide-react';

const VALID_TABS = ['lp', 'buyer', 'vesail'];

function App() {
    const [persona, setPersona] = useState(() => {
        // Priority: URL param > localStorage > default
        const urlParams = new URLSearchParams(window.location.search);
        const tabFromUrl = urlParams.get('tab');
        if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
            return tabFromUrl;
        }
        const saved = loadInputs('app');
        if (saved?.persona && VALID_TABS.includes(saved.persona)) {
            return saved.persona;
        }
        return 'lp';
    });

    // Update URL when persona changes
    const handlePersonaChange = useCallback((newPersona) => {
        setPersona(newPersona);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', newPersona);
        window.history.replaceState({}, '', url.toString());
    }, []);

    // Persist persona changes to localStorage
    useEffect(() => {
        saveInputs('app', { persona });
    }, [persona]);

    // Sync URL on initial load if needed
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') !== persona) {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', persona);
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

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
                    <PersonaToggle persona={persona} onChange={handlePersonaChange} />
                </nav>

                {/* Main Content */}
                <main>
                    {persona === 'lp' && <LPCalculator />}
                    {persona === 'buyer' && <TokenBuyerCalculator />}
                    {persona === 'vesail' && <VeSailMarketPanel />}
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
                            href="https://x.com/therealglupta"
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
                            glupta
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
