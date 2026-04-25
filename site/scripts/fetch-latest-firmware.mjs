#!/usr/bin/env node
/**
 * Build-time firmware sync.
 *
 * Fetches the artifacts from the latest CONDUYT GitHub release and places
 * them under site/public/firmware/. Runs as a `prebuild` / `pregenerate`
 * hook so DO (or any host) gets the freshest firmware on every deploy
 * without committing large binaries to the repo.
 *
 * Why not fetch at runtime: GitHub release assets redirect to
 * release-assets.githubusercontent.com which sets no `Access-Control-Allow-Origin`,
 * so browser fetch() from conduyt.io gets CORS-blocked. Build-time fetch
 * sidesteps that — files are served same-origin.
 *
 * Skips itself if FIRMWARE_FETCH_SKIP=1 (useful for local dev when you
 * don't want to network-fetch on every nuxt build).
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIRMWARE_DIR = join(__dirname, '..', 'public', 'firmware')
const REPO = 'virgilvox/conduyt'

if (process.env.FIRMWARE_FETCH_SKIP === '1') {
  console.log('[firmware] FIRMWARE_FETCH_SKIP=1 — skipping fetch')
  process.exit(0)
}

mkdirSync(FIRMWARE_DIR, { recursive: true })

async function getLatestRelease() {
  const headers = { 'User-Agent': 'conduyt-site-build', Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers })
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  return res.json()
}

async function downloadAsset(asset) {
  const res = await fetch(asset.browser_download_url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`download ${asset.name}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const dest = join(FIRMWARE_DIR, asset.name)
  writeFileSync(dest, buf)
  return { name: asset.name, bytes: buf.length, dest }
}

const start = Date.now()
let release
try {
  release = await getLatestRelease()
} catch (e) {
  // Don't break the site build over a missing/unreleased version.
  // Existing local firmware/ contents (if any) will be served.
  console.warn(`[firmware] could not fetch latest release: ${e.message}`)
  console.warn('[firmware] continuing with whatever is already in public/firmware/')
  process.exit(0)
}

console.log(`[firmware] latest release: ${release.tag_name} (${release.assets.length} assets)`)

// Only mirror firmware-shaped artifacts. Skip the library zip and stray .elf debug symbols.
const wanted = release.assets.filter(a =>
  /^conduyt-.*\.(bin|hex|uf2)$/.test(a.name)
)

const results = []
for (const asset of wanted) {
  try {
    const r = await downloadAsset(asset)
    results.push(r)
    console.log(`  ✓ ${r.name} (${(r.bytes / 1024).toFixed(1)} KB)`)
  } catch (e) {
    console.warn(`  ✗ ${asset.name}: ${e.message}`)
  }
}

// Sync manifest "version" fields to whatever release we just pulled. The
// version string is purely informational (esp-web-tools dispatches by
// chipFamily + parts paths, not by version), but stale labels misled us
// twice — easier to keep them honest from the source of truth.
const semver = (release.tag_name || '').replace(/^v/, '')
if (semver) {
  for (const f of readdirSync(FIRMWARE_DIR)) {
    if (!/^manifest.*\.json$/.test(f)) continue
    const path = join(FIRMWARE_DIR, f)
    try {
      const m = JSON.parse(readFileSync(path, 'utf-8'))
      if (m.version !== semver) {
        m.version = semver
        writeFileSync(path, JSON.stringify(m, null, 2) + '\n')
        console.log(`  ↻ ${f} version → ${semver}`)
      }
    } catch (e) {
      console.warn(`  ✗ ${f}: ${e.message}`)
    }
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`[firmware] fetched ${results.length}/${wanted.length} files in ${elapsed}s → ${FIRMWARE_DIR}`)
