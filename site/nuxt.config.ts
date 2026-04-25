import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  modules: [
    '@nuxt/content',
    '@nuxtjs/color-mode',
  ],

  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark',
  },

  content: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark',
      },
      langs: ['javascript', 'typescript', 'python', 'go', 'rust', 'cpp', 'bash', 'json'],
    },
  },

  app: {
    head: {
      title: 'CONDUYT - Open Binary Protocol for Hardware Control',
      meta: [
        { name: 'description', content: 'Open binary protocol for transport-agnostic, capability-first hardware control. An alternative to Firmata, Johnny-Five, and Blynk.' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      ],
    },
  },

  css: ['~/assets/css/conduyt-theme.css'],

  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => tag === 'esp-web-install-button',
    },
  },

  vite: {
    optimizeDeps: {
      exclude: ['conduyt-wasm'],
    },
    // Target esnext so esbuild doesn't try to transpile modern syntax
    // (destructuring, top-level await, etc.) emitted by vite-plugin-top-level-await
    // and the wasm-bindgen JS shim. The playground requires WebSerial / WebUSB
    // anyway — all of those browsers support modern ES well past these features.
    build: {
      target: 'esnext',
    },
    esbuild: {
      target: 'esnext',
    },
    plugins: [
      // wasm-pack bundler-target packages need explicit Vite handling.
      wasm(),
      topLevelAwait(),
    ],
  },
})
