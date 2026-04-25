#!/usr/bin/env -S npx tsx
/**
 * CONDUYT Protocol & Board Profile Generator
 *
 * Single source of truth: this script reads
 *   - protocol/constants.json
 *   - protocol/mcus/<family>.yml      (one per silicon family)
 *   - protocol/boards/<board>.yml     (one per board, references its MCU)
 *
 * and emits:
 *   - firmware/src/conduyt/core/conduyt_constants.h
 *   - firmware/src/conduyt/core/conduyt_crc8.h            (CRC table from polynomial)
 *   - firmware/src/conduyt/boards/board_profiles_generated.h
 *   - sdk/js/src/core/crc8.ts
 *   - sdk/python/src/conduyt/core/crc8.py
 *   - sdk/go/crc8.go
 *   - sdk/rust/src/crc8.rs
 *   - sdk/swift/Sources/ConduytKit/Core/CRC8.swift
 *   - protocol/board-profiles.json    (machine-readable for SDK consumption)
 *
 * Run: npx tsx protocol/generate.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const constants = JSON.parse(readFileSync(join(__dirname, 'constants.json'), 'utf-8'))

// ── Canonical CRC8 table (polynomial 0x31, init 0x00, MSB-first) ───────────
//
// Computed bit-by-bit at codegen time so the table can never drift out of
// sync with the documented polynomial. Self-tested below.

function crc8Bit(byte: number): number {
  let c = byte & 0xFF
  for (let i = 0; i < 8; i++) c = (c & 0x80) ? ((c << 1) ^ 0x31) & 0xFF : (c << 1) & 0xFF
  return c
}
const CRC_TABLE: number[] = []
for (let i = 0; i < 256; i++) CRC_TABLE.push(crc8Bit(i))

// Self-test: linearity + spot checks against poly 0x31 reference values.
;(() => {
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
    if (CRC_TABLE[a ^ b] !== (CRC_TABLE[a] ^ CRC_TABLE[b]))
      throw new Error('CRC table non-linear at a=' + a + ' b=' + b)
  }
  const expect = (i: number, v: number) => {
    if (CRC_TABLE[i] !== v) throw new Error(`CRC[0x${i.toString(16)}] = 0x${CRC_TABLE[i].toString(16)}, expected 0x${v.toString(16)}`)
  }
  expect(0x00, 0x00); expect(0x01, 0x31); expect(0x02, 0x62); expect(0xE0, 0xC1); expect(0xFF, 0xAC)
})()

// ── Helpers ────────────────────────────────────────────────────────────────

function hex(n: number, w = 2) { return '0x' + n.toString(16).toUpperCase().padStart(w, '0') }
function ensureDir(path: string) { if (!existsSync(path)) mkdirSync(path, { recursive: true }) }
function emit(path: string, content: string, label?: string) {
  ensureDir(dirname(path))
  writeFileSync(path, content)
  console.log(`  ${label ?? ''}${label ? ' ' : ''}→ ${path.replace(repoRoot + '/', '')}`)
}

function rowsOf(table: number[], perRow = 8, indent = '    '): string[] {
  const rows: string[] = []
  for (let i = 0; i < table.length; i += perRow) {
    rows.push(indent + table.slice(i, i + perRow).map(b => hex(b)).join(', ') + ',')
  }
  return rows
}

// ── Load YAML profiles ─────────────────────────────────────────────────────

interface McuProfile {
  id: string
  name: string
  arduino_arch_macro?: string
  mcu_id_source: string
  adc_resolution_bits?: number
  pwm_resolution_bits?: number
}

interface PinSpec {
  name: string
  caps: string[]
  adc_channel?: number
  i2c_bus?: number
  spi_bus?: number
  spi_role?: 'cs' | 'copi' | 'cipo' | 'sck'
  dac?: boolean
}

interface BoardProfile {
  id: string
  name: string
  mcu: string
  arduino_macro: string
  platformio_id: string
  pin_count: number
  i2c_buses: number
  spi_buses: number
  uart_count: number
  pins: PinSpec[]
}

const mcuDir = join(__dirname, 'mcus')
const boardDir = join(__dirname, 'boards')

const mcus: Record<string, McuProfile> = {}
if (existsSync(mcuDir)) {
  for (const f of readdirSync(mcuDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    const id = f.replace(/\.ya?ml$/, '')
    const data = parseYaml(readFileSync(join(mcuDir, f), 'utf-8')) as McuProfile
    data.id = id
    mcus[id] = data
  }
}

const boards: BoardProfile[] = []
if (existsSync(boardDir)) {
  for (const f of readdirSync(boardDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    const id = f.replace(/\.ya?ml$/, '')
    const data = parseYaml(readFileSync(join(boardDir, f), 'utf-8')) as BoardProfile
    data.id = id
    if (!mcus[data.mcu]) throw new Error(`Board ${id} references unknown MCU "${data.mcu}"`)
    if (data.pins.length !== data.pin_count)
      throw new Error(`Board ${id}: pin_count=${data.pin_count} but ${data.pins.length} pins defined`)
    boards.push(data)
  }
}

console.log(`Loaded ${Object.keys(mcus).length} MCU profile(s), ${boards.length} board profile(s).`)

// ── Cap encoding ───────────────────────────────────────────────────────────

const CAP_BIT: Record<string, number> = {}
for (const [name, info] of Object.entries(constants.pinCapabilities) as [string, any][]) {
  CAP_BIT[name.toLowerCase()] = 1 << info.bit
}

function pinCapMask(pin: PinSpec): number {
  let mask = 0
  for (const c of pin.caps) {
    const bit = CAP_BIT[c.toLowerCase()]
    if (bit === undefined) throw new Error(`Unknown capability "${c}" in pin ${pin.name}`)
    mask |= bit
  }
  return mask
}

// ── Generators ─────────────────────────────────────────────────────────────

function generateProtocolHeaderC(): string {
  const lines = [
    '/**',
    ' * CONDUYT Protocol Constants',
    ` * Protocol Version: ${constants.protocol.version}`,
    ' * Generated from protocol/constants.json — DO NOT EDIT',
    ' */',
    '',
    '#ifndef CONDUYT_CONSTANTS_H',
    '#define CONDUYT_CONSTANTS_H',
    '',
    '#include <stdint.h>',
    '',
    `#define CONDUYT_PROTOCOL_VERSION  ${hex(constants.protocol.version)}`,
    `#define CONDUYT_MAGIC_0           ${hex(constants.protocol.magic[0])}`,
    `#define CONDUYT_MAGIC_1           ${hex(constants.protocol.magic[1])}`,
    '',
    `#define CONDUYT_HEADER_SIZE       ${constants.header.totalHeaderSize}`,
    '',
    '/* Host -> Device Commands */',
  ]
  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any)
    lines.push(`#define CONDUYT_CMD_${name.toUpperCase().padEnd(18)} ${info.byte}`)
  lines.push('', '/* Device -> Host Events */')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any)
    lines.push(`#define CONDUYT_EVT_${name.toUpperCase().padEnd(18)} ${info.byte}`)
  lines.push('', '/* NAK Error Codes */')
  for (const [name, info] of Object.entries(constants.errorCodes) as any)
    lines.push(`#define CONDUYT_ERR_${name.toUpperCase().padEnd(22)} ${info.code}`)
  lines.push('', '/* Datastream Type Codes */')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`#define CONDUYT_TYPE_${name.toUpperCase().padEnd(10)} ${info.code}`)
  lines.push('', '/* Pin Capability Bitmask */')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any)
    lines.push(`#define CONDUYT_PIN_CAP_${name.toUpperCase().padEnd(14)} (1 << ${info.bit})`)
  lines.push('', '/* Pin Modes */')
  for (const [name, info] of Object.entries(constants.pinModes) as any)
    lines.push(`#define CONDUYT_PIN_MODE_${name.toUpperCase().padEnd(14)} ${info.code}`)
  lines.push('', '/* Subscribe Modes */')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any)
    lines.push(`#define CONDUYT_SUB_${name.toUpperCase().padEnd(14)} ${info.code}`)
  lines.push('', '#endif /* CONDUYT_CONSTANTS_H */', '')
  return lines.join('\n')
}

