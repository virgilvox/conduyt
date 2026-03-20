<template>
  <div class="landing">
    <!-- HERO -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-text">
          <div class="hero-eyebrow">Open Hardware Protocol</div>
          <h1 class="hero-title">CONDUYT</h1>
          <p class="hero-sub">Control any microcontroller from any language. One protocol, every transport.</p>
          <div class="hero-cta">
            <a href="/docs" class="btn-primary">Get Started</a>
            <a href="https://github.com/virgilvox/conduyt" class="btn-secondary">GitHub</a>
          </div>
        </div>
        <div class="hero-demo">
          <ClientOnly>
            <PacketDemo />
          </ClientOnly>
        </div>
      </div>
    </section>

    <!-- VALUE PROPS -->
    <section class="section props-section">
      <div class="props-grid">
        <div class="prop-card" v-for="prop in props" :key="prop.title">
          <div class="prop-icon">{{ prop.icon }}</div>
          <div>
            <strong>{{ prop.title }}</strong>
            <p>{{ prop.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CODE EXAMPLES -->
    <section class="section">
      <div class="section-header">
        <h2>Five lines to blink an LED</h2>
        <p class="section-sub">Same protocol, any language. Pick your SDK.</p>
      </div>

      <div class="code-split">
        <div class="code-sidebar">
          <button
            v-for="lang in codeExamples"
            :key="lang.name"
            :class="['lang-btn', { active: activeLang === lang.name }]"
            @click="activeLang = lang.name"
          >
            <span class="lang-name">{{ lang.name }}</span>
            <span class="lang-pkg">{{ lang.pkg }}</span>
          </button>
        </div>
        <div class="code-main">
          <template v-for="lang in codeExamples" :key="lang.name">
            <div v-show="activeLang === lang.name" class="code-pane">
              <ClientOnly>
                <CodeBlock :code="lang.code" :lang="lang.langId" />
                <template #fallback>
                  <pre><code>{{ lang.code }}</code></pre>
                </template>
              </ClientOnly>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- WIRE FORMAT -->
    <section class="section wire-section">
      <div class="wire-layout">
        <div class="wire-text">
          <h2>8-byte binary header</h2>
          <p>Fixed overhead. CRC8 integrity. COBS framing for serial and BLE. Message-oriented transports (MQTT, WebSocket) skip framing entirely.</p>
          <p>No JSON. No text parsing on the MCU. A complete PIN_WRITE command is 10 bytes.</p>
        </div>
        <div class="wire-diagram">
          <div class="pkt-row">
            <div class="pkt-cell pkt-magic"><div class="pkt-label">MAGIC</div><div class="pkt-val">43 44</div></div>
            <div class="pkt-cell pkt-ver"><div class="pkt-label">VER</div><div class="pkt-val">01</div></div>
            <div class="pkt-cell pkt-type"><div class="pkt-label">TYPE</div><div class="pkt-val">11</div></div>
            <div class="pkt-cell pkt-seq"><div class="pkt-label">SEQ</div><div class="pkt-val">00</div></div>
            <div class="pkt-cell pkt-len"><div class="pkt-label">LEN</div><div class="pkt-val">00 02</div></div>
            <div class="pkt-cell pkt-crc"><div class="pkt-label">CRC</div><div class="pkt-val">XX</div></div>
          </div>
          <div class="pkt-row pkt-row-payload">
            <div class="pkt-cell pkt-payload-cell"><div class="pkt-label">PAYLOAD</div><div class="pkt-val">0D 01</div><div class="pkt-desc">pin=13, value=1</div></div>
          </div>
        </div>
      </div>
    </section>

    <!-- REPLACES -->
    <section class="section">
      <div class="section-header">
        <h2>What Conduyt replaces</h2>
      </div>

      <div class="compare-grid">
        <div class="compare-card" v-for="item in replacements" :key="item.name">
          <div class="compare-top">
            <span class="compare-name">{{ item.name }}</span>
            <span class="compare-year">{{ item.year }}</span>
          </div>
          <div class="compare-problem">{{ item.problem }}</div>
          <div class="compare-fix">Conduyt: {{ item.fix }}</div>
        </div>
      </div>
    </section>

    <!-- SDKs -->
    <section class="section">
      <div class="section-header">
        <h2>SDKs</h2>
        <p class="section-sub">One firmware library. Five host SDKs. Same wire format everywhere.</p>
      </div>

      <div class="sdk-grid">
        <a v-for="sdk in sdks" :key="sdk.name" :href="sdk.link" class="sdk-card">
          <div class="sdk-name">{{ sdk.name }}</div>
          <div class="sdk-lang">{{ sdk.lang }}</div>
          <code>{{ sdk.install }}</code>
        </a>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-col">
          <div class="footer-logo">CONDUYT</div>
          <div class="footer-meta">MIT License / LumenCanvas</div>
        </div>
        <div class="footer-links">
          <a href="/docs">Docs</a>
          <a href="/docs/reference/packet-structure">Protocol</a>
          <a href="/docs/reference/firmware-api">Firmware</a>
          <a href="https://github.com/virgilvox/conduyt">GitHub</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeLang = ref('JavaScript')

const props = [
  { icon: '01', title: 'Binary, not text', desc: 'Fixed 8-byte header with CRC8. No string parsing on a 16MHz chip.' },
  { icon: '02', title: 'Self-describing', desc: 'Device declares its capabilities on connect. Host never hardcodes pin maps.' },
  { icon: '03', title: 'Any transport', desc: 'Serial, BLE, MQTT, WebSocket, TCP. Same packet format. Swap the wire, keep the code.' },
  { icon: '04', title: 'Module system', desc: 'Servo, NeoPixel, DHT, OLED, Stepper. Firmware opts in. Host discovers automatically.' },
]

const replacements = [
  { name: 'Firmata', year: '2006', problem: 'MIDI encoding, serial-only', fix: 'Binary packets, any transport' },
  { name: 'Johnny-Five', year: '2012', problem: 'Node.js only, inherits Firmata limits', fix: 'Five SDKs, native binary' },
  { name: 'Blynk 2.0', year: '2021', problem: 'Requires proprietary cloud', fix: 'Self-hostable, no cloud dependency' },
  { name: 'CircuitPython', year: '2017', problem: 'Runtime, not a control protocol', fix: 'Structured host-device protocol' },
]

const codeExamples = [
  {
    name: 'JavaScript',
    langId: 'javascript',
    pkg: 'npm install conduyt-js',
    code: `import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0' })
)

await device.pin(13).mode('output')
await device.pin(13).write(1)

const value = await device.pin(0).read('analog')
console.log('sensor:', value)`,
  },
  {
    name: 'Arduino',
    langId: 'cpp',
    pkg: '#include <Conduyt.h>',
    code: `#define CONDUYT_MODULE_SERVO
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyBoard", "1.0.0", transport);

void setup() {
  device.addModule(new ConduytModuleServo());
  device.begin();
}

void loop() {
  device.poll();
}`,
  },
  {
    name: 'Python',
    langId: 'python',
    pkg: 'pip install conduyt-py',
    code: `from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport

device = ConduytDevice(SerialTransport("/dev/ttyUSB0"))
await device.connect()

await device.pin(13).mode("output")
await device.pin(13).write(1)

value = await device.pin(0).read("analog")
print(f"sensor: {value}")`,
  },
  {
    name: 'Go',
    langId: 'go',
    pkg: 'go get github.com/virgilvox/conduyt/sdk/go',
    code: `device := conduyt.NewDevice(transport)
hello, _ := device.Connect(ctx)

device.Pin(13).Mode(ctx, conduyt.PinModeOutput)
device.Pin(13).Write(ctx, 1)

value, _ := device.Pin(0).Read(ctx)
fmt.Println("sensor:", value)`,
  },
  {
    name: 'Rust',
    langId: 'rust',
    pkg: 'cargo add conduyt',
    code: `let mut device = Device::new(transport);
device.connect()?;

device.pin_mode(13, PIN_MODE_OUTPUT)?;
device.pin_write(13, 1)?;

let value = device.pin_read(0)?;
println!("sensor: {}", value);`,
  },
]

const sdks = [
  { name: 'conduyt-firmware', lang: 'Arduino / C++', install: '#include <Conduyt.h>', link: '/docs/reference/firmware-api' },
  { name: 'conduyt-js', lang: 'JavaScript / TypeScript', install: 'npm install conduyt-js', link: '/docs/reference/js-api' },
  { name: 'conduyt-py', lang: 'Python 3.10+', install: 'pip install conduyt-py', link: '/docs/reference/python-api' },
  { name: 'conduyt-go', lang: 'Go', install: 'go get github.com/virgilvox/conduyt/sdk/go', link: '/docs/tutorials/first-blink' },
  { name: 'conduyt', lang: 'Rust (no_std core)', install: 'cargo add conduyt', link: '/docs/tutorials/first-blink' },
  { name: 'ConduytKit', lang: 'Swift (iOS / macOS)', install: 'Swift Package Manager', link: '/docs/tutorials/first-blink' },
]
</script>

<style scoped>
.landing { max-width: 100%; overflow-x: hidden; }

/* ── Hero ──────────────────────────────────────────── */
.hero {
  padding: 80px 48px 64px;
  border-bottom: 1px solid var(--border);
}

.hero-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 48px;
  align-items: center;
}

.hero-eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}

