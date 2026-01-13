import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            // Polyfill all Node.js modules for SDK compatibility
            // The SDK uses Axios which depends on EventEmitter
            protocolImports: true,
        }),
    ],
    resolve: {
        alias: {
            // Fix Full Sail SDK entry resolution issue
            '@fullsailfinance/sdk': path.resolve(
                './node_modules/@fullsailfinance/sdk/dist/index.js'
            ),
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
