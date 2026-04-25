<template>
  <div class="panel-overlay">
    <div class="panel-shell">
      <header class="panel-head">
        <div class="brand">
          <span class="dot" :class="{ on: connected }" />
          <span class="title">CONDUYT PANEL</span>
        </div>
        <div class="meta">
          <span class="meta-item">device <b>{{ caps?.firmwareName || '--' }}</b></span>
          <span class="meta-item">pins <b>{{ caps?.pinCount ?? '--' }}</b></span>
          <span class="meta-item">i2c <b>{{ caps?.i2cBuses ?? '--' }}</b></span>
          <span class="meta-item">spi <b>{{ caps?.spiBuses ?? '--' }}</b></span>
          <span class="meta-item live">widgets <b>{{ widgets.length }}</b></span>
        </div>
        <label class="permissive" title="Bind widgets to any pin even if the firmware profile doesn't declare the capability. Useful for under-declared boards.">
          <input type="checkbox" v-model="permissive" />
          Permissive
        </label>
        <button class="close-btn" @click="$emit('close')" title="Close panel">×</button>
      </header>

      <section class="add-bar">
        <span class="add-label">Add widget</span>
        <button
          v-for="t in widgetTypes"
          :key="t.type"
          class="add-btn"
          :disabled="!connected || compatPins(t.cap).length === 0"
          :title="addBtnTitle(t)"
          @click="addWidget(t.type)"
        >
          <span class="plus">+</span>{{ t.label }}
        </button>
        <button class="add-btn danger" :disabled="!widgets.length" @click="clearAll" title="Remove all widgets">
          <span class="plus">×</span>Clear all
        </button>
      </section>

      <section class="dashboard" v-if="widgets.length">
        <div
          v-for="w in widgets"
          :key="w.id"
          class="widget"
          :class="[w.kind, { firing: w.firing, active: connected }]"
        >
          <div class="w-head">
            <span class="w-kind" :class="w.kind">{{ specOf(w.type).label }}</span>
            <button class="w-remove" @click="removeWidget(w.id)" title="Remove">×</button>
          </div>

          <div class="w-title-row">
            <input class="w-title" v-model="w.title" :maxlength="40" />
          </div>

          <div class="w-pin-row">
            <label>PIN</label>
            <select class="pin-select" v-model.number="w.pin" :disabled="!connected" @change="onPinChange(w)">
              <option v-for="p in compatPins(specOf(w.type).cap, w.pin)" :key="p.pin" :value="p.pin">
                {{ pinLabel(p.pin) }}
              </option>
            </select>
          </div>

          <div class="w-body">
            <!-- Digital switch -->
            <button
              v-if="w.type === 'switch'"
              class="ctrl-switch"
              :class="{ on: !!w.value }"
              :disabled="!connected"
              @click="toggleSwitch(w)"
            >
              <span class="knob" />
              <span class="lbl off">OFF</span>
              <span class="lbl on-lbl">ON</span>
            </button>

            <!-- Momentary push button -->
            <button
              v-else-if="w.type === 'momentary'"
              class="ctrl-button"
              :class="{ pressed: !!w.value }"
              :disabled="!connected"
              @pointerdown.prevent="momentaryDown(w)"
              @pointerup="momentaryUp(w)"
              @pointerleave="momentaryUp(w)"
              @pointercancel="momentaryUp(w)"
            >PRESS</button>

            <!-- PWM slider -->
            <div v-else-if="w.type === 'slider'" class="ctrl-slider-wrap">
              <div class="ctrl-slider-val">{{ w.value }}</div>
              <input
                class="ctrl-slider"
                type="range"
                min="0"
                max="255"
                :value="w.value"
                :disabled="!connected"
                @input="onSlider(w, ($event.target as HTMLInputElement).value)"
              />
              <div class="ctrl-slider-scale"><span>0</span><span>128</span><span>255</span></div>
            </div>

            <!-- LED indicator -->
            <div v-else-if="w.type === 'led'" class="ctrl-led" :class="{ on: !!w.value }" />

            <!-- Analog gauge -->
            <div v-else-if="w.type === 'gauge'" class="ctrl-gauge">
              <div class="ctrl-gauge-val">{{ w.value ?? '--' }}</div>
              <div class="ctrl-gauge-sub">0 – 1023</div>
              <div class="ctrl-gauge-bar">
                <div class="ctrl-gauge-fill" :style="{ width: gaugePct(w.value) + '%' }" />
              </div>
            </div>

            <!-- Pin scope -->
            <div v-else-if="w.type === 'scope'" class="ctrl-scope">
              <canvas :ref="(el) => bindScopeCanvas(w.id, el as HTMLCanvasElement | null)" width="280" height="80" />
              <div class="ctrl-scope-readout">
                <span>VALUE <b>{{ w.value ?? '--' }}</b></span>
                <span>PEAK <b>{{ w.extra?.peak ?? '--' }}</b></span>
              </div>
            </div>

            <div v-else class="w-body-disabled">UNKNOWN WIDGET TYPE</div>
          </div>

          <div class="w-foot">
            <span>{{ specOf(w.type).mode.toUpperCase() }}</span>
            <span class="val">{{ formatValue(w) }}</span>
          </div>
        </div>
      </section>

      <section v-else class="empty-state">
        <div class="empty-text">NO WIDGETS</div>
        <div class="empty-sub">Connect a board, then add widgets above. Each widget binds to a pin and is filtered by the board's declared capabilities.</div>
      </section>

      <section class="console-strip">
        <div class="console-head">
          <span>CONSOLE</span>
          <button class="console-clear" @click="logs = []">CLEAR</button>
        </div>
        <div class="console-log" ref="logEl">
          <div v-for="(l, i) in logs" :key="i" class="line" :class="l.level">
            <span class="ts">{{ l.ts }}</span>{{ l.text }}
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ConduytDevice, PIN_CAP, type HelloResp, type PinCap } from '~/lib/conduyt-device'
import { useSerial } from '~/composables/useSerial'