.hero-title {
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--text-bright);
  line-height: 1;
  margin-bottom: 16px;
}

.hero-sub {
  font-size: 18px;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 28px;
  max-width: 340px;
}

.hero-cta { display: flex; gap: 12px; }

.btn-primary {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  padding: 10px 24px;
  background: var(--accent);
  color: #000;
  border: none;
  text-decoration: none;
  border-radius: 6px;
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.85; text-decoration: none; }

.btn-secondary {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  padding: 10px 24px;
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border-bright);
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.15s;
}
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }

.hero-demo {
  min-height: 280px;
}

/* ── Value Props ───────────────────────────────────── */
.props-section { border-bottom: 1px solid var(--border); }

.props-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.prop-card {
  background: var(--bg);
  padding: 24px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.prop-icon {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  min-width: 24px;
  padding-top: 2px;
}

.prop-card strong {
  font-size: 14px;
  color: var(--text-bright);
  display: block;
  margin-bottom: 4px;
}

.prop-card p {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  color: var(--text);
}

/* ── Sections ──────────────────────────────────────── */
.section {
  padding: 64px 48px;
  border-bottom: 1px solid var(--border);
}

.section-header {
  max-width: 1200px;
  margin: 0 auto 32px;
}

.section-header h2 {
  font-size: 24px;
  margin-bottom: 6px;
}

.section-sub {
  color: var(--text);
  font-size: 15px;
  margin: 0;
}

/* ── Code Split ────────────────────────────────────── */
.code-split {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 200px 1fr;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--card);
}

