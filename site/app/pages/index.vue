<template>
  <div class="landing">
    <!-- HERO -->
    <section class="hero">
      <div class="hero-glow" />
      <div class="hero-inner">
        <div class="hero-eyebrow">Open Hardware Protocol</div>
        <h1 class="hero-title">GRAFT</h1>
        <p class="hero-sub">Binary protocol for host-to-device hardware control. Transport agnostic. Self-describing. Runs on ATmega through ESP32.</p>

        <div class="hero-tags">
          <span class="tag tag-accent">v0.1</span>
          <span class="tag tag-orange">Arduino / C++</span>
          <span class="tag">Binary</span>
          <span class="tag">COBS</span>
          <span class="tag">MQTT</span>
          <span class="tag">BLE</span>
        </div>

        <div class="hero-cta">
          <a href="/docs/getting-started/introduction" class="btn-primary">Documentation</a>
          <a href="https://github.com/virgilvox/graft" class="btn-secondary">GitHub</a>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">01</span>
        <h2>How It Works</h2>
      </div>

      <div class="flow-steps">
        <div class="flow-step">
          <div class="flow-step-num">1</div>
          <div>
            <strong>Device declares capabilities</strong>
            <p>Firmware sends HELLO_RESP on connect: pin count, pin modes, loaded modules, typed datastreams.</p>
          </div>
        </div>
        <div class="flow-step">
          <div class="flow-step-num">2</div>
          <div>
            <strong>Host discovers automatically</strong>
            <p>SDK parses the response and exposes a typed API. No hardcoded pin maps. No config files.</p>
          </div>
        </div>
        <div class="flow-step">
          <div class="flow-step-num">3</div>
          <div>
            <strong>Control flows both ways</strong>
            <p>Commands down, events up. Pin reads, sensor streams, module responses. All binary, all sequence-tracked.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CODE EXAMPLES -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">02</span>
        <h2>Code</h2>
      </div>

      <div class="code-tabs">
        <button
          v-for="lang in codeExamples"
          :key="lang.name"
          :class="['code-tab', { active: activeLang === lang.name }]"
          @click="activeLang = lang.name"
        >{{ lang.name }}</button>
      </div>

      <template v-for="lang in codeExamples" :key="lang.name">
        <div class="code-panel" v-show="activeLang === lang.name">
          <div class="code-header">
            <span class="code-label">{{ lang.name }}</span>
            <code class="code-pkg">{{ lang.pkg }}</code>
          </div>
          <CodeBlock :code="lang.code" :lang="lang.langId" />
        </div>
      </template>
    </section>

    <!-- WIRE FORMAT -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">03</span>
        <h2>Wire Format</h2>
      </div>

      <p class="section-desc">Fixed 8-byte header + variable payload. COBS framing for serial/BLE. No JSON on the wire.</p>

      <div class="packet-diagram">
        <div class="pkt-row">
          <div class="pkt-cell pkt-magic"><div class="pkt-label">MAGIC</div><div class="pkt-val">0x47 0x46</div><div class="pkt-size">2B</div></div>
          <div class="pkt-cell"><div class="pkt-label">VER</div><div class="pkt-val">0x01</div><div class="pkt-size">1B</div></div>
          <div class="pkt-cell pkt-type"><div class="pkt-label">TYPE</div><div class="pkt-val">cmd/evt</div><div class="pkt-size">1B</div></div>
          <div class="pkt-cell"><div class="pkt-label">SEQ</div><div class="pkt-val pkt-val-purple">0-255</div><div class="pkt-size">1B</div></div>
          <div class="pkt-cell"><div class="pkt-label">LEN</div><div class="pkt-val">u16le</div><div class="pkt-size">2B</div></div>
          <div class="pkt-cell pkt-crc"><div class="pkt-label">CRC8</div><div class="pkt-val">checksum</div><div class="pkt-size">1B</div></div>
          <div class="pkt-cell pkt-payload"><div class="pkt-label">PAYLOAD</div><div class="pkt-val">data</div><div class="pkt-size">N bytes</div></div>
        </div>
      </div>
    </section>

    <!-- WHAT IT REPLACES -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">04</span>
        <h2>Replaces</h2>
      </div>

      <div class="compare-grid">
        <div class="compare-card" v-for="item in replacements" :key="item.name">
          <div class="compare-name">{{ item.name }} <span class="compare-year">{{ item.year }}</span></div>
          <div class="compare-problem">{{ item.problem }}</div>
        </div>
      </div>
    </section>

    <!-- TRANSPORT TOPOLOGY -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">05</span>
        <h2>Transports</h2>
      </div>

      <div class="topo-grid">
        <div class="topo-card">
          <h3>Direct</h3>
          <div class="topo-diagram">
            <span class="topo-node">Host</span>
            <span class="topo-arrow">serial / BLE</span>
            <span class="topo-node">Device</span>
          </div>
          <p>Point-to-point. USB cable or Bluetooth. Zero infrastructure.</p>
        </div>
        <div class="topo-card">
          <h3>Brokered</h3>
          <div class="topo-diagram">
            <span class="topo-node">Host</span>
            <span class="topo-arrow">MQTT</span>
            <span class="topo-node">Broker</span>
            <span class="topo-arrow">MQTT</span>
            <span class="topo-node">Device</span>
          </div>
          <p>Multiple hosts, dashboards, remote access. Self-hostable.</p>
        </div>
      </div>
    </section>

    <!-- SDKs -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">06</span>
        <h2>SDKs</h2>
      </div>

      <div class="sdk-grid">
        <div class="sdk-card" v-for="sdk in sdks" :key="sdk.name">
          <div class="sdk-name">{{ sdk.name }}</div>
          <div class="sdk-lang">{{ sdk.lang }}</div>
          <code>{{ sdk.install }}</code>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-col">
          <div class="footer-logo">GRAFT</div>
          <div class="footer-license">MIT License</div>
          <div class="footer-org"><a href="https://github.com/virgilvox">LumenCanvas</a></div>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Docs</div>
          <a href="/docs/getting-started/introduction">Introduction</a>
          <a href="/docs/protocol/packet-structure">Protocol</a>
          <a href="/docs/firmware/module-system">Modules</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">SDKs</div>
          <a href="/docs/getting-started/quick-start-js">JavaScript</a>
          <a href="/docs/sdk-guides/python">Python</a>
          <a href="/docs/getting-started/quick-start-arduino">Arduino</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeLang = ref('JavaScript')