type Serial = ReturnType<typeof useSerial>
type WidgetType = 'switch' | 'momentary' | 'slider' | 'led' | 'gauge' | 'scope'

interface Widget {
  id: number
  type: WidgetType
  pin: number
  title: string
  value: number | null
  firing: boolean
  kind: 'input' | 'output'
  extra: { peak?: number; buf?: (number | null)[] }
}

interface WidgetSpec {
  type: WidgetType
  label: string
  kind: 'input' | 'output'
  mode: 'output' | 'pwm' | 'input_pullup' | 'analog'
  cap: keyof typeof PIN_CAP
  pollMs: number
}

const props = defineProps<{
  serial: Serial
  capabilities: HelloResp | null
}>()

const emit = defineEmits<{
  close: []
  capabilities: [caps: HelloResp]
}>()

const widgetTypes: WidgetSpec[] = [
  { type: 'switch',    label: 'DIGITAL SWITCH', kind: 'output', mode: 'output',       cap: 'DIGITAL_OUT', pollMs: 0   },
  { type: 'momentary', label: 'PUSH BUTTON',    kind: 'output', mode: 'output',       cap: 'DIGITAL_OUT', pollMs: 0   },
  { type: 'slider',    label: 'PWM SLIDER',     kind: 'output', mode: 'pwm',          cap: 'PWM_OUT',     pollMs: 0   },
  { type: 'led',       label: 'LED INDICATOR',  kind: 'input',  mode: 'input_pullup', cap: 'DIGITAL_IN',  pollMs: 100 },
  { type: 'gauge',     label: 'ANALOG GAUGE',   kind: 'input',  mode: 'analog',       cap: 'ANALOG_IN',   pollMs: 200 },
  { type: 'scope',     label: 'PIN SCOPE',      kind: 'input',  mode: 'analog',       cap: 'ANALOG_IN',   pollMs: 50  },
]

function specOf(type: WidgetType): WidgetSpec {
  return widgetTypes.find(t => t.type === type)!
}

const STORAGE_KEY = 'conduyt-panel-widgets-v2'