function generateCrc8C(): string {
  return [
    '/**',
    ' * CONDUYT CRC8 — polynomial 0x31, init 0x00, MSB-first.',
    ' * Generated from polynomial at codegen time — DO NOT EDIT.',
    ' *',
    ' * NOTE: CONDUYT protocol v1 shipped a corrupted table at indices 0xE0..0xFF.',
    ' * v2 (this file) ships the canonical table. v2 hosts must reject',
    ' * v1 packets with VERSION_MISMATCH (the v1 firmware needs to be re-flashed).',
    ' */',
    '',
    '#ifndef CONDUYT_CRC8_H',
    '#define CONDUYT_CRC8_H',
    '',
    '#include <stdint.h>',
    '#include <stddef.h>',
    '',
    '#ifdef __cplusplus',
    'extern "C" {',
    '#endif',
    '',
    'static const uint8_t conduyt_crc8_table[256] = {',
    ...rowsOf(CRC_TABLE, 8, '    '),
    '};',
    '',
    '/**',
    ' * Compute CRC8 (polynomial 0x31) over a buffer.',
    ' */',
    'static inline uint8_t conduyt_crc8(const uint8_t *data, size_t len) {',
    '    uint8_t crc = 0x00;',
    '    for (size_t i = 0; i < len; i++) {',
    '        crc = conduyt_crc8_table[crc ^ data[i]];',
    '    }',
    '    return crc;',
    '}',
    '',
    '#ifdef __cplusplus',
    '}',
    '#endif',
    '',
    '#endif /* CONDUYT_CRC8_H */',
    '',
  ].join('\n')
}

