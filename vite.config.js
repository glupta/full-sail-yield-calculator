import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            // Include all polyfills for maximum compatibility
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
    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: 'globalThis',
            },
        },
    },
    build: {
        commonjsOptions: {
            transformMixedEsModules: true,
            // Include problematic deps in CJS transform
            include: [/node_modules/],
        },
        rollupOptions: {
            // Externalize problematic Node.js-only dependencies
            // These won't be bundled - we'll handle gracefully in code
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
});
