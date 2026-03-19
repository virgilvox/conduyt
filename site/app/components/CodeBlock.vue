<template>
  <div class="code-block">
    <pre v-if="highlighted" v-html="highlighted" />
    <pre v-else><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ code: string; lang: string }>()
const highlighted = ref<string | null>(null)

onMounted(async () => {
  try {
    const { codeToHtml } = await import('shiki')
    const html = await codeToHtml(props.code, {
      lang: props.lang,
      theme: 'github-dark',
    })
    highlighted.value = html
  } catch {
    // fallback to plain text
  }
})
</script>

<style scoped>
.code-block :deep(pre) {
  background: #0d1117 !important;
  border: none;
  margin: 0;
  padding: 20px 24px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  border-radius: 0;
  color: #c9d1d9;
}

.code-block :deep(code) {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  font-size: inherit;
  color: inherit;
}

.code-block :deep(.shiki) {
  background: transparent !important;
}
</style>