function generateCrc8Ts(): string {
  return [
    '/**',
    ' * CRC8 — polynomial 0x31, init 0x00.',
    ' * Generated from polynomial at codegen time — DO NOT EDIT.',
    ' */',
    '',
    'const TABLE = new Uint8Array([',
    ...rowsOf(CRC_TABLE, 8, '  '),
    '])',
    '',
    '/** Compute CRC8 over a byte array. */',
    'export function crc8(data: Uint8Array): number {',
    '  let crc = 0x00',
    '  for (let i = 0; i < data.length; i++) {',
    '    crc = TABLE[crc ^ data[i]]',
    '  }',
    '  return crc',
    '}',
    '',
  ].join('\n')
}

function generateCrc8Py(): string {
  return [
    '"""CRC8 — polynomial 0x31, init 0x00. Generated — DO NOT EDIT."""',
    '',
    '_TABLE = bytes([',
    ...rowsOf(CRC_TABLE, 8, '    '),
    '])',
    '',
    '',
    'def crc8(data: bytes | bytearray) -> int:',
    '    """Compute CRC8 over a byte sequence."""',
    '    crc = 0x00',
    '    for b in data:',
    '        crc = _TABLE[crc ^ b]',
    '    return crc',
    '',
  ].join('\n')
}

function generateCrc8Go(): string {
  return [
    '// Package conduyt — CRC8 (polynomial 0x31, init 0x00).',
    '// Generated — DO NOT EDIT.',
    'package conduyt',
    '',
    'var crc8Table = [256]byte{',
    ...rowsOf(CRC_TABLE, 8, '\t'),
    '}',
    '',
    '// CRC8 computes the polynomial-0x31 CRC8 checksum over data.',
    'func CRC8(data []byte) byte {',
    '\tvar crc byte',
    '\tfor _, b := range data {',
    '\t\tcrc = crc8Table[crc^b]',
    '\t}',
    '\treturn crc',
    '}',
    '',
  ].join('\n')
}

function generateCrc8Rust(): string {
  return [
    '//! CRC8 — polynomial 0x31, init 0x00. Generated — DO NOT EDIT.',
    '',
    'const TABLE: [u8; 256] = [',
    ...rowsOf(CRC_TABLE, 8, '    '),
    '];',
    '',
    '/// Compute CRC8 over a byte slice.',
    'pub fn crc8(data: &[u8]) -> u8 {',
    '    let mut crc: u8 = 0;',
    '    for &b in data {',
    '        crc = TABLE[(crc ^ b) as usize];',
    '    }',
    '    crc',
    '}',
    '',
    '#[cfg(test)]',
    'mod tests {',
    '    use super::*;',
    '    #[test]',
    '    fn empty_is_zero() { assert_eq!(crc8(&[]), 0); }',
    '    #[test]',
    '    fn known_values() {',
    '        assert_eq!(crc8(&[0x01]), 0x31);',
    '        assert_eq!(crc8(&[0xFF]), 0xAC);',
    '    }',
    '    #[test]',
    '    fn linear_table() {',
    '        for a in 0u8..16 { for b in 0u8..16 {',
    '            assert_eq!(TABLE[(a ^ b) as usize], TABLE[a as usize] ^ TABLE[b as usize]);',
    '        } }',
    '    }',
    '}',
    '',
  ].join('\n')
}

