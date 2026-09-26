import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
 {ignores:['node_modules/**','.svelte-kit/**','build/**','docs/**','outputs/**','.superpowers/**','.local/**']},
 js.configs.recommended,...ts.configs.recommended,
 {files:['**/*.ts','**/*.js'],languageOptions:{globals:{process:'readonly',console:'readonly',Buffer:'readonly',URL:'readonly',URLSearchParams:'readonly',fetch:'readonly',Headers:'readonly',Request:'readonly',Response:'readonly',AbortSignal:'readonly',setTimeout:'readonly'}},rules:{'no-control-regex':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}},
 {files:['tests/**/*.ts'],rules:{'@typescript-eslint/no-explicit-any':'off'}}
);
