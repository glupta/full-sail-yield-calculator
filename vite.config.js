import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            // Polyfill all Node.js modules for SDK compatibility
            protocolImports: true,
            // Override EventEmitter to ensure proper browser compatibility
            overrides: {
                events: 'events',
            },
        }),
    ],
    resolve: {
        alias: {
            // Fix Full Sail SDK entry resolution issue
            '@fullsailfinance/sdk': path.resolve(
                './node_modules/@fullsailfinance/sdk/dist/index.js'
            ),
            // Force events to use the proper browser polyfill
            'events': 'events',
        },
    },
    optimizeDeps: {
        // Pre-bundle problematic dependencies
        include: ['events', 'axios'],
        esbuildOptions: {
            // Define global for browser compatibility
            define: {
                global: 'globalThis',
            },
        },
    },
    build: {
        // Ensure CommonJS modules are properly handled
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
});