function generateCrc8Swift(): string {
  return [
    'import Foundation',
    '',
    '/// CRC8 — polynomial 0x31, init 0x00. Generated — DO NOT EDIT.',
    'public enum CRC8 {',
    '    private static let table: [UInt8] = [',
    ...rowsOf(CRC_TABLE, 8, '        '),
    '    ]',
    '',
    '    /// Compute CRC8 over a byte sequence.',
    '    public static func compute(_ data: [UInt8]) -> UInt8 {',
    '        var crc: UInt8 = 0',
    '        for b in data {',
    '            crc = table[Int(crc ^ b)]',
    '        }',
    '        return crc',
    '    }',
    '',
    '    /// Compute CRC8 over Data.',
    '    public static func compute(_ data: Data) -> UInt8 {',
    '        compute(Array(data))',
    '    }',
    '}',
    '',
  ].join('\n')
}

// ── SDK constants generators (one per language) ────────────────────────────
// These overwrite the previously hand-edited sdk/{js,python,go,rust,swift}
// constants files. Today's PROTOCOL_VERSION 1→2 break revealed that having
// 5 hand-edited copies of the same constants invites silent drift; owning
// them in codegen prevents that class of bug.

function generateConstantsTs(): string {
  const lines = [
    '/**',
    ' * CONDUYT Protocol Constants',
    ` * Protocol Version: ${constants.protocol.version}`,
    ' * Generated from protocol/constants.json — DO NOT EDIT.',
    ' */',
    '',
    `export const PROTOCOL_VERSION = ${hex(constants.protocol.version)}`,
    `export const MAGIC = new Uint8Array([${hex(constants.protocol.magic[0])}, ${hex(constants.protocol.magic[1])}]) // "CD"`,
    `export const HEADER_SIZE = ${constants.header.totalHeaderSize}`,
    '',
    'export const CMD = {',
  ]
  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any)
    lines.push(`  ${(name + ':').padEnd(17)} ${info.byte},`)
  lines.push('} as const', '', 'export const EVT = {')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any)
    lines.push(`  ${(name + ':').padEnd(17)} ${info.byte},`)
  lines.push('} as const', '', 'export const ERR = {')
  for (const [name, info] of Object.entries(constants.errorCodes) as any)
    lines.push(`  ${(name + ':').padEnd(21)} ${info.code},`)
  lines.push('} as const', '', 'export const ERR_NAMES: Record<number, string> = {')
  for (const [name] of Object.entries(constants.errorCodes) as any)
    lines.push(`  [ERR.${name}]: ${JSON.stringify(name)},`)
  lines.push('}', '', 'export const DS_TYPE = {')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`  ${(name + ':').padEnd(9)} ${info.code},`)
  lines.push('} as const', '', '/** Fixed size in bytes for each data type (-1 for variable-length) */', 'export const DS_TYPE_SIZE: Record<number, number> = {')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`  [DS_TYPE.${name}]: ${info.size},`)
  lines.push('}', '', 'export const PIN_CAP = {')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any)
    lines.push(`  ${(name + ':').padEnd(13)} 1 << ${info.bit},`)
  lines.push('} as const', '', 'export const PIN_MODE = {')
  for (const [name, info] of Object.entries(constants.pinModes) as any)
    lines.push(`  ${(name + ':').padEnd(15)} ${info.code},`)
  lines.push('} as const', '', 'export const SUB_MODE = {')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any)
    lines.push(`  ${(name + ':').padEnd(14)} ${info.code},`)
  lines.push('} as const', '')
  return lines.join('\n')
}