const replacements = [
  { name: 'Firmata', year: '2006', problem: 'MIDI encoding, serial-only, no capability negotiation' },
  { name: 'Johnny-Five', year: '2012', problem: 'Good DX but inherits Firmata limits, Node-only' },
  { name: 'Blynk 2.0', year: '2021', problem: 'Proprietary cloud required, string-typed pins' },
  { name: 'CircuitPython', year: '2017', problem: 'Runtime not protocol, no host-device control' },
]

const codeExamples = [
  {
    name: 'JavaScript',
    langId: 'javascript',
    pkg: 'npm install graft-js',
    code: `import { GraftDevice } from 'graft-js'
import { SerialTransport } from 'graft-js/transports/serial'

const device = await GraftDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0' })
)

await device.pin(13).mode('output')
await device.pin(13).write(1)

const value = await device.pin(0).read('analog')
console.log('sensor:', value)

await device.disconnect()`,
  },
  {
    name: 'Arduino',
    langId: 'cpp',
    pkg: '#include <Graft.h>',
    code: `#define GRAFT_MODULE_SERVO
#include <Graft.h>

GraftSerial  transport(Serial, 115200);
GraftDevice  device("MyBoard", "1.0.0", transport);

void setup() {
  device.addModule(new GraftModuleServo());
  device.begin();
}

void loop() {
  device.poll();
}`,
  },
  {
    name: 'Python',
    langId: 'python',
    pkg: 'pip install graft-py',
    code: `from graft import GraftDevice
from graft.transports.serial import SerialTransport

device = GraftDevice(SerialTransport("/dev/ttyUSB0"))
await device.connect()

await device.pin(13).mode("output")
await device.pin(13).write(1)

value = await device.pin(0).read("analog")
print(f"sensor: {value}")

await device.disconnect()`,
  },
  {
    name: 'Go',
    langId: 'go',
    pkg: 'go get github.com/graft-io/graft-go',
    code: `device := graft.NewDevice(transport)
hello, _ := device.Connect(ctx)

device.Pin(13).Mode(ctx, graft.PinModeOutput)
device.Pin(13).Write(ctx, 1)

value, _ := device.Pin(0).Read(ctx)
fmt.Println("sensor:", value)

device.Close()`,
  },
  {
    name: 'Rust',
    langId: 'rust',
    pkg: 'cargo add graft',
    code: `let mut device = Device::new(transport);
device.connect()?;

device.pin_mode(13, PIN_MODE_OUTPUT)?;
device.pin_write(13, 1)?;

let value = device.pin_read(0)?;
println!("sensor: {}", value);

device.close()?;`,
  },
]

