# CLAUDE.md — svgic

## Описание проекта

`svgic` — опенсорс npm библиотека. Интерактивный SVG-клиент: встраивает SVG в DOM,
привязывает слои к данным, генерирует UI (попапы, раскраску), обрабатывает события
(hover, click, zoom, pan). Универсальна для JS/TS/Vue/React и любых будущих фреймворков.

---

## Стек

| | |
|---|---|
| Язык | TypeScript |
| Сборщик | Vite (lib mode) |
| Тесты | Vitest (unit), Playwright (e2e — позже) |
| Playground | Vite app внутри репо |
| Пакет | Один (`svgic`), адаптеры в подпапках (`svgic/vue`, `svgic/react`) |
| Лицензия | MIT |

---

## Структура проекта

```
svgic/
├── src/
│   ├── core/          # ядро: парсинг SVG, маппинг данных, события
│   ├── ui/            # попапы, цветовые темы
│   ├── plugins/       # plugin API (хуки)
│   ├── adapters/
│   │   ├── vue/       # компонент <Svgic /> + composable useSvgic()
│   │   └── react/     # компонент <Svgic /> + hook useSvgic()
│   └── index.ts       # публичный API
├── playground/        # ручное тестирование (Vite app)
│   ├── index.html
│   ├── main.ts
│   └── demo.svg
├── tests/             # Vitest unit тесты
├── dist/              # сборка (git ignore)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Ключевые решения архитектуры

### Слои SVG
- Слои идентифицируются по **`id`** на `<g>` элементах
- Роль слоя задаётся в **конфиге** (не в SVG-файле) — совместимо с любым редактором
- Роли: `interactive` | `decorative` | `labels`

```ts
new Svgic('#container', {
  layers: {
    'rooms':      { role: 'interactive' },
    'background': { role: 'decorative' },
  }
})
```

### Источник SVG
- URL: `src: '/map.svg'`
- Строка: `src: '<svg>...</svg>'`

### Данные (слой данных)
- JSON-массив или типизированная переменная
- Базовая схема + кастомные поля

```ts
interface SvgicItem {
  id: string          // совпадает с id элемента в SVG
  title?: string
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // кастомные поля
}
```

### API — императивное
```ts
const client = new Svgic('#container', options)
client.setData(newData)
client.on('click', (id, data) => { ... })
client.setHighlight('free', ['room-101'])
client.clearHighlight('free')
client.destroy()
```

### Плагины — хуки
```ts
const myPlugin = {
  name: 'my-plugin',
  onInit(client) { ... },
  onElementHover(element, data) { ... },
  onElementClick(element, data) { ... },   // return false — отменить дефолт
}
client.use(myPlugin)
```

### Vue адаптер
```vue
<Svgic src="/map.svg" :data="items" @click="onItemClick" />
```
```ts
const { client, highlight } = useSvgic(options)
```

---

## Команды

```powershell
# Ручное тестирование (playground)
npm run dev

# Unit тесты
npm run test

# Typecheck (использовать вместо build во время разработки)
npx vue-tsc --noEmit

# Build библиотеки (только перед push или по явному запросу)
npm run build
```

---

## Правила разработки

- OS: Windows, shell: PowerShell
- Не запускать `npm run build` в процессе разработки — только typecheck
- dev-сервер считать запущенным, не перезапускать без запроса
- Не удалять файлы без подтверждения
- Коммиты на русском языке, использовать скилл `/commit`
