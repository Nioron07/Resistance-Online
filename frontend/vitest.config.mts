import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.mts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      setupFiles: ['test/setup.ts'], // AI added to centralize test setup
      server: {
        deps: {
          inline: ['vuetify'],
        },
      },
    },
  }),
)
