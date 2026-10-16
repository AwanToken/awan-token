import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

function patchTonConnectManifest(origin: string) {
  const file = join(__dirname, "public", "tonconnect-manifest.json");
  const base = origin.replace(/\/$/, "");
  const data = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { name: "$AWN Mini App" };
  data.url = base;
  data.name = data.name || "$AWN Mini App";
  data.iconUrl = `${base}/awn-logo.png`;
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

/** Vercel (or VITE_APP_ORIGIN) sets origin at build time; Netlify/local builds keep committed URLs. */
function buildOriginFromEnv(): string | null {
  const explicit = process.env.VITE_APP_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return null;
}

function tonConnectManifestPlugin(): Plugin {
  return {
    name: "tonconnect-manifest-origin",
    buildStart() {
      const origin = buildOriginFromEnv();
      if (origin) {
        patchTonConnectManifest(origin);
        console.log(`[tonconnect] manifest (build) → ${origin}`);
      }
    },
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        let origin = "http://localhost:5174";
        if (addr && typeof addr === "object") {
          const host =
            addr.address === "::" || addr.address === "0.0.0.0"
              ? "localhost"
              : addr.address;
          origin = `http://${host}:${addr.port}`;
        }
        patchTonConnectManifest(origin);
        console.log(`[tonconnect] manifest → ${origin}`);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tonConnectManifestPlugin()],
  resolve: {
    alias: {
      buffer: "buffer/",
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer", "@ton/core", "@ton/ton"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5174,
    host: true,
    // Telegram / ngrok / Cloudflare tunnels
    allowedHosts: true,
  },
  preview: {
    port: 4174,
    host: true,
    allowedHosts: true,
  },
});
