import type { MetadataRoute } from 'next';
import { platformNameFromEnv } from '@/lib/platform';

/**
 * Installable app (PWA). "Add to home screen" gives buyers the bazaar and
 * their tickets one tap away — tickets and order pages keep working offline at
 * the door (public/sw.js) — and gives sellers the hub as an app on the phone
 * they run the counter with.
 */
export default function manifest(): MetadataRoute.Manifest {
  const name = platformNameFromEnv();
  return {
    name: `${name} — Nepali events & bazaar`,
    short_name: name,
    description: 'Nepali concerts, cultural nights and a bazaar of Nepali sellers across Germany. Tickets and orders with a QR code.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0b10',
    theme_color: '#0a0b10',
    categories: ['shopping', 'entertainment', 'food'],
    // -v2: the 3D flag (tools/story-videos/app-icons.mjs). New names, so no
    // phone or service-worker cache keeps showing the old one.
    icons: [
      { src: '/icons/icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'The bazaar', url: '/market', icons: [{ src: '/icons/icon-192-v2.png', sizes: '192x192' }] },
      { name: 'Seller hub', url: '/portal', icons: [{ src: '/icons/icon-192-v2.png', sizes: '192x192' }] },
    ],
  };
}
