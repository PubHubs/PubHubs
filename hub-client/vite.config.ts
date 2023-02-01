/// <reference types="vitest" />

import { defineConfig } from 'vite'
import { alias } from './alias'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [
        Vue(),
    ],
    test: {
        root: './',
        globals: true,
        environment: 'jsdom',
    },
    resolve: {
        alias,
    }
})
