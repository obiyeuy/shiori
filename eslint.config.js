import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
 {ignores:['node_modules/**','.svelte-kit/**','build/**','docs/**','outputs/**','.superpowers/**','.local/**']},
 js.configs.recommended,...ts.configs.recommended,
 {files:['**/*.ts','**/*.js','**/*.mjs','**/*.cjs'],languageOptions:{globals:{process:'readonly',console:'readonly',Buffer:'readonly',URL:'readonly',URLSearchParams:'readonly',fetch:'readonly',Headers:'readonly',Request:'readonly',Response:'readonly',AbortSignal:'readonly',setTimeout:'readonly'}},rules:{'no-control-regex':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}},
 {files:['scripts/*.cjs'],languageOptions:{sourceType:'commonjs',globals:{require:'readonly'}},rules:{'@typescript-eslint/no-require-imports':'off'}},
 {files:['tests/**/*.ts'],rules:{'@typescript-eslint/no-explicit-any':'off'}}
);
