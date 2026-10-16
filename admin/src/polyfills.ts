import { Buffer } from "buffer";

const g = globalThis as typeof globalThis & { Buffer: typeof Buffer };
g.Buffer = Buffer;
if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
