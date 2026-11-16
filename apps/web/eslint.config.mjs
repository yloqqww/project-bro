import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      // Existing client workstations intentionally load external data from
      // effects. These React Compiler advisory rules require a broader UI
      // refactor and are kept out of the production CI gate for now.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    '.next-*/**',
    'node_modules/**',
    'next-env.d.ts',
  ]),
]);
