---
title: "WASM SDK"
description: "Use the CONDUYT protocol core in the browser or Node.js via WebAssembly."
---

# WASM SDK

The `conduyt-wasm` package compiles the Rust protocol core to WebAssembly. It gives you CRC8, COBS framing, and wire encode/decode - the same implementation used by the native Rust SDK - running in the browser or Node.js.

## When to use

Use `conduyt-wasm` when you want to:

- Build a **browser-based** hardware control interface (pair with WebSerial or WebBluetooth)
- Guarantee **byte-level conformance** with the native SDKs
- Avoid reimplementing the protocol in JavaScript
- Build an **edge/serverless** app where WASM runs natively (Cloudflare Workers, Deno, etc.)

If you're building a Node.js app, you can use either `conduyt-wasm` or the pure-JS `conduyt-js` SDK - both implement the same protocol. The JS SDK includes higher-level features (device management, transports, modules) while the WASM module provides just the protocol primitives.

## Install

```bash
npm install conduyt-wasm
```

## Initialize

The WASM module must be initialized before use. This loads the `.wasm` binary.

### Browser

```javascript
import init, * as conduyt from 'conduyt-wasm';
await init(); // fetches and instantiates the WASM module
```

### Node.js

```javascript
import init, * as conduyt from 'conduyt-wasm';
import { readFile } from 'fs/promises';

const wasmBytes = await readFile('node_modules/conduyt-wasm/conduyt_wasm_bg.wasm');
await init(wasmBytes);
```

## Encode and decode packets

```javascript
const CMD = conduyt.getCMD();

// Build a PIN_WRITE command: pin 13, value 1
const pkt = conduyt.makePacket(CMD.PIN_WRITE, 0, new Uint8Array([13, 1, 0]));

// Encode to wire format (8-byte header + payload + CRC8)
const wire = conduyt.wireEncode(pkt);

// COBS-encode for serial transport (eliminates 0x00 bytes)
const frame = conduyt.cobsEncode(wire);

// Send over WebSerial...
await port.writable.getWriter().write(
  new Uint8Array([...frame, 0x00]) // add 0x00 delimiter
);
```

## Decode incoming packets

```javascript
// Receive bytes from serial, accumulate until 0x00 delimiter
const cobsFrame = receivedBytes; // everything before the 0x00

const decoded = conduyt.cobsDecode(cobsFrame);
if (decoded) {
  const pkt = conduyt.wireDecode(decoded);
  console.log('Type:', pkt.type, 'Seq:', pkt.seq, 'Payload:', pkt.payload);
}
```

## Find packets in a stream

```javascript
// wireFindPacket scans a buffer for the first valid packet
const result = conduyt.wireFindPacket(buffer);
if (result) {
  const [packet, bytesConsumed] = result;
  // process packet, advance buffer by bytesConsumed
}
```

## Constants

```javascript
const CMD = conduyt.getCMD();  // { PING: 0x01, HELLO: 0x02, PIN_MODE: 0x10, ... }
const EVT = conduyt.getEVT();  // { PONG: 0x80, HELLO_RESP: 0x81, ACK: 0x82, ... }
const ERR = conduyt.getERR();  // { UNKNOWN_TYPE: 0x01, CRC_MISMATCH: 0x02, ... }

conduyt.errName(0x04);         // "INVALID_PIN"
conduyt.PROTOCOL_VERSION();    // 1
conduyt.HEADER_SIZE();         // 8
```

## WebSerial Example

Complete browser example - connect to a CONDUYT board, send HELLO, and blink an LED:

```javascript
import init, * as conduyt from 'conduyt-wasm';
await init();

const CMD = conduyt.getCMD();
const EVT = conduyt.getEVT();
let seq = 0;

// Request serial port (requires user gesture)
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 115200 });

function sendPacket(type, payload = new Uint8Array(0)) {
  const pkt = conduyt.makePacket(type, seq++, payload);
  const wire = conduyt.wireEncode(pkt);
  const frame = conduyt.cobsEncode(wire);
  const writer = port.writable.getWriter();
  writer.write(new Uint8Array([...frame, 0x00]));
  writer.releaseLock();
}

// Send HELLO
sendPacket(CMD.HELLO);

// Set pin 13 to output
sendPacket(CMD.PIN_MODE, new Uint8Array([13, 0x01]));

// Toggle LED
sendPacket(CMD.PIN_WRITE, new Uint8Array([13, 1, 0]));
```

## Size

| Metric | Value |
|--------|-------|
| Raw WASM | ~28 KB |
| Gzipped | ~12 KB |
| Allocator | lol_alloc (~200 bytes) |

## Full API Reference

See the [conduyt-wasm README](https://github.com/virgilvox/conduyt/tree/main/sdk/wasm) for the complete function reference table.
