import { onMounted, onUnmounted, ref } from 'vue'

export function useConnectivity() {
  const readOnline = () =>
    typeof window === 'undefined' || typeof navigator === 'undefined' ? true : navigator.onLine !== false
  const isOnline = ref(readOnline())

  const updateOnline = () => {
    isOnline.value = true
  }

  const updateOffline = () => {
    isOnline.value = false
  }

  onMounted(() => {
    isOnline.value = readOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', updateOnline)
    window.removeEventListener('offline', updateOffline)
  })

  return { isOnline }
}
