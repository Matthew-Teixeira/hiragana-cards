import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
	  devOptions: { enabled: true },
      // Turn this on to test install in `npm run dev`
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Hiragana & Katakana Trainer',
        short_name: 'Kana Trainer',
        description: 'Spaced-repetition flashcards for Hiragana & Katakana.',
        theme_color: '#10b981',     // matches your green buttons
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          // Provide these files in /static/icons (see step 3)
          { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache built assets and routes for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html'
      }
    })
  ]
});
