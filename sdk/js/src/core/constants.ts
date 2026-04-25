/**
 * CONDUYT Protocol Constants
 * Protocol Version: 2
 * Generated from protocol/constants.json — DO NOT EDIT.
 */

export const PROTOCOL_VERSION = 0x02
export const MAGIC = new Uint8Array([0x43, 0x44]) // "CD"
export const HEADER_SIZE = 8

export const CMD = {
  PING:             0x01,
  HELLO:            0x02,
  PIN_MODE:         0x10,
  PIN_WRITE:        0x11,
  PIN_READ:         0x12,
  PIN_SUBSCRIBE:    0x13,
  PIN_UNSUBSCRIBE:  0x14,
  I2C_WRITE:        0x20,
  I2C_READ:         0x21,
  I2C_READ_REG:     0x22,
  SPI_XFER:         0x30,
  MOD_CMD:          0x40,
  STREAM_START:     0x50,
  STREAM_STOP:      0x51,
  DS_WRITE:         0x60,
  DS_READ:          0x61,
  DS_SUBSCRIBE:     0x62,
  OTA_BEGIN:        0x70,
  OTA_CHUNK:        0x71,
  OTA_FINALIZE:     0x72,
  RESET:            0xF0,
} as const

export const EVT = {
  PONG:             0x80,
  HELLO_RESP:       0x81,
  ACK:              0x82,
  NAK:              0x83,
  PIN_EVENT:        0x90,
  PIN_READ_RESP:    0x91,
  I2C_READ_RESP:    0xA0,
  SPI_XFER_RESP:    0xB0,
  MOD_EVENT:        0xC0,
  MOD_RESP:         0xC1,
  STREAM_DATA:      0xD0,
  DS_EVENT:         0xD1,
  DS_READ_RESP:     0xD2,
  LOG:              0xE0,
  FATAL:            0xFF,
} as const

export const ERR = {
  UNKNOWN_TYPE:         0x01,
  CRC_MISMATCH:         0x02,
  PAYLOAD_TOO_LARGE:    0x03,
  INVALID_PIN:          0x04,
  PIN_MODE_UNSUPPORTED: 0x05,
  I2C_NOT_AVAILABLE:    0x06,
  I2C_NACK:             0x07,
  MODULE_NOT_LOADED:    0x08,
  UNKNOWN_MODULE_CMD:   0x09,
  MODULE_BUSY:          0x0A,
  SUB_LIMIT_REACHED:    0x0B,
  OUT_OF_MEMORY:        0x0C,
  UNKNOWN_DATASTREAM:   0x0D,
  DATASTREAM_READONLY:  0x0E,
  OTA_INVALID:          0x0F,
  VERSION_MISMATCH:     0x10,
} as const

export const ERR_NAMES: Record<number, string> = {
  [ERR.UNKNOWN_TYPE]: "UNKNOWN_TYPE",
  [ERR.CRC_MISMATCH]: "CRC_MISMATCH",
  [ERR.PAYLOAD_TOO_LARGE]: "PAYLOAD_TOO_LARGE",
  [ERR.INVALID_PIN]: "INVALID_PIN",
  [ERR.PIN_MODE_UNSUPPORTED]: "PIN_MODE_UNSUPPORTED",
  [ERR.I2C_NOT_AVAILABLE]: "I2C_NOT_AVAILABLE",
  [ERR.I2C_NACK]: "I2C_NACK",
  [ERR.MODULE_NOT_LOADED]: "MODULE_NOT_LOADED",
  [ERR.UNKNOWN_MODULE_CMD]: "UNKNOWN_MODULE_CMD",
  [ERR.MODULE_BUSY]: "MODULE_BUSY",
  [ERR.SUB_LIMIT_REACHED]: "SUB_LIMIT_REACHED",
  [ERR.OUT_OF_MEMORY]: "OUT_OF_MEMORY",
  [ERR.UNKNOWN_DATASTREAM]: "UNKNOWN_DATASTREAM",
  [ERR.DATASTREAM_READONLY]: "DATASTREAM_READONLY",
  [ERR.OTA_INVALID]: "OTA_INVALID",
  [ERR.VERSION_MISMATCH]: "VERSION_MISMATCH",
}

export const DS_TYPE = {
  BOOL:     0x01,
  INT8:     0x02,
  UINT8:    0x03,
  INT16:    0x04,
  UINT16:   0x05,
  INT32:    0x06,
  FLOAT32:  0x07,
  STRING:   0x08,
  BYTES:    0x09,
} as const

/** Fixed size in bytes for each data type (-1 for variable-length) */
export const DS_TYPE_SIZE: Record<number, number> = {
  [DS_TYPE.BOOL]: 1,
  [DS_TYPE.INT8]: 1,
  [DS_TYPE.UINT8]: 1,
  [DS_TYPE.INT16]: 2,
  [DS_TYPE.UINT16]: 2,
  [DS_TYPE.INT32]: 4,
  [DS_TYPE.FLOAT32]: 4,
  [DS_TYPE.STRING]: -1,
  [DS_TYPE.BYTES]: -1,
}

export const PIN_CAP = {
  DIGITAL_IN:   1 << 0,
  DIGITAL_OUT:  1 << 1,
  PWM_OUT:      1 << 2,
  ANALOG_IN:    1 << 3,
  I2C_SDA:      1 << 4,
  I2C_SCL:      1 << 5,
  SPI:          1 << 6,
  INTERRUPT:    1 << 7,
} as const

export const PIN_MODE = {
  INPUT:          0x00,
  OUTPUT:         0x01,
  PWM:            0x02,
  ANALOG:         0x03,
  INPUT_PULLUP:   0x04,
} as const

export const SUB_MODE = {
  CHANGE:        0x01,
  RISING:        0x02,
  FALLING:       0x03,
  ANALOG_POLL:   0x04,
} as const
