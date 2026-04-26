<template>
  <div class="docs-layout">
    <!-- Mobile backdrop -->
    <div v-if="mobileNav.isOpen.value" class="sidebar-backdrop" @click="mobileNav.close()" />

    <aside class="docs-sidebar" :class="{ open: mobileNav.isOpen.value }">
      <div class="sidebar-header">
        <NuxtLink to="/" class="sidebar-logo">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="8" width="5" height="12" fill="var(--accent)" opacity="0.9"/>
            <rect x="21" y="8" width="5" height="12" fill="var(--accent)" opacity="0.9"/>
            <rect x="9" y="4" width="10" height="4" fill="var(--accent)" opacity="0.5"/>
            <rect x="9" y="20" width="10" height="4" fill="var(--accent)" opacity="0.5"/>
            <circle cx="14" cy="14" r="2" fill="var(--accent)"/>
          </svg>
          <span>CONDUYT</span>
        </NuxtLink>
        <div class="sidebar-version">v1.0</div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-group" v-for="group in navGroups" :key="group.title">
          <div class="nav-group-title">{{ group.title }}</div>
          <NuxtLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            @click="mobileNav.close()"
          >
            {{ item.title }}
          </NuxtLink>
        </div>
      </nav>
    </aside>

    <main class="docs-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useMobileNav } from '~/composables/useMobileNav'

const mobileNav = useMobileNav()

const navGroups = [
  {
    title: 'Getting Started',
    items: [
      { path: '/docs', title: 'Overview' },
      { path: '/docs/getting-started/quickstart-playground', title: 'Quick Start: Playground' },
      { path: '/docs/getting-started/quickstart-arduino-ide', title: 'Quick Start: Arduino IDE' },
      { path: '/docs/tutorials/first-blink', title: 'Quick Start: PlatformIO' },
    ],
  },
  {
    title: 'Tutorials',
    items: [
      { path: '/docs/tutorials/what-is-conduyt', title: 'What is Conduyt?' },
      { path: '/docs/tutorials/sensor-dashboard', title: 'Sensor Dashboard' },
    ],
  },
  {
    title: 'Boards',
    items: [
      { path: '/docs/boards/arduino-uno-r3', title: 'Arduino Uno R3' },
      { path: '/docs/boards/arduino-uno-r4', title: 'Arduino Uno R4 Minima' },
      { path: '/docs/boards/arduino-uno-r4-wifi', title: 'Arduino Uno R4 WiFi' },
      { path: '/docs/boards/arduino-mega-2560', title: 'Arduino Mega 2560' },
      { path: '/docs/boards/arduino-nano', title: 'Arduino Nano' },
      { path: '/docs/boards/arduino-nano-every', title: 'Arduino Nano Every' },
      { path: '/docs/boards/arduino-nano-esp32', title: 'Arduino Nano ESP32' },
      { path: '/docs/boards/arduino-leonardo', title: 'Arduino Leonardo' },
      { path: '/docs/boards/esp32', title: 'ESP32' },
      { path: '/docs/boards/esp32-s2', title: 'ESP32-S2' },
      { path: '/docs/boards/esp32-s3', title: 'ESP32-S3' },
      { path: '/docs/boards/esp32-c3', title: 'ESP32-C3' },
      { path: '/docs/boards/nodemcu-v2', title: 'NodeMCU v2 (ESP8266)' },
      { path: '/docs/boards/rp2040-pico', title: 'Raspberry Pi Pico' },
      { path: '/docs/boards/nrf52840-dk', title: 'nRF52840 DK' },
      { path: '/docs/boards/teensy-3-6', title: 'Teensy 3.6' },
      { path: '/docs/boards/teensy-4-0', title: 'Teensy 4.0' },
      { path: '/docs/boards/teensy-4-1', title: 'Teensy 4.1' },
    ],
  },
  {
    title: 'Modules',
    items: [
      { path: '/docs/modules/servo', title: 'Servo' },
      { path: '/docs/modules/neopixel', title: 'NeoPixel' },
      { path: '/docs/modules/oled', title: 'OLED (SSD1306)' },
      { path: '/docs/modules/dht', title: 'DHT (Temperature)' },
      { path: '/docs/modules/encoder', title: 'Encoder' },
      { path: '/docs/modules/stepper', title: 'Stepper' },
      { path: '/docs/modules/pid', title: 'PID Controller' },
      { path: '/docs/modules/i2c-passthrough', title: 'I2C Passthrough' },
    ],
  },
  {
    title: 'How-To Guides',
    items: [
      { path: '/docs/how-to/connect-serial', title: 'Connect over Serial' },
      { path: '/docs/how-to/connect-mqtt', title: 'Connect over MQTT' },
      { path: '/docs/how-to/connect-ble', title: 'Connect over BLE' },
      { path: '/docs/how-to/use-datastreams', title: 'Use Datastreams' },
      { path: '/docs/how-to/flash-ota', title: 'Flash OTA' },
      { path: '/docs/how-to/add-module', title: 'Write a Module' },
      { path: '/docs/how-to/broker-setup', title: 'Set Up MQTT Broker' },
      { path: '/docs/how-to/troubleshooting', title: 'Troubleshooting' },
    ],
  },
  {
    title: 'SDKs',
    items: [
      { path: '/docs/sdks/javascript', title: 'JavaScript' },
      { path: '/docs/sdks/python', title: 'Python' },
      { path: '/docs/sdks/go', title: 'Go' },
      { path: '/docs/sdks/rust', title: 'Rust' },
      { path: '/docs/sdks/swift', title: 'Swift' },
      { path: '/docs/sdks/wasm', title: 'WASM (Browser)' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { path: '/docs/reference/js-api', title: 'JavaScript API' },
      { path: '/docs/reference/python-api', title: 'Python API' },
      { path: '/docs/reference/firmware-api', title: 'Firmware (C++)' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { path: '/docs/reference/packet-structure', title: 'Packet Structure' },
      { path: '/docs/reference/packet-types', title: 'Packet Types' },
      { path: '/docs/reference/hello-resp', title: 'HELLO_RESP' },
      { path: '/docs/reference/error-codes', title: 'Error Codes' },
      { path: '/docs/reference/datastream-types', title: 'Datastream Types' },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { path: '/docs/concepts/why-binary', title: 'Why Binary' },
      { path: '/docs/concepts/transport-architecture', title: 'Transport Architecture' },
      { path: '/docs/concepts/capability-model', title: 'Capability Model' },
    ],
  },
]
</script>

<style scoped>
.docs-layout {
  display: flex;
  min-height: 100vh;
  padding-top: 56px;
}

.docs-sidebar {
  width: 260px;
  position: fixed;
  top: 56px; left: 0; bottom: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s ease;
}

.sidebar-backdrop {
  display: none;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sans);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-bright);
  text-decoration: none;
}

