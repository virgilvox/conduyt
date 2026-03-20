/**
 * CONDUYT Hardware Integration Tests
 *
 * Tests against a physically connected board running CONDUYT firmware.
 * Uses conduyt-wasm for all protocol encoding/decoding.
 *
 * Usage:
 *   npm test
 *   CONDUYT_PORT=/dev/cu.usbmodem101 npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SerialPort } from 'serialport';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load WASM ───────────────────────────────────────────────────────
let wasm;
try {
  const wasmJsPath = resolve(__dirname, '..', 'sdk', 'wasm', 'pkg', 'conduyt_wasm.js');
  const wasmBinPath = resolve(__dirname, '..', 'sdk', 'wasm', 'pkg', 'conduyt_wasm_bg.wasm');
  wasm = await import(wasmJsPath);
  const wasmBytes = await readFile(wasmBinPath);
  await wasm.default(wasmBytes);
} catch {
  wasm = await import('conduyt-wasm');
  await wasm.default();
}

// ── Config ──────────────────────────────────────────────────────────
const PORT = process.env.CONDUYT_PORT || await autoDetectPort();
const BAUD = parseInt(process.env.CONDUYT_BAUD || '115200');
const TIMEOUT = 5000;

async function autoDetectPort() {
  const ports = await SerialPort.list();
  const arduino = ports.find(p => p.vendorId?.toLowerCase() === '2341');
  const usb = ports.find(p => p.vendorId);
  const found = arduino || usb;
  if (!found) {
    console.error('No USB serial device found. Connect a board or set CONDUYT_PORT.');
    process.exit(1);
  }
  console.log(`Auto-detected: ${found.path} (${found.manufacturer || found.vendorId || 'unknown'})`);
  return found.path;
}

// ── Serial connection ───────────────────────────────────────────────
const CMD = wasm.getCMD();
const EVT = wasm.getEVT();

let port;
let seq = 0;
let frameBuffer = Buffer.alloc(0);
const pendingResponses = new Map();

function nextSeq() { const s = seq; seq = (seq + 1) & 0xFF; return s; }

function sendCommand(cmdType, payload = new Uint8Array(0)) {
  return new Promise((resolve, reject) => {
    const s = nextSeq();
    const pkt = wasm.makePacket(cmdType, s, payload);
    const wireBytes = wasm.wireEncode(pkt);
    const cobsBytes = wasm.cobsEncode(wireBytes);
    const frame = Buffer.concat([Buffer.from(cobsBytes), Buffer.from([0x00])]);

    const timer = setTimeout(() => {
      pendingResponses.delete(s);
      reject(new Error(`Timeout waiting for response (seq=${s}, cmd=0x${cmdType.toString(16)})`));
    }, TIMEOUT);

    pendingResponses.set(s, { resolve, reject, timer });
    port.write(frame);
  });
}

function processData(data) {
  frameBuffer = Buffer.concat([frameBuffer, data]);
  let start = 0;
  for (let i = 0; i < frameBuffer.length; i++) {
    if (frameBuffer[i] === 0x00) {
      if (i > start) {
        const raw = new Uint8Array(frameBuffer.subarray(start, i));
        try {
          const decoded = wasm.cobsDecode(raw);
          if (decoded) {
            const pkt = wasm.wireDecode(decoded);
            if (pkt) {
              const pending = pendingResponses.get(pkt.seq);
              if (pending) {
                clearTimeout(pending.timer);
                pendingResponses.delete(pkt.seq);
                if (pkt.type === EVT.NAK) {
                  const code = pkt.payload.length > 0 ? pkt.payload[0] : 0;
                  pending.reject(new Error(`NAK: ${wasm.errName(code)} (0x${code.toString(16)})`));
                } else {
                  pending.resolve(pkt);
                }
              }
            }
          }
        } catch { /* invalid frame */ }
      }
      start = i + 1;
    }
  }
  frameBuffer = frameBuffer.subarray(start);
}

// ── Tests ───────────────────────────────────────────────────────────

console.log(`\nCONDUYT Hardware Integration Tests`);
console.log(`Port: ${PORT}`);
console.log(`Baud: ${BAUD}\n`);

before(async () => {
  port = new SerialPort({ path: PORT, baudRate: BAUD });
  await new Promise((resolve, reject) => {
    port.on('open', resolve);
    port.on('error', reject);
  });
  port.on('data', processData);
  await new Promise(r => setTimeout(r, 1000));
});

after(async () => {
  for (const [, p] of pendingResponses) clearTimeout(p.timer);
  pendingResponses.clear();
  if (port?.isOpen) await new Promise(r => port.close(r));
});

