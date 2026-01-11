import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            // Required for Full Sail SDK which uses https.Agent and buffer
            include: ['buffer', 'https', 'http', 'stream', 'util', 'url'],
            globals: {
                Buffer: true,
                process: true,
            },
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
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
});
