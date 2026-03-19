const isOpen = ref(false)

export const useMobileNav = () => {
  const toggle = () => { isOpen.value = !isOpen.value }
  const close = () => { isOpen.value = false }
  return { isOpen: readonly(isOpen), toggle, close }
}