function generateConstantsPy(): string {
  const lines = [
    '"""',
    'CONDUYT Protocol Constants',
    `Protocol Version: ${constants.protocol.version}`,
    'Generated from protocol/constants.json — DO NOT EDIT.',
    '"""',
    '',
    `PROTOCOL_VERSION = ${hex(constants.protocol.version)}`,
    `MAGIC = bytes([${hex(constants.protocol.magic[0])}, ${hex(constants.protocol.magic[1])}])  # "CD"`,
    `HEADER_SIZE = ${constants.header.totalHeaderSize}`,
    '',
    '',
    'class CMD:',
  ]
  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any)
    lines.push(`    ${name.padEnd(20)} = ${info.byte}`)
  lines.push('', '', 'class EVT:')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any)
    lines.push(`    ${name.padEnd(20)} = ${info.byte}`)
  lines.push('', '', 'class ERR:')
  for (const [name, info] of Object.entries(constants.errorCodes) as any)
    lines.push(`    ${name.padEnd(20)} = ${info.code}`)
  lines.push('', '', 'ERR_NAMES: dict[int, str] = {')
  for (const [name] of Object.entries(constants.errorCodes) as any)
    lines.push(`    ERR.${name}: ${JSON.stringify(name)},`)
  lines.push('}', '', '', 'class DS_TYPE:')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`    ${name.padEnd(8)} = ${info.code}`)
  lines.push('', '', 'DS_TYPE_SIZE: dict[int, int] = {')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`    DS_TYPE.${name}: ${info.size},`)
  lines.push('}', '', '', 'class PIN_CAP:')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any)
    lines.push(`    ${name.padEnd(12)} = 1 << ${info.bit}`)
  lines.push('', '', 'class PIN_MODE:')
  for (const [name, info] of Object.entries(constants.pinModes) as any)
    lines.push(`    ${name.padEnd(14)} = ${info.code}`)
  lines.push('', '', 'class SUB_MODE:')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any)
    lines.push(`    ${name.padEnd(13)} = ${info.code}`)
  lines.push('')
  return lines.join('\n')
}

function generateConstantsGo(): string {
  // Preserve acronyms in their canonical casing so generated names match
  // the conventions used elsewhere in the Go SDK (EvtNAK, CmdI2CWrite,
  // ErrCRCMismatch). Anything not in this list gets standard PascalCase.
  // Match the existing Go SDK's hand-edited casing: DS/I2C/SPI/CRC/OTA/NAK/
  // ACK stay all-caps; MOD is a regular word ("Mod"). This is exactly the
  // mix the original constants.go used.
  const ACRONYMS = new Set(['NAK', 'ACK', 'OTA', 'DS', 'I2C', 'SPI', 'PWM', 'CRC', 'UART', 'BLE', 'JSON', 'ID'])
  function pascal(s: string) {
    return s.split('_').map(p => {
      const u = p.toUpperCase()
      return ACRONYMS.has(u) ? u : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    }).join('')
  }
  const lines = [
    '// Package conduyt — protocol constants.',
    `// Protocol Version: ${constants.protocol.version}`,
    '// Generated from protocol/constants.json — DO NOT EDIT.',
    'package conduyt',
    '',
    'const (',
    `\tProtocolVersion = ${hex(constants.protocol.version)}`,
    `\tMagic0          = ${hex(constants.protocol.magic[0])} // 'C'`,
    `\tMagic1          = ${hex(constants.protocol.magic[1])} // 'D'`,
    `\tHeaderSize      = ${constants.header.totalHeaderSize}`,
    ')',
    '',
    '// Host → Device Commands',
    'const (',
  ]
  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any)
    lines.push(`\tCmd${pascal(name)} = ${info.byte}`)
  lines.push(')', '', '// Device → Host Events', 'const (')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any)
    lines.push(`\tEvt${pascal(name)} = ${info.byte}`)
  lines.push(')', '', '// NAK Error Codes', 'const (')
  for (const [name, info] of Object.entries(constants.errorCodes) as any)
    lines.push(`\tErr${pascal(name)} = ${info.code}`)
  lines.push(')', '', '// ErrNames maps error codes to human-readable names.', 'var ErrNames = map[byte]string{')
  for (const [name] of Object.entries(constants.errorCodes) as any)
    lines.push(`\tErr${pascal(name)}: ${JSON.stringify(name)},`)
  lines.push('}', '', '// Datastream Type Codes', 'const (')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`\tDsType${pascal(name)} = ${info.code}`)
  lines.push(')', '', '// Pin Capability Bitmask', 'const (')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any)
    lines.push(`\tPinCap${pascal(name)} = 1 << ${info.bit}`)
  // Note: PinMode constants live in pin.go alongside the Pin proxy methods.
  // Don't redeclare them here.
  lines.push(')', '', '// Subscribe Modes', 'const (')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any)
    lines.push(`\tSubMode${pascal(name)} = ${info.code}`)
  lines.push(')', '')
  return lines.join('\n')
}