const widgets = ref<Widget[]>([])
const nextId = ref(1)
const permissive = ref(false)
const connected = computed(() => props.serial.connected.value)
const caps = ref<HelloResp | null>(props.capabilities)
const logs = ref<{ ts: string; text: string; level: '' | 'ok' | 'err' | 'sig' }[]>([])
const logEl = ref<HTMLElement | null>(null)
const scopeCanvases = new Map<number, HTMLCanvasElement>()

let device: ConduytDevice | null = null
type PollLoop = { stop: boolean; errored: boolean; timerId: ReturnType<typeof setTimeout> | null }
const polls = new Map<number, PollLoop>()

function ts() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}
function log(text: string, level: '' | 'ok' | 'err' | 'sig' = '') {
  logs.value.push({ ts: ts(), text, level })
  if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200)
  nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight })
}

// ── Capability filtering ─────────────────────────────────────────────────
function pinSupports(p: PinCap | undefined, capName: keyof typeof PIN_CAP): boolean {
  if (!p) return false
  return (p.capabilities & PIN_CAP[capName]) !== 0
}

function compatPins(capName: keyof typeof PIN_CAP, includePin?: number): PinCap[] {
  const c = caps.value
  if (!c?.pins?.length) return []
  if (permissive.value) return c.pins
  const strict = c.pins.filter(p => pinSupports(p, capName))
  // Always include the widget's currently-bound pin so the dropdown can render it
  // even if it lost compatibility (e.g. user toggled permissive).
  if (includePin !== undefined && !strict.some(p => p.pin === includePin)) {
    const extra = c.pins.find(p => p.pin === includePin)
    if (extra) return [...strict, extra]
  }
  return strict
}

function firstCompat(capName: keyof typeof PIN_CAP): number | null {
  const list = compatPins(capName)
  return list.length ? list[0].pin : null
}

function pinLabel(n: number): string {
  return `pin ${n}`
}

function addBtnTitle(spec: WidgetSpec): string {
  if (!connected.value) return 'Connect a device first'
  const compat = compatPins(spec.cap).length
  return compat === 0
    ? `No pins on this firmware advertise ${spec.cap}.`
    : `Add ${spec.label.toLowerCase()} (${compat} compatible pin${compat === 1 ? '' : 's'})`
}

// ── Device lifecycle ────────────────────────────────────────────────────
async function ensureDevice() {
  if (!connected.value || device) return
  try {
    const d = new ConduytDevice(props.serial)
    const c = await d.connect()
    device = d
    caps.value = c
    emit('capabilities', c)
    const sum = ['DIGITAL_OUT', 'DIGITAL_IN', 'PWM_OUT', 'ANALOG_IN'] as const
    const summary = sum.map(k => `${k}=${c.pins.filter(p => (p.capabilities & PIN_CAP[k]) !== 0).length}`).join(' ')
    log(`connected: ${c.firmwareName} v${c.firmwareVersion.join('.')} (pins=${c.pinCount} ${summary})`, 'ok')
    if (c.pins.filter(p => (p.capabilities & PIN_CAP.ANALOG_IN) !== 0).length === 0) {
      log('warning: firmware declared 0 ANALOG_IN pins. Toggle Permissive if your board has ADC.', 'err')
    }
    // Drop any restored widgets that bind to a pin this board doesn't have
    // (e.g. switching from ESP32 with pin 32 back to an Uno R3 with pins 0–19).
    const validPins = new Set(c.pins.map(p => p.pin))
    const stale = widgets.value.filter(w => !validPins.has(w.pin))
    if (stale.length) {
      for (const w of stale) {
        log(`removed widget bound to nonexistent pin ${w.pin} (${w.title})`, 'err')
        removeWidget(w.id)
      }
    }
    // Restart polling for any input widgets
    for (const w of widgets.value) {
      const spec = specOf(w.type)
      if (spec.kind === 'input') {
        await setPinMode(w).catch(() => {})
        startPoll(w)
      } else {
        await setPinMode(w).catch(() => {})
      }
    }
  } catch (e: any) {
    log(`connect failed: ${e.message ?? e}`, 'err')
  }
}