describe('HELLO handshake', () => {
  it('receives HELLO_RESP with firmware info', async () => {
    const resp = await sendCommand(CMD.HELLO);
    assert.equal(resp.type, EVT.HELLO_RESP);
    assert.ok(resp.payload.length >= 28, `Payload too short: ${resp.payload.length} bytes`);

    const name = String.fromCharCode(...resp.payload.slice(0, 16)).replace(/\0+$/, '');
    const version = `${resp.payload[16]}.${resp.payload[17]}.${resp.payload[18]}`;
    const pinCount = resp.payload[28];
    console.log(`    Firmware: ${name} v${version}, ${pinCount} pins`);

    assert.ok(name.length > 0, 'Firmware name should not be empty');
    assert.ok(pinCount > 0, 'Should report at least 1 pin');
  });
});

describe('PING', () => {
  it('receives PONG', async () => {
    const resp = await sendCommand(CMD.PING);
    assert.equal(resp.type, EVT.PONG);
  });

  it('responds to 10 sequential pings', async () => {
    for (let i = 0; i < 10; i++) {
      const resp = await sendCommand(CMD.PING);
      assert.equal(resp.type, EVT.PONG);
    }
  });
});

describe('PIN operations', () => {
  it('PIN_MODE output ACKs', async () => {
    const resp = await sendCommand(CMD.PIN_MODE, new Uint8Array([2, 0x01]));
    assert.equal(resp.type, EVT.ACK);
  });

  it('PIN_WRITE HIGH ACKs', async () => {
    const resp = await sendCommand(CMD.PIN_WRITE, new Uint8Array([2, 1, 0]));
    assert.equal(resp.type, EVT.ACK);
  });

  it('PIN_WRITE LOW ACKs', async () => {
    const resp = await sendCommand(CMD.PIN_WRITE, new Uint8Array([2, 0, 0]));
    assert.equal(resp.type, EVT.ACK);
  });

  it('PIN_READ returns value', async () => {
    await sendCommand(CMD.PIN_MODE, new Uint8Array([2, 0x00])); // INPUT
    const resp = await sendCommand(CMD.PIN_READ, new Uint8Array([2]));
    assert.equal(resp.type, EVT.PIN_READ_RESP);
    assert.ok(resp.payload.length >= 3);
    const value = resp.payload[1] | (resp.payload[2] << 8);
    console.log(`    Pin 2 read: ${value}`);
  });
});

describe('PIN_SUBSCRIBE', () => {
  it('subscribes to analog pin with correct payload', async () => {
    // Set pin A0 (14) to analog mode
    await sendCommand(CMD.PIN_MODE, new Uint8Array([14, 0x03]));

    // Subscribe: pin=14, mode=ANALOG_POLL(0x04), interval=200ms, threshold=0
    const resp = await sendCommand(CMD.PIN_SUBSCRIBE, new Uint8Array([14, 0x04, 0xC8, 0x00, 0x00, 0x00]));
    assert.equal(resp.type, EVT.ACK, `Expected ACK, got 0x${resp.type.toString(16)}`);

    // Wait for events
    const events = [];
    const unsub = serial => {};
    await new Promise(r => setTimeout(r, 600));

    // Unsubscribe
    const unsubResp = await sendCommand(CMD.PIN_UNSUBSCRIBE, new Uint8Array([14]));
    assert.equal(unsubResp.type, EVT.ACK);
  });

  it('NAKs subscribe with too-short payload', async () => {
    try {
      await sendCommand(CMD.PIN_SUBSCRIBE, new Uint8Array([2, 0x01])); // only 2 bytes, need 5
      assert.fail('Should have NAKed');
    } catch (e) {
      assert.ok(e.message.includes('NAK'), `Expected NAK, got: ${e.message}`);
    }
  });

  it('unsubscribe NAKs for non-subscribed pin', async () => {
    try {
      await sendCommand(CMD.PIN_UNSUBSCRIBE, new Uint8Array([99]));
      assert.fail('Should have NAKed');
    } catch (e) {
      assert.ok(e.message.includes('NAK'), `Expected NAK, got: ${e.message}`);
    }
  });
});

describe('error handling', () => {
  it('short PIN_MODE payload NAKs', async () => {
    try {
      await sendCommand(CMD.PIN_MODE, new Uint8Array([]));
      assert.fail('Should have NAKed');
    } catch (e) {
      assert.ok(e.message.includes('NAK'), `Expected NAK, got: ${e.message}`);
      console.log(`    NAK: ${e.message}`);
    }
  });
});

describe('RESET', () => {
  it('ACKs reset command', async () => {
    const resp = await sendCommand(CMD.RESET);
    assert.equal(resp.type, EVT.ACK);
    await new Promise(r => setTimeout(r, 500));
  });
});