function generateConstantsRust(): string {
  const lines = [
    '//! CONDUYT Protocol Constants.',
    `//! Protocol Version: ${constants.protocol.version}`,
    '//! Generated from protocol/constants.json — DO NOT EDIT.',
    '',
    `pub const PROTOCOL_VERSION: u8 = ${hex(constants.protocol.version)};`,
    `pub const MAGIC: [u8; 2] = [${hex(constants.protocol.magic[0])}, ${hex(constants.protocol.magic[1])}];`,
    `pub const HEADER_SIZE: usize = ${constants.header.totalHeaderSize};`,
    '',
    '// Host → Device Commands',
  ]
  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any)
    lines.push(`pub const CMD_${name}: u8 = ${info.byte};`)
  lines.push('', '// Device → Host Events')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any)
    lines.push(`pub const EVT_${name}: u8 = ${info.byte};`)
  lines.push('', '// NAK Error Codes')
  for (const [name, info] of Object.entries(constants.errorCodes) as any)
    lines.push(`pub const ERR_${name}: u8 = ${info.code};`)
  lines.push('', '/// Get error name string from error code.', 'pub fn err_name(code: u8) -> &\'static str {', '    match code {')
  for (const [name] of Object.entries(constants.errorCodes) as any)
    lines.push(`        ERR_${name} => ${JSON.stringify(name)},`)
  lines.push('        _ => "UNKNOWN",', '    }', '}', '', '// Datastream Type Codes')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`pub const TYPE_${name}: u8 = ${info.code};`)
  lines.push('', '// Pin Capability Bitmask')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any)
    lines.push(`pub const PIN_CAP_${name}: u8 = 1 << ${info.bit};`)
  lines.push('', '// Pin Modes')
  for (const [name, info] of Object.entries(constants.pinModes) as any)
    lines.push(`pub const PIN_MODE_${name}: u8 = ${info.code};`)
  lines.push('', '// Subscribe Modes')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any)
    lines.push(`pub const SUB_${name}: u8 = ${info.code};`)
  lines.push('')
  return lines.join('\n')
}

function generateConstantsSwift(): string {
  function camel(s: string) { return s.toLowerCase().split('_').map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('') }
  const lines = [
    '// CONDUYT Protocol Constants',
    `// Protocol Version: ${constants.protocol.version}`,
    '// Generated from protocol/constants.json — DO NOT EDIT.',
    'import Foundation',
    '',
    'public enum ConduytCmd {',
  ]
  for (const [name, info] of Object.entries(constants.packetTypes.commands) as any)
    lines.push(`    public static let ${camel(name).padEnd(16)}: UInt8 = ${info.byte}`)
  lines.push('}', '', 'public enum ConduytEvt {')
  for (const [name, info] of Object.entries(constants.packetTypes.events) as any)
    lines.push(`    public static let ${camel(name).padEnd(16)}: UInt8 = ${info.byte}`)
  lines.push('}', '', 'public enum ConduytErr {')
  for (const [name, info] of Object.entries(constants.errorCodes) as any)
    lines.push(`    public static let ${camel(name).padEnd(20)}: UInt8 = ${info.code}`)
  lines.push('', '    public static func name(_ code: UInt8) -> String {', '        switch code {')
  for (const [name] of Object.entries(constants.errorCodes) as any)
    lines.push(`        case ${camel(name)}: return ${JSON.stringify(name)}`)
  lines.push('        default: return "UNKNOWN_0x\\(String(code, radix: 16))"', '        }', '    }', '}', '', 'public enum ConduytDsType {')
  for (const [name, info] of Object.entries(constants.dataTypes) as any)
    lines.push(`    public static let ${camel(name).padEnd(8)}: UInt8 = ${info.code}`)
  lines.push('}', '', 'public enum ConduytPinCap {')
  for (const [name, info] of Object.entries(constants.pinCapabilities) as any)
    lines.push(`    public static let ${camel(name).padEnd(12)}: UInt8 = 1 << ${info.bit}`)
  lines.push('}', '', 'public enum ConduytPinMode {')
  for (const [name, info] of Object.entries(constants.pinModes) as any)
    lines.push(`    public static let ${camel(name).padEnd(14)}: UInt8 = ${info.code}`)
  lines.push('}', '', 'public enum ConduytSubMode {')
  for (const [name, info] of Object.entries(constants.subscribeModes) as any)
    lines.push(`    public static let ${camel(name).padEnd(13)}: UInt8 = ${info.code}`)
  lines.push('}', '')
  return lines.join('\n')
}

