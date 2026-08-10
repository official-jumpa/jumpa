import { defineConfig } from 'tsup';

/**
 * @tsup config
 * Defines the configuration for the tsup build tool
 * currently the included protocols here are  built with esm format
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  noExternal: ['rpc-websockets', 'uuid', '@solana/web3.js', '@noble/curves', '@coral-xyz/anchor'],
  external: ['canvas'],
});