async function teardownDevice() {
  for (const [, p] of polls) p.stop = true
  polls.clear()
  await device?.close()
  device = null
}

watch(connected, (now, was) => {
  if (now && !was) ensureDevice()
  else if (!now && was) {
    log('disconnected')
    teardownDevice()
  }
})

// ── Widget management ───────────────────────────────────────────────────
function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed?.widgets?.length) return
    nextId.value = parsed.nextId || 1
    for (const w of parsed.widgets) {
      const spec = specOf(w.type)
      widgets.value.push({
        id: nextId.value++,
        type: w.type,
        pin: w.pin,
        title: w.title || spec.label,
        value: w.value ?? (spec.kind === 'output' ? 0 : null),
        firing: false,
        kind: spec.kind,
        extra: { buf: spec.type === 'scope' ? Array(120).fill(null) : undefined, peak: 0 },
      })
    }
    log(`restored ${widgets.value.length} widget(s)`)
  } catch {}
}

function saveStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      widgets: widgets.value.map(w => ({
        type: w.type, pin: w.pin, title: w.title,
        value: w.type === 'slider' ? w.value : 0,
      })),
      nextId: nextId.value,
    }))
  } catch {}
}

function addWidget(type: WidgetType) {
  const spec = specOf(type)
  const pin = firstCompat(spec.cap)
  if (pin === null) {
    log(`no ${spec.cap} pins available`, 'err')
    return
  }
  const w: Widget = {
    id: nextId.value++,
    type,
    pin,
    title: spec.label.charAt(0) + spec.label.slice(1).toLowerCase(),
    value: spec.kind === 'output' ? 0 : null,
    firing: false,
    kind: spec.kind,
    extra: { buf: type === 'scope' ? Array(120).fill(null) : undefined, peak: 0 },
  }
  widgets.value.push(w)
  saveStored()
  if (connected.value) {
    setPinMode(w).then(() => { if (spec.kind === 'input') startPoll(w) }).catch(() => {})
  }
}

function removeWidget(id: number) {
  const idx = widgets.value.findIndex(w => w.id === id)
  if (idx < 0) return
  stopPoll(id)
  scopeCanvases.delete(id)
  widgets.value.splice(idx, 1)
  saveStored()
}

function clearAll() {
  if (!widgets.value.length) return
  if (!confirm('Remove all widgets?')) return
  for (const w of [...widgets.value]) removeWidget(w.id)
}

async function onPinChange(w: Widget) {
  stopPoll(w.id)
  saveStored()
  if (connected.value) {
    await setPinMode(w).catch(() => {})
    if (w.kind === 'input') startPoll(w)
  }
}

async function setPinMode(w: Widget) {
  if (!device) return
  const spec = specOf(w.type)
  try {
    await device.pin(w.pin).mode(spec.mode)
  } catch (e: any) {
    log(`mode ${spec.mode} on pin ${w.pin}: ${e.message ?? e}`, 'err')
  }
}

// ── Output widgets ──────────────────────────────────────────────────────
async function toggleSwitch(w: Widget) {
  if (!device) return
  const next = w.value ? 0 : 1
  try {
    await device.pin(w.pin).mode('output')
    await device.pin(w.pin).write(next)
    w.value = next
    w.firing = !!next
    log(`switch pin ${w.pin} -> ${next}`, 'sig')
    saveStored()
  } catch (e: any) {
    log(`switch pin ${w.pin}: ${e.message ?? e}`, 'err')
  }
}

async function momentaryDown(w: Widget) {
  if (!device || w.value === 1) return
  w.value = 1; w.firing = true
  try {
    await device.pin(w.pin).mode('output')
    await device.pin(w.pin).write(1)
    log(`button pin ${w.pin} down`, 'sig')
  } catch (e: any) { log(`button pin ${w.pin}: ${e.message ?? e}`, 'err') }
}
async function momentaryUp(w: Widget) {
  if (w.value === 0) return
  // Reset visual state regardless of device availability so the card
  // doesn't stay stuck "pressed" if the user disconnects mid-press.
  w.value = 0; w.firing = false
  if (!device) return
  try { await device.pin(w.pin).write(0) }
  catch (e: any) { log(`button pin ${w.pin}: ${e.message ?? e}`, 'err') }
}