function generateBoardProfilesH(): string {
  const lines = [
    '/**',
    ' * CONDUYT Board Profiles (auto-generated)',
    ' *',
    ' * Per-board capability tables. The Arduino sketch macro `ARDUINO_<board>`',
    ' * (set by the toolchain) selects which board block compiles in.',
    ' *',
    ' * For boards not listed here, a fallback profile is used (DIGITAL_IN +',
    ' * DIGITAL_OUT on every pin, no PWM/ANALOG/I2C/SPI/INTERRUPT advertised).',
    ' * Sketches can call device.declarePinCaps(pin, caps) to override.',
    ' *',
    ' * Generated from protocol/boards/*.yml + protocol/mcus/*.yml.',
    ' * DO NOT EDIT — re-run protocol/generate.ts.',
    ' */',
    '',
    '#ifndef CONDUYT_BOARD_PROFILES_GENERATED_H',
    '#define CONDUYT_BOARD_PROFILES_GENERATED_H',
    '',
    '#include <stdint.h>',
    '#include "../core/conduyt_constants.h"',
    '',
    '/* Each board block defines:',
    ' *   CONDUYT_BOARD_PROFILE_KNOWN  — set to 1 when a per-board profile matched',
    ' *   CONDUYT_BOARD_NAME           — string',
    ' *   CONDUYT_BOARD_MCU_ID_SOURCE  — token used in selecting mcu_id_<x>.cpp',
    ' *   CONDUYT_BOARD_PIN_COUNT      — uint8',
    ' *   CONDUYT_BOARD_I2C_BUSES      — uint8',
    ' *   CONDUYT_BOARD_SPI_BUSES      — uint8',
    ' *   CONDUYT_BOARD_UART_COUNT     — uint8',
    ' *   conduyt_board_pin_caps[]     — uint8 array of capability bitmasks',
    ' *   conduyt_board_adc_channel[]  — uint8 array, 0xFF if not ADC-capable',
    ' */',
    '',
  ]

  for (const board of boards) {
    const mcu = mcus[board.mcu]
    const adcArr: number[] = []
    const capArr: number[] = []
    for (const pin of board.pins) {
      capArr.push(pinCapMask(pin))
      // 0xFF sentinel = "not ADC-capable". Some cores (Teensy) encode ADC2
      // selection in bit 7, so the channel field uses the full 0..0xFE range.
      const ch = pin.adc_channel
      adcArr.push(ch === undefined || ch < 0 || ch >= 0xFF ? 0xFF : ch)
    }
    lines.push(`/* ── ${board.name} ${'─'.repeat(Math.max(2, 60 - board.name.length))} */`)
    lines.push(`#if defined(${board.arduino_macro})`)
    lines.push('')
    lines.push(`#define CONDUYT_BOARD_PROFILE_KNOWN     1`)
    lines.push(`#define CONDUYT_BOARD_NAME              "${board.name}"`)
    lines.push(`#define CONDUYT_BOARD_MCU_ID_SOURCE     ${mcu.mcu_id_source}`)
    lines.push(`#define CONDUYT_MCU_ID_SOURCE_${mcu.mcu_id_source.toUpperCase()}    1`)
    lines.push(`#define CONDUYT_BOARD_PIN_COUNT         ${board.pin_count}`)
    lines.push(`#define CONDUYT_BOARD_I2C_BUSES         ${board.i2c_buses}`)
    lines.push(`#define CONDUYT_BOARD_SPI_BUSES         ${board.spi_buses}`)
    lines.push(`#define CONDUYT_BOARD_UART_COUNT        ${board.uart_count}`)
    lines.push('')
    lines.push(`static const uint8_t conduyt_board_pin_caps[${board.pin_count}] = {`)
    for (let i = 0; i < board.pins.length; i++) {
      const pin = board.pins[i]
      lines.push(`    /* ${i.toString().padStart(2)} ${pin.name.padEnd(4)} */ ${hex(capArr[i])},`)
    }
    lines.push('};')
    lines.push('')
    lines.push(`#define CONDUYT_BOARD_ADC_NONE         0xFF`)
    lines.push(`static const uint8_t conduyt_board_adc_channel[${board.pin_count}] = {`)
    lines.push(`    ${adcArr.map(c => '0x' + c.toString(16).toUpperCase().padStart(2, '0')).join(', ')}`)
    lines.push('};')
    lines.push('')
    lines.push(`#endif /* ${board.arduino_macro} */`)
    lines.push('')
  }

  // Fallback profile when no #if matches.
  lines.push('/* ── Fallback (unknown board) ─────────────────────────────────── */')
  lines.push('#ifndef CONDUYT_BOARD_PROFILE_KNOWN')
  lines.push('#define CONDUYT_BOARD_PROFILE_KNOWN     0')
  lines.push('#define CONDUYT_BOARD_NAME              "unknown"')
  lines.push('#define CONDUYT_BOARD_MCU_ID_SOURCE     none')
  lines.push('#ifdef NUM_DIGITAL_PINS')
  lines.push('#define CONDUYT_BOARD_PIN_COUNT         NUM_DIGITAL_PINS')
  lines.push('#else')
  lines.push('#define CONDUYT_BOARD_PIN_COUNT         20')
  lines.push('#endif')
  lines.push('#define CONDUYT_BOARD_I2C_BUSES         1')
  lines.push('#define CONDUYT_BOARD_SPI_BUSES         1')
  lines.push('#define CONDUYT_BOARD_UART_COUNT        1')
  lines.push('/* No static caps array. ConduytDevice falls back to runtime probing of')
  lines.push(' * digitalPinHasPWM / digitalPinToInterrupt / etc. */')
  lines.push('#endif /* fallback */')
  lines.push('')
  lines.push('#endif /* CONDUYT_BOARD_PROFILES_GENERATED_H */')
  lines.push('')
  return lines.join('\n')
}

