'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LPCalculator from '@/components/LPCalculator';
import TokenBuyerCalculator from '@/components/TokenBuyerCalculator';
import VeSailMarketPanel from '@/components/VeSailMarketPanel';
import PersonaToggle from '@/components/PersonaToggle';
import { Heart, ExternalLink } from 'lucide-react';

const VALID_TABS = ['lp', 'buyer', 'vesail'];

function HomeContent() {
    const searchParams = useSearchParams();

    const [persona, setPersona] = useState<string>(() => {
        // Check URL param first
        const tabFromUrl = searchParams.get('tab');
        if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
            return tabFromUrl;
        }
        // Then localStorage
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('fullsail_app');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed?.persona && VALID_TABS.includes(parsed.persona)) {
                        return parsed.persona;
                    }
                }
            } catch (e) {
                // Ignore localStorage errors
            }
        }
        return 'lp';
    });

    // Update URL and localStorage when persona changes
    const handlePersonaChange = useCallback((newPersona: string) => {
        setPersona(newPersona);

        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('tab', newPersona);
        window.history.replaceState({}, '', url.toString());

        // Persist to localStorage
        try {
            localStorage.setItem('fullsail_app', JSON.stringify({ persona: newPersona }));
        } catch (e) {
            // Ignore localStorage errors
        }
    }, []);

    // Sync URL on initial load if missing
    useEffect(() => {
        const currentTab = searchParams.get('tab');
        if (currentTab !== persona) {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', persona);
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    return (
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
                    >
                        glupta
                        <ExternalLink size={10} />
                    </a>
                    {' '}&amp; Claude
                </p>
                <p style={{ marginBottom: 'var(--space-xs)', opacity: 0.8 }}>
                    <strong>Disclaimer:</strong> This tool is for informational purposes only and does not constitute financial advice.
                </p>
                <p style={{ opacity: 0.6, maxWidth: '500px', margin: '0 auto' }}>
                    This is experimental software. Calculations may contain errors. Always verify independently before making investment decisions.
                </p>
            </footer>
        </div>
    );
}

export default function Home() {
    return (
        <Suspense fallback={
            <div className="container" style={{ paddingTop: 'var(--space-xl)' }}>
                <div className="skeleton" style={{ height: '40px', width: '300px', marginBottom: 'var(--space-lg)' }}></div>
                <div className="skeleton" style={{ height: '48px', maxWidth: '500px', marginBottom: 'var(--space-xl)' }}></div>
                <div className="skeleton skeleton-card" style={{ height: '400px' }}></div>
            </div>
        }>
            <HomeContent />
        </Suspense>
    );
}
