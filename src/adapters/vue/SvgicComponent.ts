import { defineComponent, ref, h, onMounted, onUnmounted, watch } from 'vue'
import type { PropType } from 'vue'
import { Svgic } from '../../core/Svgic'
import type { SvgicItem, SvgicLayer, SvgicPlugin } from '../../types'

export const SvgicVue = defineComponent({
  name: 'Svgic',

  props: {
    src: {
      type: String,
      required: true,
    },
    data: {
      type: Array as PropType<SvgicItem[]>,
      default: undefined,
    },
    layers: {
      type: Object as PropType<Record<string, SvgicLayer>>,
      default: undefined,
    },
    plugins: {
      type: Array as PropType<SvgicPlugin[]>,
      default: undefined,
    },
  },

  emits: {
    click: (_id: string, _item: SvgicItem | null) => true,
    hover: (_id: string, _item: SvgicItem | null) => true,
    leave: (_id: string, _item: SvgicItem | null) => true,
  },

  setup(props, { emit }) {
    const containerRef = ref<HTMLElement | null>(null)
    let client: Svgic | null = null

    onMounted(async () => {
      if (!containerRef.value) return

      client = new Svgic(containerRef.value, {
        src: props.src,
        data: props.data,
        layers: props.layers,
        plugins: props.plugins,
      })

      await client.ready

      client.on('click', (id, item) => emit('click', id, item))
      client.on('hover', (id, item) => emit('hover', id, item))
      client.on('leave', (id, item) => emit('leave', id, item))
    })

    watch(
      () => props.data,
      (newData) => {
        if (client && newData) client.setData(newData)
      },
    )

    onUnmounted(() => {
      client?.destroy()
      client = null
    })

    return () => h('div', { ref: containerRef })
  },
})
