import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"));
const appVersion = packageJson.version || "1.0.0";

// Debug: Log environment variables at build time
console.log('=== BUILD TIME DEBUG ===');
console.log('VITE_WAITLIST_MODE:', process.env.VITE_WAITLIST_MODE);
console.log('All VITE_ vars:', Object.keys(process.env).filter(k => k.startsWith('VITE_')));
console.log('======================');

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@shared/data": path.resolve(import.meta.dirname, "shared", "data"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Proxy API requests to local Express server (for TTS and other backend functions)
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