const sliderPending = new Map<number, number>()
const sliderInflight = new Set<number>()
async function flushSlider(w: Widget) {
  if (!device || sliderInflight.has(w.id)) return
  const v = sliderPending.get(w.id)
  if (v === undefined) return
  sliderPending.delete(w.id)
  sliderInflight.add(w.id)
  try {
    await device.pin(w.pin).write(v)
    w.value = v
    w.firing = v > 0
  } catch (e: any) {
    log(`slider pin ${w.pin}: ${e.message ?? e}`, 'err')
  } finally {
    sliderInflight.delete(w.id)
    if (sliderPending.has(w.id)) flushSlider(w)
  }
}
function onSlider(w: Widget, raw: string) {
  const v = parseInt(raw, 10) || 0
  w.value = v
  if (!device) return
  sliderPending.set(w.id, v)
  flushSlider(w)
}

// ── Input polling ───────────────────────────────────────────────────────
function startPoll(w: Widget) {
  const spec = specOf(w.type)
  if (spec.kind !== 'input' || spec.pollMs <= 0 || !device) return
  stopPoll(w.id)
  const loop: { stop: boolean; errored: boolean; timerId: ReturnType<typeof setTimeout> | null } = {
    stop: false, errored: false, timerId: null,
  }
  polls.set(w.id, loop)
  const tick = async () => {
    if (loop.stop || !device) return
    try {
      const v = await device.pin(w.pin).read()
      applyInput(w, v)
    } catch (e: any) {
      if (!loop.errored) { log(`read pin ${w.pin}: ${e.message ?? e}`, 'err'); loop.errored = true }
      w.firing = false
    }
    if (!loop.stop) loop.timerId = setTimeout(tick, spec.pollMs)
  }
  tick()
}
function stopPoll(id: number) {
  const loop = polls.get(id)
  if (loop) {
    loop.stop = true
    if (loop.timerId) clearTimeout(loop.timerId)
    polls.delete(id)
  }
}

function applyInput(w: Widget, v: number) {
  w.value = v
  if (w.type === 'led') {
    w.firing = !!v
  } else if (w.type === 'gauge') {
    w.firing = true
  } else if (w.type === 'scope') {
    if (!w.extra.buf) w.extra.buf = Array(120).fill(null)
    w.extra.buf.push(v)
    if (w.extra.buf.length > 120) w.extra.buf.shift()
    if (v > (w.extra.peak ?? 0)) w.extra.peak = v
    w.firing = true
    drawScope(w)
  }
}

function bindScopeCanvas(id: number, el: HTMLCanvasElement | null) {
  if (!el) { scopeCanvases.delete(id); return }
  scopeCanvases.set(id, el)
}

function drawScope(w: Widget) {
  const canvas = scopeCanvases.get(w.id)
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = '#0a0a10'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(0,212,170,0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.strokeStyle = '#00d4aa'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const buf = w.extra.buf || []
  const step = W / buf.length
  let started = false
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]
    if (v === null || v === undefined) continue
    const y = H - (Math.min(v, 1023) / 1023) * (H - 4) - 2
    const x = i * step
    if (!started) { ctx.moveTo(x, y); started = true } else { ctx.lineTo(x, y) }
  }
  ctx.stroke()
}

// ── Format helpers ──────────────────────────────────────────────────────
function gaugePct(v: number | null) {
  if (v === null || v === undefined) return 0
  return Math.min(100, Math.max(0, (v / 1023) * 100))
}
function formatValue(w: Widget): string {
  const v = w.value
  if (v === null || v === undefined) return '--'
  if (w.type === 'switch' || w.type === 'momentary' || w.type === 'led') return v ? 'HIGH' : 'LOW'
  return String(v)
}

// ── Toolbar permissive toggle re-renders pin lists naturally via computed. ─
watch(permissive, () => log(`permissive ${permissive.value ? 'ON' : 'OFF'}`))

