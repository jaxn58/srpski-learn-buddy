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
      rollupOptions: {
        output: {
          // Sustainable chunking strategy:
          // - keeps initial page load smaller via route-based splitting in App.tsx
          // - keeps caches stable by grouping large vendor deps into predictable chunks
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            // Core frameworks
            if (id.includes("/react/") || id.includes("/react-dom/")) return "react";

            // Auth / data
            // IMPORTANT: Do NOT isolate Clerk into its own chunk.
            // We saw a production TDZ error ("Cannot access 'ut' before initialization") in the `clerk-*.js` chunk.
            // Keeping Clerk in the regular vendor buckets avoids fragile cross-chunk initialization ordering.
            if (id.includes("/convex/") || id.includes("convex/")) return "convex";
            if (id.includes("@tanstack/")) return "tanstack";

            // UI / icons
            if (id.includes("@radix-ui/")) return "radix";
            if (id.includes("@floating-ui/")) return "floating-ui";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("cmdk")) return "cmdk";
            if (id.includes("vaul")) return "vaul";

            // Content / editors
            if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-")) return "markdown";
            if (id.includes("@tiptap/")) return "tiptap";
            if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";

            // Charts / dates
            if (id.includes("recharts") || id.includes("/d3-") || id.includes("/d3/")) return "charts";
            if (id.includes("date-fns")) return "date";
            if (id.includes("react-day-picker")) return "datepicker";

            // Payments (beta hides checkout, but keep chunking stable for later launch)
            if (id.includes("@paddle/")) return "paddle";

            // Forms / validation / utilities
            if (id.includes("react-hook-form")) return "forms";
            if (id.includes("zod")) return "zod";
            if (id.includes("axios")) return "axios";
            if (id.includes("sonner")) return "sonner";
            if (id.includes("embla-carousel")) return "carousel";
            if (id.includes("input-otp")) return "otp";

            // Default: split remaining vendor packages deterministically into a few buckets.
            // This avoids a single mega-vendor chunk while keeping the number of requests reasonable.
            const nm = id.split("node_modules/")[1];
            if (!nm) return "vendor";

            const parts = nm.split("/");

            // pnpm layout: node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...
            // We want the <pkg> after the inner node_modules segment.
            let pkg: string | undefined;
            if (parts[0] === ".pnpm") {
              const innerNmIndex = parts.indexOf("node_modules");
              const p0 = innerNmIndex >= 0 ? parts[innerNmIndex + 1] : undefined;
              const p1 = innerNmIndex >= 0 ? parts[innerNmIndex + 2] : undefined;
              pkg = p0?.startsWith("@") ? `${p0}/${p1}` : p0;
            } else {
              pkg = parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
            }
            const normalizedPkg = (pkg || "vendor").replace(/^@/, "");

            // Deterministic hash bucketing keeps chunks stable and evenly distributed.
            let hash = 0;
            for (let i = 0; i < normalizedPkg.length; i++) {
              hash = (hash * 31 + normalizedPkg.charCodeAt(i)) >>> 0;
            }
            const bucket = hash % 3;
            if (bucket === 0) return "vendor-1";
            if (bucket === 1) return "vendor-2";
            return "vendor-3";
          },
        },
      },
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