function generateBoardProfilesJson(): string {
  return JSON.stringify({
    generated: 'protocol/generate.ts',
    protocolVersion: constants.protocol.version,
    mcus,
    boards: boards.map(b => ({
      ...b,
      pinCaps: b.pins.map(p => pinCapMask(p)),
    })),
  }, null, 2) + '\n'
}

// ── Emit ───────────────────────────────────────────────────────────────────

console.log('Generating files:')

emit(join(repoRoot, 'firmware/src/conduyt/core/conduyt_constants.h'), generateProtocolHeaderC(), 'C constants')
emit(join(repoRoot, 'firmware/src/conduyt/core/conduyt_crc8.h'), generateCrc8C(), 'C crc8')
emit(join(repoRoot, 'firmware/src/conduyt/boards/board_profiles_generated.h'), generateBoardProfilesH(), 'C board profiles')

emit(join(repoRoot, 'sdk/js/src/core/crc8.ts'), generateCrc8Ts(), 'js crc8')
emit(join(repoRoot, 'sdk/python/src/conduyt/core/crc8.py'), generateCrc8Py(), 'py crc8')
emit(join(repoRoot, 'sdk/go/crc8.go'), generateCrc8Go(), 'go crc8')
emit(join(repoRoot, 'sdk/rust/src/crc8.rs'), generateCrc8Rust(), 'rust crc8')
emit(join(repoRoot, 'sdk/swift/Sources/ConduytKit/Core/CRC8.swift'), generateCrc8Swift(), 'swift crc8')

emit(join(repoRoot, 'sdk/js/src/core/constants.ts'), generateConstantsTs(), 'js constants')
emit(join(repoRoot, 'sdk/python/src/conduyt/core/constants.py'), generateConstantsPy(), 'py constants')
emit(join(repoRoot, 'sdk/go/constants.go'), generateConstantsGo(), 'go constants')
emit(join(repoRoot, 'sdk/rust/src/constants.rs'), generateConstantsRust(), 'rust constants')
emit(join(repoRoot, 'sdk/swift/Sources/ConduytKit/Core/Constants.swift'), generateConstantsSwift(), 'swift constants')

emit(join(repoRoot, 'protocol/board-profiles.json'), generateBoardProfilesJson(), 'board profiles JSON')

console.log('Done.')
