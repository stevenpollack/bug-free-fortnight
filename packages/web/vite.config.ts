import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
      host: mode === "development",
    },
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        manifest: {
          workbox: {
            runtimeCaching: [
              {
                urlPattern: ({ url, request }) =>
                  url.pathname.startsWith("/api/recipes") && request.method === "GET",
                handler: "NetworkFirst",
                options: {
                  cacheName: "api-recipes",
                  networkTimeoutSeconds: 5,
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 3 * 24 * 60 * 60, // 3 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
            ],
          },
        },
      }),
    ],
    resolve: {
      alias: {
        "@api/schemas": resolve(__dirname, "../api/src/schemas/index.ts"),
      },
    },
  };
});
