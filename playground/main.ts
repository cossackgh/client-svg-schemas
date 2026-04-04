import { Svgic } from 'svgic'
import type { SvgicItem, PopupOption } from 'svgic'

// --- данные ---

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Переговорная А', description: 'Основная переговорная, оснащена проектором и видеосвязью', status: 'free', capacity: 12 },
  { id: 'room-102', title: 'Опен-спейс', description: 'Рабочее пространство продуктовой команды', status: 'busy', capacity: 30 },
  { id: 'room-103', title: 'Кухня', description: 'Зона отдыха и питания, кофемашина, холодильник', status: 'free', capacity: 20 },
  { id: 'room-201', title: 'Кабинет директора', description: 'Кабинет и приёмная генерального директора', status: 'busy', capacity: 4 },
  { id: 'room-202', title: 'Бухгалтерия', description: 'Финансовый и бухгалтерский отдел', status: 'free', capacity: 8 },
  { id: 'room-203', title: 'Серверная', description: 'Серверное оборудование и сетевая инфраструктура', status: 'restricted', capacity: 2 },
]

// --- popup-режимы ---

type PopupMode = 'element' | 'cursor' | 'target' | 'off'

const POPUP_CONFIGS: Record<PopupMode, PopupOption> = {
  element: { placement: 'element', anchor: 'top-center', flip: true },
  cursor:  { placement: 'cursor', offset: { x: 16, y: 16 } },
  target:  { placement: 'target', target: '#info-panel' },
  off:     false,
}

const MODE_HINTS: Record<PopupMode, string> = {
  element: '',
  cursor:  '',
  target:  '← hover сюда',
  off:     '',
}

// --- UI-элементы ---

const infoHint      = document.getElementById('info-hint')!
const infoCard      = document.getElementById('info-card')!
const infoTitle     = document.getElementById('info-title')!
const infoDesc      = document.getElementById('info-desc')!
const infoId        = document.getElementById('info-id')!
const infoStatus    = document.getElementById('info-status')!
const infoCap       = document.getElementById('info-capacity')!
const eventLog      = document.getElementById('event-log')!
const infoPanelMode = document.getElementById('info-panel-mode')!
const modeButtons   = document.querySelectorAll<HTMLButtonElement>('.mode-btn')

// --- состояние ---

let hoveredId: string | null = null
let activeId:  string | null = null
let currentMode: PopupMode = 'element'
let client: Svgic

// --- вспомогательные ---

function getEl(id: string): Element | null {
  return document.getElementById(id)
}

function setState(id: string | null, state: 'hover' | 'active' | null) {
  if (!id) return
  const el = getEl(id)
  if (!el) return
  el.classList.remove('room-hover', 'room-active')
  if (state === 'hover')  el.classList.add('room-hover')
  if (state === 'active') el.classList.add('room-active')
}

function showInfo(item: SvgicItem | null) {
  // В target-режиме панель управляется PopupManager — не перезаписываем
  if (currentMode === 'target') return

  if (!item) {
    infoCard.classList.remove('visible')
    infoHint.style.display = ''
    return
  }
  infoHint.style.display = 'none'
  infoCard.classList.add('visible')
  infoTitle.textContent = item.title ?? item.id
  infoDesc.textContent  = (item.description as string) ?? ''
  infoId.textContent    = item.id

  const status = item.status as string | undefined
  const statusLabels: Record<string, string> = { free: 'Свободно', busy: 'Занято', restricted: 'Ограничен доступ' }
  infoStatus.innerHTML = status
    ? `<span class="status-badge status-${status}">${statusLabels[status] ?? status}</span>`
    : '—'

  infoCap.textContent = item.capacity ? `${item.capacity} чел.` : '—'
}

function addLog(type: 'click' | 'hover' | 'leave', id: string, item: SvgicItem | null) {
  const el = document.createElement('div')
  el.className = `log-entry ${type}`
  const label = item?.title ?? (id || 'пусто')
  el.textContent = `${type.padEnd(5)}  ${label}`
  const h2 = eventLog.querySelector('h2')!
  h2.after(el)
  const entries = eventLog.querySelectorAll('.log-entry')
  if (entries.length > 30) entries[entries.length - 1].remove()
}

// --- инициализация клиента ---

function createClient(mode: PopupMode): Svgic {
  const instance = new Svgic('#schema-container', {
    src: '/demo.svg',
    layers: {
      rooms:      { role: 'interactive' },
      background: { role: 'decorative' },
    },
    data: rooms,
    popup: POPUP_CONFIGS[mode],
  })

  instance.on('hover', (id, item) => {
    if (id === hoveredId) return
    if (hoveredId && hoveredId !== activeId) setState(hoveredId, null)
    hoveredId = id || null
    if (id && id !== activeId) setState(id, 'hover')
    if (id) addLog('hover', id, item)
  })

  instance.on('leave', (id, item) => {
    if (id && id !== activeId) setState(id, null)
    hoveredId = null
    addLog('leave', id, item)

    // В target-режиме восстанавливаем панель после hover
    if (currentMode === 'target' && activeId) {
      const activeItem = rooms.find(r => r.id === activeId) ?? null
      showInfoForTarget(activeItem)
    } else if (currentMode === 'target') {
      showInfoForTarget(null)
    }
  })

  instance.on('click', (id, item) => {
    if (activeId && activeId !== id) setState(activeId, null)
    activeId = id || null
    if (id) {
      setState(id, 'active')
      showInfo(item)
    } else {
      showInfo(null)
    }
    addLog('click', id, item)
  })

  return instance
}

// В target-режиме PopupManager пишет в #info-panel напрямую,
// поэтому нам нужна отдельная функция для восстановления click-карточки
function showInfoForTarget(item: SvgicItem | null) {
  if (!item) {
    infoCard.classList.remove('visible')
    infoHint.style.display = ''
    return
  }
  infoHint.style.display = 'none'
  infoCard.classList.add('visible')
  infoTitle.textContent = item.title ?? item.id
  infoDesc.textContent  = (item.description as string) ?? ''
  infoId.textContent    = item.id

  const status = item.status as string | undefined
  const statusLabels: Record<string, string> = { free: 'Свободно', busy: 'Занято', restricted: 'Ограничен доступ' }
  infoStatus.innerHTML = status
    ? `<span class="status-badge status-${status}">${statusLabels[status] ?? status}</span>`
    : '—'
  infoCap.textContent = item.capacity ? `${item.capacity} чел.` : '—'
}

// --- переключение режима ---

function switchMode(mode: PopupMode) {
  currentMode = mode
  hoveredId = null
  activeId = null

  client.destroy()
  client = createClient(mode)
  ;(window as unknown as Record<string, unknown>).client = client

  infoPanelMode.textContent = MODE_HINTS[mode]

  // Сбрасываем info-панель
  if (mode !== 'target') {
    infoCard.classList.remove('visible')
    infoHint.style.display = ''
  }

  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })
}

// --- старт ---

client = createClient(currentMode)
;(window as unknown as Record<string, unknown>).client = client

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode as PopupMode))
})
