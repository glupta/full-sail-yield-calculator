/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/lib/test/setup.js'],
    testMatch: ['<rootDir>/lib/**/*.test.{js,jsx}'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['next/babel'] }],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(@fullsailfinance)/)',
    ],
};

module.exports = config;
