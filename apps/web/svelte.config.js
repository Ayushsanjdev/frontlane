import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: process.env.VERCEL ? adapterVercel({runtime: 'nodejs22.x'}) : adapterNode(),
    alias: {'@/*': './src/*'}
  }
};
