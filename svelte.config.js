import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { outDir: process.env.SITE_VERIFY_ROOT ? `${process.env.SITE_VERIFY_ROOT}/kit` : '.svelte-kit', adapter: adapter({out:process.env.SITE_VERIFY_ROOT ? `${process.env.SITE_VERIFY_ROOT}/app` : 'build'}) }
};
