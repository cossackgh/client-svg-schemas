import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import { Svgic } from '../../core/Svgic'
import type { SvgicOptions } from '../../types'

export function useSvgic(options: SvgicOptions) {
  const containerRef = ref<HTMLElement | null>(null)
  const client = shallowRef<Svgic | null>(null)

  onMounted(async () => {
    if (!containerRef.value) return
    const c = new Svgic(containerRef.value, options)
    await c.ready
    client.value = c
  })

  onUnmounted(() => {
    client.value?.destroy()
    client.value = null
  })

  return { containerRef, client }
}