// ── Mount/unmount ───────────────────────────────────────────────────────
onMounted(() => {
  loadStored()
  if (connected.value) ensureDevice()
})

onBeforeUnmount(async () => {
  for (const [, p] of polls) p.stop = true
  polls.clear()
  scopeCanvases.clear()
  await device?.close()
  device = null
})
</script>

<style scoped>
.panel-overlay {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 44px; /* leave room for the toolbar at the bottom */
  background: var(--bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  gap: 12px;
}

/* Header */
.panel-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.brand { display: flex; align-items: center; gap: 10px; }
.brand .title { font-family: var(--mono); font-weight: 600; letter-spacing: 0.15em; color: var(--text-bright); font-size: 13px; }
.brand .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); }
.brand .dot.on { background: var(--accent); box-shadow: 0 0 10px var(--accent-glow); }

.meta { display: flex; gap: 14px; flex-wrap: wrap; }
.meta-item {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-dim);
  white-space: nowrap;
}
.meta-item b { color: var(--text-bright); font-weight: 500; margin-left: 4px; }
.meta-item.live b { color: var(--accent); }

.permissive {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-dim);
  cursor: pointer;
  user-select: none;
}
.permissive input { accent-color: var(--accent); width: 13px; height: 13px; }

.close-btn {
  background: transparent;
  border: 1px solid var(--border-bright);
  color: var(--text-dim);
  font-size: 18px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
}
.close-btn:hover { color: var(--red); border-color: var(--red); }

/* Add bar */
.add-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}
.add-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-right: 4px;
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--card);
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.add-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.add-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.add-btn .plus { color: var(--accent); font-weight: 700; }
.add-btn:disabled .plus { color: var(--text-dim); }
.add-btn.danger { margin-left: auto; }
.add-btn.danger:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
.add-btn.danger .plus { color: var(--red); }

/* Dashboard grid */
.dashboard {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
  align-content: start;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--surface);
  border: 1px dashed var(--border-bright);
  border-radius: var(--radius);
  padding: 40px;
  color: var(--text-dim);
  text-align: center;
}
.empty-text {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
}
.empty-sub { font-size: 12px; max-width: 480px; line-height: 1.55; }

/* Widget card */
.widget {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 220px;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.widget.active { border-color: var(--border-bright); }
.widget.firing.input { box-shadow: 0 0 24px var(--accent-glow); border-color: var(--accent); }
.widget.firing.output { box-shadow: 0 0 24px rgba(226,101,58,0.25); border-color: var(--orange); }

.w-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
  border-radius: var(--radius) var(--radius) 0 0;
}
.w-kind {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.w-kind.input { color: var(--accent); }
.w-kind.output { color: var(--orange); }
.w-remove {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.w-remove:hover { color: var(--red); }

.w-title-row { padding: 10px 12px 4px; }
.w-title {
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-bright);
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 500;
  padding: 4px 6px;
  margin-left: -6px;
  border-radius: 3px;
}
.w-title:hover { border-color: var(--border); }
.w-title:focus { outline: none; border-color: var(--accent); background: var(--accent-dim); }

.w-pin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 10px;
  border-bottom: 1px solid var(--border);
}
.w-pin-row label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.pin-select {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--border-bright);
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 3px;
}
.pin-select:focus { outline: none; border-color: var(--accent); }
.pin-select:disabled { opacity: 0.4; }

.w-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
}
.w-body-disabled {
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.w-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: var(--card);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-dim);
  border-radius: 0 0 var(--radius) var(--radius);
}
.w-foot .val { color: var(--accent); font-size: 12px; letter-spacing: 0.05em; }

