import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"));
const appVersion = packageJson.version || "1.0.0";

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname);
  // Ensure `.env.local` / `.env.[mode]` are loaded for dev server proxy config.
  const env = loadEnv(mode, envDir, "");

  return {
    plugins,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __AGENT_LOG_ENABLED__: JSON.stringify(mode !== "production"),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@shared/data": path.resolve(import.meta.dirname, "shared", "data"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir,
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
        "/api": {
          target: env.VITE_SERVER_URL || "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