const sdks = [
  { name: 'graft-firmware', lang: 'Arduino / C++', install: '#include <Graft.h>' },
  { name: 'graft-js', lang: 'JavaScript / TypeScript', install: 'npm install graft-js' },
  { name: 'graft-py', lang: 'Python 3.10+', install: 'pip install graft-py' },
  { name: 'graft-go', lang: 'Go', install: 'go get github.com/graft-io/graft-go' },
  { name: 'graft', lang: 'Rust (no_std core)', install: 'cargo add graft' },
  { name: 'GraftKit', lang: 'Swift (iOS / macOS)', install: 'Swift Package Manager' },
]
</script>

<style scoped>
.landing { max-width: 100%; overflow-x: hidden; }

/* -- Hero ----------------------------------------- */
.hero {
  padding: 100px 64px 80px;
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}
.hero-glow {
  position: absolute;
  top: -120px; right: -120px;
  width: 500px; height: 500px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  opacity: 0.4;
  pointer-events: none;
}
.hero-inner { max-width: 720px; position: relative; z-index: 1; }
.hero-eyebrow {
  font-family: var(--mono);
  font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
  color: var(--accent); margin-bottom: 16px; font-weight: 500;
}
.hero-title {
  font-size: 72px; font-weight: 700; letter-spacing: -1px;
  color: var(--text-bright); line-height: 1; margin-bottom: 20px;
}
.hero-sub {
  font-size: 17px; color: var(--text); max-width: 560px;
  line-height: 1.7; margin-bottom: 32px;
}
.hero-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 36px; }
.hero-cta { display: flex; gap: 12px; }
.btn-primary {
  font-family: var(--mono); font-size: 13px; font-weight: 600;
  padding: 10px 24px; background: var(--accent); color: var(--bg); border: none;
  text-decoration: none; border-radius: var(--radius); transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.85; text-decoration: none; }
.btn-secondary {
  font-family: var(--mono); font-size: 13px; font-weight: 500;
  padding: 10px 24px; background: transparent; color: var(--text);
  border: 1px solid var(--border-bright); text-decoration: none;
  border-radius: var(--radius); transition: all 0.15s;
}
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }

/* -- Sections ------------------------------------- */
.section { padding: 56px 64px; border-bottom: 1px solid var(--border); }
.section-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 28px; }
.section-num { font-family: var(--mono); font-size: 13px; color: var(--text-dim); letter-spacing: 1px; font-weight: 500; }
.section-desc { max-width: 600px; margin-bottom: 24px; color: var(--text); }

/* -- How It Works Flow ---------------------------- */
.flow-steps { max-width: 600px; display: flex; flex-direction: column; gap: 1px; }
.flow-step {
  display: flex; gap: 16px; align-items: flex-start;
  background: var(--card); border: 1px solid var(--border); padding: 20px 24px;
  border-radius: var(--radius);
}
.flow-step-num {
  font-family: var(--mono); font-size: 14px; font-weight: 600;
  color: var(--accent); min-width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--accent); border-radius: 50%; flex-shrink: 0;
}
.flow-step strong {
  font-size: 15px; color: var(--text-bright);
  display: block; margin-bottom: 4px;
}
.flow-step p { font-size: 14px; line-height: 1.6; margin: 0; color: var(--text); }

/* -- Compare Grid --------------------------------- */
.compare-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.compare-card {
  background: var(--card); border: 1px solid var(--border); padding: 20px;
  border-radius: var(--radius);
}
.compare-name { font-weight: 600; font-size: 15px; color: var(--text-bright); margin-bottom: 6px; }
.compare-year { font-weight: 400; font-size: 13px; color: var(--text-dim); }
.compare-problem { font-size: 14px; color: var(--text); line-height: 1.6; }

