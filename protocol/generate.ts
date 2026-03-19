#!/usr/bin/env -S npx tsx
/**
 * CONDUYT Protocol Constant Generator
 *
 * Reads constants.json and emits typed constant files for all languages.
 * Run: npx tsx protocol/generate.ts
 *
 * Currently generates: C header (conduyt_constants.h), TypeScript (constants.ts)
 * Future: Python, Go, Rust, Swift
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const constants = JSON.parse(readFileSync(join(__dirname, 'constants.json'), 'utf-8'))

function hex(s: string): number { return parseInt(s, 16) }

// ── C Header ──────────────────────────────────────────────

function generateC(): string {
  const lines: string[] = [
    '/**',
    ' * CONDUYT Protocol Constants',
    ' * Generated from protocol/constants.json — DO NOT EDIT',
    ' */',
    '',
    '#ifndef CONDUYT_CONSTANTS_H',
    '#define CONDUYT_CONSTANTS_H',
    '',
    '#include <stdint.h>',
    '',
    `#define CONDUYT_PROTOCOL_VERSION  ${constants.protocol.version}`,
    `#define CONDUYT_MAGIC_0           0x${constants.protocol.magic[0].toString(16).toUpperCase()}`,
    `#define CONDUYT_MAGIC_1           0x${constants.protocol.magic[1].toString(16).toUpperCase()}`,
    '',
    `#define CONDUYT_HEADER_SIZE       ${constants.header.totalHeaderSize}`,
    '',
    '/* Host → Device Commands */',
  ]

  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any) {
    lines.push(`#define CONDUYT_CMD_${name.toUpperCase().padEnd(18)} ${info.byte}`)
  }

  lines.push('', '/* Device → Host Events */')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any) {
    lines.push(`#define CONDUYT_EVT_${name.toUpperCase().padEnd(18)} ${info.byte}`)
  }

  lines.push('', '/* NAK Error Codes */')
  for (const [name, info] of Object.entries(constants.errorCodes) as any) {
    lines.push(`#define CONDUYT_ERR_${name.toUpperCase().padEnd(22)} ${info.code}`)
  }

  lines.push('', '/* Datastream Type Codes */')
  for (const [name, info] of Object.entries(constants.dataTypes) as any) {
    lines.push(`#define CONDUYT_TYPE_${name.toUpperCase().padEnd(10)} ${info.code}`)
  }

  lines.push('', '/* Pin Capability Bitmask */')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any) {
    lines.push(`#define CONDUYT_PIN_CAP_${name.toUpperCase().padEnd(14)} (1 << ${info.bit})`)
  }

  lines.push('', '/* Pin Modes */')
  for (const [name, info] of Object.entries(constants.pinModes) as any) {
    lines.push(`#define CONDUYT_PIN_MODE_${name.toUpperCase().padEnd(14)} ${info.code}`)
  }

  lines.push('', '/* Subscribe Modes */')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any) {
    lines.push(`#define CONDUYT_SUB_${name.toUpperCase().padEnd(14)} ${info.code}`)
  }

  lines.push('', '#endif /* CONDUYT_CONSTANTS_H */', '')
  return lines.join('\n')
}

// ── Write files ───────────────────────────────────────────

const cHeader = generateC()
const cPath = join(__dirname, '..', 'firmware', 'src', 'conduyt', 'core', 'conduyt_constants.h')
writeFileSync(cPath, cHeader)
console.log(`Generated: ${cPath}`)

console.log('Done.')
