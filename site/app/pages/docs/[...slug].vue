<template>
  <NuxtLayout name="docs">
    <ContentRenderer v-if="page" :value="page" />
    <div v-else class="not-found">
      <h1>Page Not Found</h1>
      <p>This documentation page doesn't exist yet.</p>
      <NuxtLink to="/docs">Go to Documentation</NuxtLink>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
const route = useRoute()
const { data: page } = await useAsyncData(
  `docs-${route.path}`,
  () => queryCollection('content').path(route.path).first()
)
</script>

<style scoped>
.not-found {
  text-align: center;
  padding: 80px 0;
}
.not-found h1 {
  font-family: var(--heading);
  font-size: 24px;
  letter-spacing: 4px;
  margin-bottom: 12px;
}
.not-found p {
  color: var(--text-dim);
  margin-bottom: 24px;
}
</style>
