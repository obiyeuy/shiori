import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [sveltekit()], ...(process.env.SITE_VERIFY_ROOT ? {cacheDir:`${process.env.SITE_VERIFY_ROOT}/vite-cache`} : {}) });
