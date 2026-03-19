/**
 * CONDUYT Core TypeScript Types
 */

import type { CMD, EVT, DS_TYPE, PIN_MODE, SUB_MODE } from './constants.js'

// ── Packet ───────────────────────────────────────────────

export interface ConduytPacket {
  version: number
  type: number
  seq: number
  payload: Uint8Array
}

// ── HELLO_RESP Capability Model ──────────────────────────

export interface HelloResp {
  firmwareName: string
  firmwareVersion: [number, number, number]
  mcuId: Uint8Array
  otaCapable: boolean
  pins: PinCapability[]
  i2cBuses: number
  spiBuses: number
  uartCount: number
  maxPayload: number
  modules: ModuleDescriptor[]
  datastreams: DatastreamDescriptor[]
}

export interface PinCapability {
  pin: number
  capabilities: number  // bitmask of PIN_CAP values
}

export interface ModuleDescriptor {
  moduleId: number
  name: string
  versionMajor: number
  versionMinor: number
  pins: number[]
}

export interface DatastreamDescriptor {
  index: number
  name: string
  type: number  // DS_TYPE value
  unit: string
  writable: boolean
  pinRef: number  // 0xFF if none
  retain: boolean
}

// ── Transport ────────────────────────────────────────────

export interface ConduytTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(packet: Uint8Array): Promise<void>
  onReceive(handler: (packet: Uint8Array) => void): void
  readonly connected: boolean
  readonly needsCOBS: boolean
}

// ── Subscribe Options ────────────────────────────────────

export interface PinSubscribeOptions {
  mode?: number        // SUB_MODE value (default: CHANGE for digital, ANALOG_POLL for analog)
  intervalMs?: number  // poll interval for analog (default: 100)
  threshold?: number   // report only if delta > threshold (default: 0)
}

export interface DatastreamSubscribeOptions {
  threshold?: number   // optional threshold for numeric types
}

// ── Value Types ──────────────────────────────────────────

export type DatastreamValue = boolean | number | string | Uint8Array