.code-sidebar {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.lang-btn {
  text-align: left;
  font-family: var(--sans);
  padding: 14px 20px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text);
}

.lang-btn:last-child { border-bottom: none; }
.lang-btn:hover { background: var(--hover-bg); }
.lang-btn.active { background: var(--accent-dim); border-left: 3px solid var(--accent); }

.lang-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-bright);
}

.lang-btn.active .lang-name { color: var(--accent); }

.lang-pkg {
  display: block;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.code-main {
  min-height: 320px;
}

.code-pane {
  height: 100%;
}

.code-pane :deep(pre) {
  height: 100%;
  min-height: 320px;
  margin: 0;
  border: none !important;
  border-radius: 0 !important;
}

/* ── Wire Format ───────────────────────────────────── */
.wire-section {
  background: var(--surface);
}

.wire-layout {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}

.wire-text h2 { font-size: 24px; margin-bottom: 16px; }
.wire-text p { font-size: 15px; line-height: 1.7; margin-bottom: 12px; color: var(--text); }

.wire-diagram {
  font-family: var(--mono);
}

.pkt-row {
  display: flex;
}

.pkt-row-payload {
  margin-top: -1px;
}

.pkt-cell {
  border: 1px solid var(--border-bright);
  padding: 14px 12px;
  text-align: center;
  font-size: 12px;
}

.pkt-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.pkt-val { font-weight: 600; font-size: 14px; }
.pkt-desc { font-size: 11px; color: var(--text-dim); margin-top: 4px; }

.pkt-magic { background: var(--accent-dim); }
.pkt-magic .pkt-val { color: var(--accent); }
.pkt-ver .pkt-val { color: var(--text-bright); }
.pkt-type { background: var(--orange-dim); }
.pkt-type .pkt-val { color: var(--orange); }
.pkt-seq .pkt-val { color: var(--purple); }
.pkt-len .pkt-val { color: var(--text); }
.pkt-crc { background: var(--yellow-dim); }
.pkt-crc .pkt-val { color: var(--yellow); }
.pkt-payload-cell { flex: 1; background: rgba(139,124,244,0.05); }
.pkt-payload-cell .pkt-val { color: var(--purple); }

/* ── Compare Grid ──────────────────────────────────── */
.compare-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.compare-card {
  background: var(--card);
  border: 1px solid var(--border);
  padding: 20px;
  border-radius: 8px;
}

.compare-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.compare-name { font-weight: 700; font-size: 15px; color: var(--text-bright); }
.compare-year { font-size: 12px; color: var(--text-dim); font-family: var(--mono); }
.compare-problem { font-size: 13px; color: var(--text-dim); line-height: 1.5; margin-bottom: 10px; }
.compare-fix { font-size: 13px; color: var(--accent); line-height: 1.5; }

/* ── SDK Grid ──────────────────────────────────────── */
.sdk-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.sdk-card {
  background: var(--card);
  border: 1px solid var(--border);
  padding: 20px;
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.15s;
  display: block;
}

.sdk-card:hover { border-color: var(--accent); text-decoration: none; }
.sdk-name { font-weight: 700; font-size: 15px; color: var(--accent); margin-bottom: 2px; }
.sdk-lang { font-size: 13px; color: var(--text-dim); margin-bottom: 10px; }
.sdk-card code { display: block; font-size: 12px; }

/* ── Footer ────────────────────────────────────────── */
.footer {
  padding: 40px 48px;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-logo { font-size: 16px; font-weight: 700; color: var(--text-bright); }
.footer-meta { font-size: 13px; color: var(--text-dim); margin-top: 2px; }

.footer-links {
  display: flex;
  gap: 24px;
}

.footer-links a {
  font-size: 13px;
  color: var(--text);
  transition: color 0.15s;
}
.footer-links a:hover { color: var(--accent); text-decoration: none; }

/* ── Responsive ────────────────────────────────────── */
@media (max-width: 1000px) {
  .hero-content { grid-template-columns: 1fr; gap: 32px; }
  .hero { padding: 60px 24px 48px; }
  .hero-sub { max-width: 100%; }
  .props-grid { grid-template-columns: repeat(2, 1fr); }
  .code-split { grid-template-columns: 1fr; }
  .code-sidebar { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--border); }
  .lang-btn { border-bottom: none; border-right: 1px solid var(--border); white-space: nowrap; }
  .lang-btn.active { border-left: none; border-top: 3px solid var(--accent); }
  .wire-layout { grid-template-columns: 1fr; gap: 24px; }
  .compare-grid { grid-template-columns: repeat(2, 1fr); }
  .sdk-grid { grid-template-columns: repeat(2, 1fr); }
  .section { padding: 48px 24px; }
}

@media (max-width: 600px) {
  .hero-title { font-size: 48px; }
  .props-grid { grid-template-columns: 1fr; }
  .compare-grid { grid-template-columns: 1fr; }
  .sdk-grid { grid-template-columns: 1fr; }
  .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
  .footer-links { flex-wrap: wrap; justify-content: center; }
}
</style>
