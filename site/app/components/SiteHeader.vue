<template>
  <header class="site-header">
    <div class="header-inner">
      <div class="header-left">
        <button v-if="showHamburger" class="hamburger" aria-label="Toggle navigation" @click="mobileNav.toggle()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <NuxtLink to="/" class="header-logo">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="8" width="5" height="12" :fill="accentColor" opacity="0.9"/>
            <rect x="21" y="8" width="5" height="12" :fill="accentColor" opacity="0.9"/>
            <rect x="9" y="4" width="10" height="4" :fill="accentColor" opacity="0.5"/>
            <rect x="9" y="20" width="10" height="4" :fill="accentColor" opacity="0.5"/>
            <circle cx="14" cy="14" r="2" :fill="accentColor"/>
          </svg>
          <span>CONDUYT</span>
        </NuxtLink>
      </div>
      <nav class="header-nav">
        <NuxtLink to="/docs/getting-started/introduction" class="header-link">Docs</NuxtLink>
        <a href="https://github.com/virgilvox/conduyt" class="header-link" target="_blank" rel="noopener">GitHub</a>
        <ColorModeToggle />
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useMobileNav } from '~/composables/useMobileNav'

const mobileNav = useMobileNav()
const route = useRoute()
const showHamburger = computed(() => route.path.startsWith('/docs'))

const colorMode = useColorMode()
const accentColor = computed(() => colorMode.value === 'light' ? '#009d7e' : '#00d4aa')
</script>

<style scoped>
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 200;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 24px;
  max-width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sans);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--text-bright);
  text-decoration: none;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-link {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  text-decoration: none;
  transition: color 0.15s;
}
.header-link:hover {
  color: var(--accent);
  text-decoration: none;
}

@media (max-width: 900px) {
  .hamburger { display: flex; }
}
</style>
