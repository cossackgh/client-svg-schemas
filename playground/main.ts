import { Svgic } from 'svgic'

const client = new Svgic('#schema-container', {
  src: '/demo.svg',
  layers: {
    'rooms': { role: 'interactive' },
    'background': { role: 'decorative' },
  },
  data: [
    { id: 'room-101', title: 'Комната 101', description: 'Переговорная' },
    { id: 'room-102', title: 'Комната 102', description: 'Опен-спейс' },
  ],
})

// Для отладки в консоли браузера
;(window as unknown as Record<string, unknown>).client = client
