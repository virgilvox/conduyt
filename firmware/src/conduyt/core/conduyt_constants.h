/**
 * CONDUYT Protocol Constants
 * Generated from protocol/constants.json — DO NOT EDIT
 *
 * CONDUYT — Configurable Open Network Device Unified Yield Transport
 * Protocol Version: 1
 */

#ifndef CONDUYT_CONSTANTS_H
#define CONDUYT_CONSTANTS_H

#include <stdint.h>

/* ── Protocol ─────────────────────────────────────────── */

#define CONDUYT_PROTOCOL_VERSION  0x01
#define CONDUYT_MAGIC_0           0x43  /* 'C' */
#define CONDUYT_MAGIC_1           0x44  /* 'D' */

/* ── Header Sizes ─────────────────────────────────────── */

#define CONDUYT_HEADER_SIZE       8  /* MAGIC(2) + VER(1) + TYPE(1) + SEQ(1) + LEN(2) + CRC(1) */
#define CONDUYT_MAGIC_SIZE        2
#define CONDUYT_CRC_SIZE          1

/* ── Host → Device Commands ───────────────────────────── */

#define CONDUYT_CMD_PING            0x01
#define CONDUYT_CMD_HELLO           0x02
#define CONDUYT_CMD_PIN_MODE        0x10
#define CONDUYT_CMD_PIN_WRITE       0x11
#define CONDUYT_CMD_PIN_READ        0x12
#define CONDUYT_CMD_PIN_SUBSCRIBE   0x13
#define CONDUYT_CMD_PIN_UNSUBSCRIBE 0x14
#define CONDUYT_CMD_I2C_WRITE       0x20
#define CONDUYT_CMD_I2C_READ        0x21
#define CONDUYT_CMD_I2C_READ_REG    0x22
#define CONDUYT_CMD_SPI_XFER        0x30
#define CONDUYT_CMD_MOD_CMD         0x40
#define CONDUYT_CMD_STREAM_START    0x50
#define CONDUYT_CMD_STREAM_STOP     0x51
#define CONDUYT_CMD_DS_WRITE        0x60
#define CONDUYT_CMD_DS_READ         0x61
#define CONDUYT_CMD_DS_SUBSCRIBE    0x62
#define CONDUYT_CMD_OTA_BEGIN       0x70
#define CONDUYT_CMD_OTA_CHUNK       0x71
#define CONDUYT_CMD_OTA_FINALIZE    0x72
#define CONDUYT_CMD_RESET           0xF0

/* ── Device → Host Events ─────────────────────────────── */

#define CONDUYT_EVT_PONG            0x80
#define CONDUYT_EVT_HELLO_RESP      0x81
#define CONDUYT_EVT_ACK             0x82
#define CONDUYT_EVT_NAK             0x83
#define CONDUYT_EVT_PIN_EVENT       0x90
#define CONDUYT_EVT_PIN_READ_RESP   0x91
#define CONDUYT_EVT_I2C_READ_RESP   0xA0
#define CONDUYT_EVT_SPI_XFER_RESP   0xB0
#define CONDUYT_EVT_MOD_EVENT       0xC0
#define CONDUYT_EVT_MOD_RESP        0xC1
#define CONDUYT_EVT_STREAM_DATA     0xD0
#define CONDUYT_EVT_DS_EVENT        0xD1
#define CONDUYT_EVT_DS_READ_RESP    0xD2
#define CONDUYT_EVT_LOG             0xE0
#define CONDUYT_EVT_FATAL           0xFF

/* ── NAK Error Codes ──────────────────────────────────── */

#define CONDUYT_ERR_UNKNOWN_TYPE         0x01
#define CONDUYT_ERR_CRC_MISMATCH         0x02
#define CONDUYT_ERR_PAYLOAD_TOO_LARGE    0x03
#define CONDUYT_ERR_INVALID_PIN          0x04
#define CONDUYT_ERR_PIN_MODE_UNSUPPORTED 0x05
#define CONDUYT_ERR_I2C_NOT_AVAILABLE    0x06
#define CONDUYT_ERR_I2C_NACK             0x07
#define CONDUYT_ERR_MODULE_NOT_LOADED    0x08
#define CONDUYT_ERR_UNKNOWN_MODULE_CMD   0x09
#define CONDUYT_ERR_MODULE_BUSY          0x0A
#define CONDUYT_ERR_SUB_LIMIT_REACHED    0x0B
#define CONDUYT_ERR_OUT_OF_MEMORY        0x0C
#define CONDUYT_ERR_UNKNOWN_DATASTREAM   0x0D
#define CONDUYT_ERR_DATASTREAM_READONLY  0x0E
#define CONDUYT_ERR_OTA_INVALID          0x0F
#define CONDUYT_ERR_VERSION_MISMATCH     0x10

/* ── Datastream Type Codes ────────────────────────────── */

#define CONDUYT_TYPE_BOOL    0x01
#define CONDUYT_TYPE_INT8    0x02
#define CONDUYT_TYPE_UINT8   0x03
#define CONDUYT_TYPE_INT16   0x04
#define CONDUYT_TYPE_UINT16  0x05
#define CONDUYT_TYPE_INT32   0x06
#define CONDUYT_TYPE_FLOAT32 0x07
#define CONDUYT_TYPE_STRING  0x08
#define CONDUYT_TYPE_BYTES   0x09

/* ── Pin Capability Bitmask ───────────────────────────── */

#define CONDUYT_PIN_CAP_DIGITAL_IN  (1 << 0)
#define CONDUYT_PIN_CAP_DIGITAL_OUT (1 << 1)
#define CONDUYT_PIN_CAP_PWM_OUT     (1 << 2)
#define CONDUYT_PIN_CAP_ANALOG_IN   (1 << 3)
#define CONDUYT_PIN_CAP_I2C_SDA     (1 << 4)
#define CONDUYT_PIN_CAP_I2C_SCL     (1 << 5)
#define CONDUYT_PIN_CAP_SPI         (1 << 6)
#define CONDUYT_PIN_CAP_INTERRUPT   (1 << 7)

/* ── Pin Modes ────────────────────────────────────────── */

#define CONDUYT_PIN_MODE_INPUT        0x00
#define CONDUYT_PIN_MODE_OUTPUT       0x01
#define CONDUYT_PIN_MODE_PWM          0x02
#define CONDUYT_PIN_MODE_ANALOG       0x03
#define CONDUYT_PIN_MODE_INPUT_PULLUP 0x04

/* ── Subscribe Modes ──────────────────────────────────── */

#define CONDUYT_SUB_CHANGE      0x01
#define CONDUYT_SUB_RISING      0x02
#define CONDUYT_SUB_FALLING     0x03
#define CONDUYT_SUB_ANALOG_POLL 0x04

#endif /* CONDUYT_CONSTANTS_H */