.sidebar-version {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
}

.sidebar-nav {
  padding: 12px 0;
  flex: 1;
}

.nav-group { margin-bottom: 8px; }

.nav-group-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  padding: 12px 20px 4px;
}

.nav-link {
  display: block;
  padding: 6px 20px;
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
  border-left: 2px solid transparent;
  transition: color 0.15s, background 0.15s;
}

.nav-link:hover { color: var(--text-bright); background: var(--hover-bg); }
.nav-link.router-link-active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: var(--accent-dim);
  font-weight: 500;
}

.docs-main {
  margin-left: 260px;
  flex: 1;
  padding: 48px 64px;
  max-width: 820px;
}

.docs-main :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 16px;
}

.docs-main :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  margin: 36px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text-bright);
}

.docs-main :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-bright);
  margin: 24px 0 8px;
}

.docs-main :deep(p) {
  line-height: 1.75;
  margin-bottom: 12px;
}

.docs-main :deep(pre) {
  background: var(--pre-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 20px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  margin: 16px 0;
}

.docs-main :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

.docs-main :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 16px 0;
}

.docs-main :deep(th) {
  text-align: left;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  border-bottom: 2px solid var(--border);
}

.docs-main :deep(td) {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
}

.docs-main :deep(td code) {
  font-size: 13px;
}

.docs-main :deep(ul), .docs-main :deep(ol) {
  padding-left: 24px;
  margin-bottom: 12px;
}

.docs-main :deep(li) {
  margin-bottom: 4px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .docs-sidebar {
    transform: translateX(-100%);
    z-index: 150;
  }
  .docs-sidebar.open {
    transform: translateX(0);
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    top: 56px;
    background: rgba(0,0,0,0.5);
    z-index: 140;
  }
  .docs-main { margin-left: 0; padding: 32px 24px; }
}
</style>
