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

  vite: {
    optimizeDeps: {
      exclude: ['conduyt-wasm'],
    },
  },
})
