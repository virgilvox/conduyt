/**
 * CONDUYT — Configurable Open Network Device Unified Yield Transport
 *
 * Top-level include for the CONDUYT firmware library.
 * Include this file in your Arduino sketch.
 *
 * Usage:
 *   #include <Conduyt.h>
 *
 *   ConduytSerial transport(Serial, 115200);
 *   ConduytDevice device("MyBoard", "1.0.0", transport);
 *
 *   void setup() {
 *     device.begin();
 *   }
 *
 *   void loop() {
 *     device.poll();
 *   }
 */

#ifndef CONDUYT_H
#define CONDUYT_H

/* Core */
#include "conduyt/core/conduyt_constants.h"
#include "conduyt/core/conduyt_types.h"
#include "conduyt/core/conduyt_crc8.h"
#include "conduyt/core/conduyt_cobs.h"
#include "conduyt/core/conduyt_wire.h"

/* Device */
#include "conduyt/ConduytBoard.h"
#include "conduyt/ConduytPayload.h"
#include "conduyt/ConduytContext.h"
#include "conduyt/ConduytModuleBase.h"
#include "conduyt/ConduytDevice.h"

/* Transport */
#include "conduyt/transport/ConduytTransport.h"
#include "conduyt/transport/ConduytSerial.h"

/* ── Optional Modules (compile-time opt-in) ───────────── */

#ifdef CONDUYT_MODULE_SERVO
#include "conduyt/modules/ConduytModuleServo.h"
#endif

#ifdef CONDUYT_MODULE_NEOPIXEL
#include "conduyt/modules/ConduytModuleNeoPixel.h"
#endif

#ifdef CONDUYT_MODULE_OLED
#include "conduyt/modules/ConduytModuleOLED.h"
#endif

#ifdef CONDUYT_MODULE_ENCODER
#include "conduyt/modules/ConduytModuleEncoder.h"
#endif

#ifdef CONDUYT_MODULE_STEPPER
#include "conduyt/modules/ConduytModuleStepper.h"
#endif

#ifdef CONDUYT_MODULE_DHT
#include "conduyt/modules/ConduytModuleDHT.h"
#endif

#ifdef CONDUYT_MODULE_PID
#include "conduyt/modules/ConduytModulePID.h"
#endif

/* ── Macro Aliases ────────────────────────────────────── */

/** Alias for CONDUYT data types in user code */
#define CONDUYT_BOOL    CONDUYT_TYPE_BOOL
#define CONDUYT_INT8    CONDUYT_TYPE_INT8
#define CONDUYT_UINT8   CONDUYT_TYPE_UINT8
#define CONDUYT_INT16   CONDUYT_TYPE_INT16
#define CONDUYT_UINT16  CONDUYT_TYPE_UINT16
#define CONDUYT_INT32   CONDUYT_TYPE_INT32
#define CONDUYT_FLOAT32 CONDUYT_TYPE_FLOAT32
#define CONDUYT_STRING  CONDUYT_TYPE_STRING
#define CONDUYT_BYTES   CONDUYT_TYPE_BYTES

#endif /* CONDUYT_H */
