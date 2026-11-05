// jsdom (jest's testEnvironment) does not expose TextEncoder/TextDecoder as
// globals, but @noble/hashes and real browsers/Node do. Polyfill from Node's
// `util` so hashing-backed code (e.g. completeness verification) runs in tests.
import { TextEncoder, TextDecoder } from "util";

if (typeof (globalThis as any).TextEncoder === "undefined") {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof (globalThis as any).TextDecoder === "undefined") {
  (globalThis as any).TextDecoder = TextDecoder;
}

// jsdom's AbortSignal has no `timeout`, which @willow-network/sdk uses to
// bound a transaction submission; browsers and Node have it.
if (typeof (AbortSignal as any).timeout !== "function") {
  (AbortSignal as any).timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    const timer: any = setTimeout(() => controller.abort(), ms);
    timer?.unref?.();
    return controller.signal;
  };
}
