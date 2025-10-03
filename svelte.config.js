// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-auto';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(), // <-- must call it
  }
};

export default config;
