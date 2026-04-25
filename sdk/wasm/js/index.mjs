import init, * as wasm from '../pkg/conduyt_wasm.js';

let initialized = false;
let initPromise = null;

/**
 * Ensure the WASM module is initialized. Must be called before using
 * any other export. Safe to call multiple times.
 */
export async function ensureInit(input) {
  if (initialized) return;
  if (!initPromise) initPromise = init(input);
  await initPromise;
  initialized = true;
}

// Re-export core functions
export const cobsEncode = (...a) => wasm.cobsEncode(...a);
export const cobsDecode = (...a) => wasm.cobsDecode(...a);
export const crc8 = (...a) => wasm.crc8(...a);
export const wireEncode = (...a) => wasm.wireEncode(...a);
export const wireDecode = (...a) => wasm.wireDecode(...a);
export const makePacket = (...a) => wasm.makePacket(...a);
export const wirePacketSize = (...a) => wasm.wirePacketSize(...a);
export const wireFindPacket = (...a) => wasm.wireFindPacket(...a);
export const errName = (...a) => wasm.errName(...a);

// Lazily-cached constant objects
let _CMD, _EVT, _ERR;

export const CMD = new Proxy({}, {
  get(_, prop) { return (_CMD ??= wasm.getCMD())[prop]; },
  ownKeys() { return Object.keys(_CMD ??= wasm.getCMD()); },
  getOwnPropertyDescriptor(_, prop) {
    const val = (_CMD ??= wasm.getCMD())[prop];
    if (val !== undefined) return { configurable: true, enumerable: true, value: val };
  },
});

export const EVT = new Proxy({}, {
  get(_, prop) { return (_EVT ??= wasm.getEVT())[prop]; },
  ownKeys() { return Object.keys(_EVT ??= wasm.getEVT()); },
  getOwnPropertyDescriptor(_, prop) {
    const val = (_EVT ??= wasm.getEVT())[prop];
    if (val !== undefined) return { configurable: true, enumerable: true, value: val };
  },
});

export const ERR = new Proxy({}, {
  get(_, prop) { return (_ERR ??= wasm.getERR())[prop]; },
  ownKeys() { return Object.keys(_ERR ??= wasm.getERR()); },
  getOwnPropertyDescriptor(_, prop) {
    const val = (_ERR ??= wasm.getERR())[prop];
    if (val !== undefined) return { configurable: true, enumerable: true, value: val };
  },
});

export const PROTOCOL_VERSION = 0x02;
export const HEADER_SIZE = 8;
export const MAGIC = new Uint8Array([0x43, 0x44]);
