'use client';

import { useState, useEffect } from 'react';
import LPCalculator from '@/components/LPCalculator';
import { Heart, ExternalLink } from 'lucide-react';

export default function Home() {
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

            {/* Main Content */}
            <main>
                <LPCalculator />
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
    );
}
