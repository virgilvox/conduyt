/**
 * CONDUYT Error Types
 */

import { ERR_NAMES } from './constants.js'

/**
 * Thrown when the device replies with a NAK packet.
 * Contains the error code, human-readable name, and the SEQ of the rejected command.
 */
export class ConduytNAKError extends Error {
  readonly code: number
  readonly errorName: string
  readonly seq: number

  constructor(code: number, seq: number) {
    const name = ERR_NAMES[code] ?? `UNKNOWN_ERROR_0x${code.toString(16).padStart(2, '0')}`
    super(`NAK: ${name} (code=0x${code.toString(16).padStart(2, '0')}, seq=${seq})`)
    this.name = 'ConduytNAKError'
    this.code = code
    this.errorName = name
    this.seq = seq
  }
}

/**
 * Thrown when a command does not receive ACK/NAK within the timeout period.
 */
export class ConduytTimeoutError extends Error {
  readonly seq: number
  readonly timeoutMs: number

  constructor(seq: number, timeoutMs: number) {
    super(`Timeout: no response for seq=${seq} after ${timeoutMs}ms`)
    this.name = 'ConduytTimeoutError'
    this.seq = seq
    this.timeoutMs = timeoutMs
  }
}

/**
 * Thrown when an operation is attempted on a disconnected device.
 */
export class ConduytDisconnectedError extends Error {
  constructor(message = 'Device is not connected') {
    super(message)
    this.name = 'ConduytDisconnectedError'
  }
}

/**
 * Thrown when a capability check fails (e.g., calling i2c() on a device with no I2C).
 */
export class ConduytCapabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConduytCapabilityError'
  }
}

/**
 * Thrown on wire format errors (bad magic, CRC mismatch, etc.)
 */
export class ConduytWireError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConduytWireError'
  }
}
