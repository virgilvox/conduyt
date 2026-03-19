/**
 * CONDUYT HELLO_RESP Parser
 *
 * Decodes the binary HELLO_RESP payload into a typed capability model.
 * This is the host SDK's source of truth for what the device can do.
 */

import type { HelloResp, PinCapability, ModuleDescriptor, DatastreamDescriptor } from './core/types.js'

/**
 * Read a null-padded fixed-length string from a DataView.
 */
function readFixedString(view: DataView, offset: number, len: number): [string, number] {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, len)
  let end = bytes.indexOf(0)
  if (end === -1) end = len
  const str = new TextDecoder().decode(bytes.subarray(0, end))
  return [str, offset + len]
}

/**
 * Parse HELLO_RESP binary payload into a typed HelloResp object.
 */
export function parseHelloResp(payload: Uint8Array): HelloResp {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  let pos = 0

  // firmware_name: 16 bytes null-padded
  let firmwareName: string
  ;[firmwareName, pos] = readFixedString(view, pos, 16)

  // firmware_version: 3 bytes
  const vMajor = view.getUint8(pos++)
  const vMinor = view.getUint8(pos++)
  const vPatch = view.getUint8(pos++)

  // mcu_id: 8 bytes
  const mcuId = new Uint8Array(payload.buffer, payload.byteOffset + pos, 8)
  pos += 8

  // ota_capable: 1 byte
  const otaCapable = view.getUint8(pos++) === 0x01

  // pin_count: 1 byte
  const pinCount = view.getUint8(pos++)

  // pins[]: per-pin capability bitmask
  const pins: PinCapability[] = []
  for (let i = 0; i < pinCount; i++) {
    pins.push({ pin: i, capabilities: view.getUint8(pos++) })
  }

  // i2c_buses: 1 byte
  const i2cBuses = view.getUint8(pos++)

  // spi_buses: 1 byte
  const spiBuses = view.getUint8(pos++)

  // uart_count: 1 byte
  const uartCount = view.getUint8(pos++)

  // max_payload: uint16 LE
  const maxPayload = view.getUint16(pos, true)
  pos += 2

  // module_count: 1 byte
  const moduleCount = view.getUint8(pos++)

  // modules[]
  const modules: ModuleDescriptor[] = []
  for (let i = 0; i < moduleCount; i++) {
    const moduleId = view.getUint8(pos++)

    let moduleName: string
    ;[moduleName, pos] = readFixedString(view, pos, 8)

    const versionMajor = view.getUint8(pos++)
    const versionMinor = view.getUint8(pos++)

    const modPinCount = view.getUint8(pos++)
    const modPins: number[] = []
    for (let p = 0; p < modPinCount; p++) {
      modPins.push(view.getUint8(pos++))
    }

    modules.push({ moduleId, name: moduleName, versionMajor, versionMinor, pins: modPins })
  }

  // datastream_count: 1 byte
  const dsCount = view.getUint8(pos++)

  // datastreams[]
  const datastreams: DatastreamDescriptor[] = []
  for (let i = 0; i < dsCount; i++) {
    let dsName: string
    ;[dsName, pos] = readFixedString(view, pos, 16)

    const dsType = view.getUint8(pos++)

    let dsUnit: string
    ;[dsUnit, pos] = readFixedString(view, pos, 8)

    const writable = view.getUint8(pos++) === 0x01
    const pinRef = view.getUint8(pos++)
    const retain = view.getUint8(pos++) === 0x01

    datastreams.push({
      index: i,
      name: dsName,
      type: dsType,
      unit: dsUnit,
      writable,
      pinRef,
      retain,
    })
  }

  return {
    firmwareName,
    firmwareVersion: [vMajor, vMinor, vPatch],
    mcuId: new Uint8Array(mcuId),
    otaCapable,
    pins,
    i2cBuses,
    spiBuses,
    uartCount,
    maxPayload,
    modules,
    datastreams,
  }
}