/* Switch */
.ctrl-switch {
  position: relative;
  width: 110px;
  height: 54px;
  border: 1px solid var(--border-bright);
  background: var(--card);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.ctrl-switch:disabled { opacity: 0.4; cursor: not-allowed; }
.ctrl-switch .knob {
  position: absolute;
  top: 4px; left: 4px;
  width: 44px; height: 44px;
  background: var(--text-dim);
  border-radius: 3px;
  transition: left 0.16s, background 0.16s, box-shadow 0.16s;
}
.ctrl-switch.on { background: rgba(0,212,170,0.1); border-color: var(--accent); }
.ctrl-switch.on .knob { left: 60px; background: var(--accent); box-shadow: 0 0 16px var(--accent-glow); }
.ctrl-switch .lbl {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--text-dim);
}
.ctrl-switch .lbl.off { left: 12px; color: var(--text-bright); }
.ctrl-switch .lbl.on-lbl { right: 12px; color: var(--text-dim); }
.ctrl-switch.on .lbl.off { color: var(--text-dim); }
.ctrl-switch.on .lbl.on-lbl { color: var(--accent); }

/* Momentary */
.ctrl-button {
  width: 110px;
  height: 110px;
  border: 2px solid var(--border-bright);
  background: var(--card);
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--text-dim);
  user-select: none;
  touch-action: none;
  transition: all 0.08s;
}
.ctrl-button:disabled { opacity: 0.4; cursor: not-allowed; }
.ctrl-button.pressed {
  background: var(--orange);
  color: var(--bg);
  border-color: var(--orange);
  box-shadow: 0 0 24px rgba(226,101,58,0.5);
  transform: scale(0.96);
}

/* Slider */
.ctrl-slider-wrap { width: 100%; padding: 0 8px; }
.ctrl-slider-val {
  text-align: center;
  font-family: var(--mono);
  font-size: 26px;
  color: var(--accent);
  margin-bottom: 10px;
}
.ctrl-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background: var(--card);
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}
.ctrl-slider:disabled { opacity: 0.4; cursor: not-allowed; }
.ctrl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 22px;
  background: var(--orange);
  border-radius: 2px;
  border: none;
  cursor: pointer;
  box-shadow: 0 0 12px rgba(226,101,58,0.5);
}
.ctrl-slider::-moz-range-thumb {
  width: 18px;
  height: 22px;
  background: var(--orange);
  border: none;
  border-radius: 2px;
  cursor: pointer;
}
.ctrl-slider-scale {
  display: flex;
  justify-content: space-between;
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 0.18em;
  margin-top: 6px;
}

/* LED */
.ctrl-led {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #08080c;
  border: 2px solid var(--border-bright);
  transition: all 0.15s;
}
.ctrl-led.on {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 30px var(--accent-glow), inset 0 0 12px rgba(255,255,255,0.3);
}

/* Gauge */
.ctrl-gauge { width: 100%; padding: 0 8px; text-align: center; }
.ctrl-gauge-val { font-family: var(--mono); font-size: 32px; color: var(--accent); }
.ctrl-gauge-sub {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.ctrl-gauge-bar {
  width: 100%;
  height: 8px;
  background: var(--card);
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.ctrl-gauge-fill {
  height: 100%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent-glow);
  transition: width 0.1s linear;
  width: 0;
}

/* Scope */
.ctrl-scope { width: 100%; }
.ctrl-scope canvas {
  display: block;
  width: 100%;
  height: 80px;
  background: #08080c;
  border: 1px solid var(--border-bright);
  border-radius: 3px;
}
.ctrl-scope-readout {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.ctrl-scope-readout b { color: var(--accent); font-weight: 500; }

/* Console */
.console-strip {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  max-height: 160px;
  flex-shrink: 0;
}
.console-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.console-clear {
  background: none;
  border: none;
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  cursor: pointer;
  text-transform: uppercase;
}
.console-clear:hover { color: var(--red); }
.console-log {
  overflow-y: auto;
  padding: 8px 12px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
}
.console-log .line { color: var(--text); }
.console-log .line .ts { color: var(--text-dim); margin-right: 8px; opacity: 0.7; }
.console-log .line.ok { color: var(--accent); }
.console-log .line.err { color: var(--red); }
.console-log .line.sig { color: var(--orange); }

@media (max-width: 700px) {
  .panel-head { gap: 8px; }
  .meta { display: none; }
  .dashboard { grid-template-columns: 1fr; }
}
</style>
