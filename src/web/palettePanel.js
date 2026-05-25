const PALETTE_LABELS = {
  rolesAndJobs: '职能',
  mechanics: '机制',
  enemiesAndMarkers: '标记',
  shapes: '形状',
  backgrounds: '地面',
}

const EXTRA_SHAPE_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
]

export function renderPaletteTabs({ state, elements, onAddObject }) {
  elements.paletteTabs.innerHTML = ''
  for (const key of Object.keys(state.iconGroups)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = PALETTE_LABELS[key] ?? key
    button.classList.toggle('active', key === state.activeGroup)
    button.addEventListener('click', () => {
      state.activeGroup = key
      renderPaletteTabs({ state, elements, onAddObject })
    })
    elements.paletteTabs.append(button)
  }
  renderPalette({ state, elements, onAddObject })
}

function renderPalette({ state, elements, onAddObject }) {
  elements.palette.innerHTML = ''
  const extras = state.activeGroup === 'shapes' ? EXTRA_SHAPE_TYPES : []
  const types = [...(state.iconGroups[state.activeGroup] ?? []), ...extras]
  for (const type of [...new Set(types)]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.title = type
    const config = state.iconConfigs[type]
    if (config) {
      const img = document.createElement('img')
      img.src = `/assets/objects/${config.src}.webp`
      img.alt = type
      button.append(img)
    } else {
      const span = document.createElement('span')
      span.className = 'text-swatch'
      span.textContent = type === 'text' ? 'T' : type.slice(0, 2)
      button.append(span)
    }
    button.addEventListener('click', () => onAddObject(type))
    elements.palette.append(button)
  }
}
