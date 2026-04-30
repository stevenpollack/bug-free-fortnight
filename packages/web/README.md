# Family Recipes — Web App

Mobile-first React PWA built with Vite, TanStack Router/Query/Form, and Tailwind CSS.

## Development

```sh
bun run dev
```

The service worker is **disabled in dev** (`devOptions: { enabled: false }`) so hot-reload works normally.

## Production build

```sh
bun run build
```

Outputs to `dist/`. Includes the service worker (`sw.js`) and the web app manifest (`manifest.webmanifest`).

## PWA icons

Icons are generated from the SVG source at `public/icons/icon.svg` using `@resvg/resvg-js`.

To regenerate after editing the SVG:

```sh
bun run build:icons
```

This writes the following files to `public/icons/`:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192×192 | Standard icon (manifest) |
| `icon-512.png` | 512×512 | Standard icon (manifest) |
| `icon-512-maskable.png` | 512×512 | Maskable icon (manifest) — the SVG has ~10% padding so the content stays in the safe zone |
| `apple-touch-icon.png` | 180×180 | iOS home screen icon |

### iOS install

iOS does not support the `beforeinstallprompt` event so no in-app install button is shown on iOS. To add the app to your home screen on iOS: **Safari → Share → Add to Home Screen**.

## Offline support

The service worker (Workbox, `NetworkFirst`) caches `GET /api/recipes` responses for up to 3 days with a 5-second network timeout, so the recipe list stays usable briefly when offline. Mutations (POST/PUT/DELETE) are never cached.
