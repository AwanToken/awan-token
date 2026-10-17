import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import type { IncomingMessage, ServerResponse } from "http";
import type { Connect } from "vite";

/** Mirrors miniapp/api/gecko.ts so local Vite / tunnel can serve OHLCV without Vercel. */
function geckoDevProxyPlugin(): Plugin {
  const GT_BASE = "https://api.geckoterminal.com/api/v2";
  const NETWORK = "ton";
  const MINTER = "EQA2T-nreKcnBzZmQfAJfEXCBdx8qPGVi8zGIUhFMtYi1vPs";
  const DEDUST_POOL = "EQDRwZaP6FX2J-VMQxVRydeTAWDKrVomkai5G-Iwji43X8oo";
  const RESOURCES: Record<string, string> = {
    pool: `${GT_BASE}/networks/${NETWORK}/pools/${encodeURIComponent(DEDUST_POOL)}`,
    token: `${GT_BASE}/networks/${NETWORK}/tokens/${encodeURIComponent(MINTER)}`,
    ohlcv:
      `${GT_BASE}/networks/${NETWORK}/pools/${encodeURIComponent(DEDUST_POOL)}` +
      `/ohlcv/minute?aggregate=15&limit=100&currency=token`,
  };

  const middleware: Connect.NextHandleFunction = (
    req: IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) => {
    const rawUrl = req.url || "";
    if (!rawUrl.startsWith("/api/gecko")) {
      next();
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }

    let resource = "";
    try {
      const u = new URL(rawUrl, "http://localhost");
      resource = u.searchParams.get("resource") || "";
    } catch {
      resource = "";
    }
    const upstreamUrl = RESOURCES[resource];
    if (!upstreamUrl) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "resource must be pool | token | ohlcv" }));
      return;
    }

    void (async () => {
      try {
        const upstream = await fetch(upstreamUrl, {
          headers: { Accept: "application/json" },
        });
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", "application/json");
        res.end(text || JSON.stringify({ error: `gt ${upstream.status}` }));
      } catch (e) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
    })();
  };

  return {
    name: "gecko-api-dev-proxy",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

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
  plugins: [react(), tonConnectManifestPlugin(), geckoDevProxyPlugin()],
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
