import {sveltekit} from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  envDir: '../..',
  server: {port: 3000, strictPort: true},
  ssr: {noExternal: ['@frontlanejobs/core', '@frontlanejobs/database']}
});
