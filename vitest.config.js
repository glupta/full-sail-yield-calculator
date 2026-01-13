import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './lib/test/setup.js',
        include: ['lib/**/*.{test,spec}.{js,jsx}'],
    },
});
