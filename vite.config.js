/// <reference types="vitest" />

import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
	test: {
		environment: 'jsdom',
		coverage: {
			include: ['src'],
		},
		include: ['src/**/*.test.ts'],
	},
	plugins: [viteSingleFile()],
})