/* -- Code Tabs ------------------------------------ */
.code-tabs {
  display: flex; gap: 0; margin-bottom: 0;
  border: 1px solid var(--border); border-bottom: none;
  border-radius: var(--radius) var(--radius) 0 0;
  overflow: hidden; background: var(--card);
}
.code-tab {
  font-family: var(--mono); font-size: 12px; font-weight: 500;
  padding: 10px 20px; background: transparent; color: var(--text-dim);
  border: none; cursor: pointer; border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.code-tab:hover { color: var(--text); background: var(--hover-bg); }
.code-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--hover-bg); }
.code-panel {
  background: var(--card);
  border: 1px solid var(--border); border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius) var(--radius);
  overflow: hidden;
}
.code-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--hover-bg);
}
.code-label {
  font-size: 13px; font-weight: 600; color: var(--text-bright);
}
.code-pkg {
  font-size: 12px; background: transparent; border: none; color: var(--text-dim); padding: 0;
}

/* -- Packet Diagram ------------------------------- */
.packet-diagram {
  font-family: var(--mono); background: var(--card);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 24px; overflow-x: auto;
}
.pkt-row { display: flex; }
.pkt-cell {
  border: 1px solid var(--border-bright); padding: 12px 14px;
  text-align: center; font-size: 12px; flex-shrink: 0;
}
.pkt-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); margin-bottom: 4px; }
.pkt-val { color: var(--text-bright); font-weight: 600; }
.pkt-val-purple { color: var(--purple); }
.pkt-size { font-size: 11px; color: var(--text-dim); margin-top: 3px; }
.pkt-magic { background: var(--accent-dim); border-color: var(--accent); }
.pkt-magic .pkt-val { color: var(--accent); }
.pkt-type { background: var(--orange-dim); }
.pkt-type .pkt-val { color: var(--orange); }
.pkt-payload { flex: 1; background: rgba(139,124,244,0.04); }
.pkt-payload .pkt-val { color: var(--purple); }
.pkt-crc { background: var(--yellow-dim); }
.pkt-crc .pkt-val { color: var(--yellow); }

/* -- Topology ------------------------------------- */
.topo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.topo-card {
  background: var(--card); border: 1px solid var(--border); padding: 24px;
  border-radius: var(--radius);
}
.topo-card h3 { margin-bottom: 16px; font-size: 13px; }
.topo-diagram {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-family: var(--mono); font-size: 12px; margin-bottom: 12px;
}
.topo-node {
  color: var(--accent); font-weight: 600; padding: 5px 12px;
  border: 1px solid rgba(0,212,170,0.3); background: var(--accent-dim);
  border-radius: 3px;
}
.topo-arrow { color: var(--text-dim); font-size: 12px; }
.topo-card p { font-size: 14px; margin: 0; color: var(--text); }

/* -- SDK Grid ------------------------------------- */
.sdk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.sdk-card {
  background: var(--card); border: 1px solid var(--border); padding: 16px 20px;
  border-radius: var(--radius);
}
.sdk-name { font-weight: 600; font-size: 14px; color: var(--accent); margin-bottom: 2px; }
.sdk-lang { font-size: 13px; color: var(--text-dim); margin-bottom: 8px; }
.sdk-card code { display: block; font-size: 12px; margin-top: 4px; }

/* -- Footer --------------------------------------- */
.footer { padding: 48px 64px; border-top: 1px solid var(--border); }
.footer-inner { display: flex; gap: 64px; }
.footer-col { display: flex; flex-direction: column; gap: 6px; }
.footer-col:first-child { min-width: 200px; }
.footer-col-title {
  font-family: var(--mono); font-size: 12px; font-weight: 600;
  text-transform: uppercase; color: var(--text-dim); margin-bottom: 4px;
  letter-spacing: 1px;
}
.footer-col a { font-size: 14px; color: var(--text); transition: color 0.15s; }
.footer-col a:hover { color: var(--accent); text-decoration: none; }
.footer-logo {
  font-size: 18px; font-weight: 700; letter-spacing: -0.3px; color: var(--text-bright);
}
.footer-license { font-size: 13px; color: var(--text-dim); }
.footer-org { font-size: 13px; }

/* -- Responsive ----------------------------------- */
@media (max-width: 900px) {
  .hero { padding: 60px 24px 48px; }
  .hero-title { font-size: 48px; }
  .section { padding: 36px 24px; }
  .topo-grid { grid-template-columns: 1fr; }
  .footer { padding: 32px 24px; }
  .footer-inner { flex-direction: column; gap: 32px; }
}
</style>
