import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        environment: 'node',
        globals: false,
    },
    resolve: {
        alias: {
            '@tak-ps/node-tak': resolve(root, 'node_modules/@tak-ps/node-tak/dist/index.js'),
        },
    },
});
