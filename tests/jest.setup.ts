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
