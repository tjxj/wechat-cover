export type SizeId =
  | 'compact-34'
  | 'xhs-34'
  | 'square-1'
  | 'landscape-43'
  | 'story-916'
  | 'wide-219'

export type BuiltinTemplateId =
  | 'quote-card'
  | 'story-glow'
  | 'clean-grid'
  | 'wide-launch'

export type TemplateId = string
export type TemplateSource = 'builtin' | 'custom'
export type FontId =
  | 'sans'
  | 'serif'
  | 'display'
  | 'handwritten'
  | 'brush'
export type TextAlign = 'left' | 'center' | 'right'
export type LayerAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
export type LayerKind = 'text' | 'image'
export type ImageShape = 'rounded' | 'circle'

export interface CanvasSize {
  id: SizeId
  name: string
  label: string
  width: number
  height: number
}

export interface CanvasBackground {
  fill: string
  accent: string
  panel: string
  texture: string
  textureSize?: string
}

interface BaseLayer {
  id: string
  kind: LayerKind
  x: number
  y: number
  width: number
  height: number
}

export interface TextLayer extends BaseLayer {
  kind: 'text'
  content: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  fontId: FontId
  color: string
  background: string
  strokeWidth: number
  strokeColor: string
  shadowBlur: number
  shadowColor: string
  textAlign: TextAlign
  weight: number
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

export interface ImageLayer extends BaseLayer {
  kind: 'image'
  src: string
  name: string
  aspectRatio: number
  radius: number
  shape: ImageShape
}

export type CanvasLayer = TextLayer | ImageLayer

export interface EditorState {
  templateId: TemplateId
  templateName: string
  templateSource: TemplateSource
  size: CanvasSize
  background: CanvasBackground
  layers: CanvasLayer[]
  selectedLayerId: string
  selectedLayerIds: string[]
}

export interface UserTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  snapshot: EditorState
}

export interface BackgroundPreset {
  id: string
  name: string
  background: CanvasBackground
}

type TextSeed = Omit<
  TextLayer,
  | 'id'
  | 'kind'
  | 'height'
  | 'strokeWidth'
  | 'strokeColor'
  | 'shadowBlur'
  | 'shadowColor'
  | 'italic'
  | 'underline'
  | 'strikethrough'
> &
  Partial<
    Pick<
      TextLayer,
      | 'strokeWidth'
      | 'strokeColor'
      | 'shadowBlur'
      | 'shadowColor'
      | 'italic'
      | 'underline'
      | 'strikethrough'
    >
  >

interface TemplateDefinition {
  id: BuiltinTemplateId
  name: string
  description: string
  baseSizeId: SizeId
  background: CanvasBackground
  layers: TextSeed[]
}

const DEFAULT_STROKE_COLOR = 'rgba(255,255,255,0.96)'
const DEFAULT_SHADOW_COLOR = 'rgba(15,23,42,0.35)'

const getCharacterWidthFactor = (char: string) => {
  if (char === ' ') {
    return 0.35
  }

  if (/[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]/.test(char)) {
    return 1
  }

  if (/[A-Z]/.test(char)) {
    return 0.72
  }

  if (/[a-z0-9]/.test(char)) {
    return 0.58
  }

  return 0.52
}

const estimateTextHeight = (
  content: string,
  width: number,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
  hasFrame: boolean,
) => {
  const safeWidth = Math.max(width - (hasFrame ? 36 : 0), fontSize)
  const wrappedLines = content.split('\n').reduce((total, line) => {
    if (!line.trim()) {
      return total + 1
    }

    const glyphWidth = [...line].reduce(
      (sum, char) => sum + getCharacterWidthFactor(char) * fontSize,
      0,
    )
    const spacingWidth = Math.max(0, line.length - 1) * letterSpacing
    const lineWidth = glyphWidth + spacingWidth

    return total + Math.max(1, Math.ceil(lineWidth / safeWidth))
  }, 0)

  const verticalPadding = hasFrame ? 32 : 0

  return Number(
    (fontSize * lineHeight * Math.max(wrappedLines, 1) + verticalPadding).toFixed(
      1,
    ),
  )
}

const toTextLayer = (layer: TextSeed, id = nextId('layer')): TextLayer => ({
  ...layer,
  strokeWidth: layer.strokeWidth ?? 0,
  strokeColor: layer.strokeColor ?? DEFAULT_STROKE_COLOR,
  shadowBlur: layer.shadowBlur ?? 0,
  shadowColor: layer.shadowColor ?? DEFAULT_SHADOW_COLOR,
  italic: layer.italic ?? false,
  underline: layer.underline ?? false,
  strikethrough: layer.strikethrough ?? false,
  id,
  kind: 'text',
  height: estimateTextHeight(
    layer.content,
    layer.width,
    layer.fontSize,
    layer.lineHeight,
    layer.letterSpacing,
    layer.background !== 'transparent',
  ),
})

const getImageAspectRatio = (
  layer: Pick<ImageLayer, 'aspectRatio' | 'width' | 'height'>,
) => {
  const fallbackRatio = layer.width / Math.max(layer.height, 1)
  const ratio = layer.aspectRatio || fallbackRatio || 1

  return Number(Math.max(ratio, 0.1).toFixed(4))
}

const scaleImageToMinimum = (width: number, height: number) => {
  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)

  if (safeWidth >= 72 && safeHeight >= 72) {
    return {
      width: Number(safeWidth.toFixed(1)),
      height: Number(safeHeight.toFixed(1)),
    }
  }

  const scale = Math.max(72 / safeWidth, 72 / safeHeight)

  return {
    width: Number((safeWidth * scale).toFixed(1)),
    height: Number((safeHeight * scale).toFixed(1)),
  }
}

const normalizeImageLayer = (layer: ImageLayer): ImageLayer => {
  const aspectRatio = getImageAspectRatio(layer)

  if (layer.shape === 'circle') {
    const side = Number(Math.max(72, Math.min(layer.width, layer.height)).toFixed(1))
    return {
      ...layer,
      aspectRatio,
      width: side,
      height: side,
      radius: 999,
    }
  }

  const nextSize = scaleImageToMinimum(layer.width, layer.height)

  return {
    ...layer,
    aspectRatio,
    width: nextSize.width,
    height: nextSize.height,
    radius: Number(Math.max(0, layer.radius).toFixed(1)),
  }
}

const normalizeTextLayer = (layer: TextLayer): TextLayer => {
  const width = Number(Math.max(120, layer.width).toFixed(1))
  const lineHeight = Number(
    Math.min(Math.max(layer.lineHeight ?? 1.2, 0.9), 2.2).toFixed(2),
  )
  const letterSpacing = Number(
    Math.min(Math.max(layer.letterSpacing ?? 0, -4), 12).toFixed(1),
  )

  return {
    ...layer,
    width,
    lineHeight,
    letterSpacing,
    weight: Number(Math.min(Math.max(layer.weight ?? 700, 400), 900).toFixed(0)),
    italic: Boolean(layer.italic),
    underline: Boolean(layer.underline),
    strikethrough: Boolean(layer.strikethrough),
    strokeWidth: Number(Math.min(Math.max(layer.strokeWidth ?? 0, 0), 12).toFixed(1)),
    strokeColor: layer.strokeColor ?? DEFAULT_STROKE_COLOR,
    shadowBlur: Number(Math.min(Math.max(layer.shadowBlur ?? 0, 0), 48).toFixed(1)),
    shadowColor: layer.shadowColor ?? DEFAULT_SHADOW_COLOR,
    height: estimateTextHeight(
      layer.content,
      width,
      layer.fontSize,
      lineHeight,
      letterSpacing,
      layer.background !== 'transparent',
    ),
  }
}

const normalizeLayer = (layer: CanvasLayer): CanvasLayer =>
  layer.kind === 'text' ? normalizeTextLayer(layer) : normalizeImageLayer(layer)

const cloneState = (state: EditorState): EditorState =>
  JSON.parse(JSON.stringify(state)) as EditorState

export const isTextLayer = (layer: CanvasLayer): layer is TextLayer =>
  layer.kind === 'text'

export const isImageLayer = (layer: CanvasLayer): layer is ImageLayer =>
  layer.kind === 'image'

export const SIZE_PRESETS: CanvasSize[] = [
  {
    id: 'compact-34',
    name: '3:4 紧凑版',
    label: '720 × 960',
    width: 720,
    height: 960,
  },
  {
    id: 'xhs-34',
    name: '3:4 小红书',
    label: '960 × 1280',
    width: 960,
    height: 1280,
  },
  {
    id: 'square-1',
    name: '1:1 方形',
    label: '1080 × 1080',
    width: 1080,
    height: 1080,
  },
  {
    id: 'landscape-43',
    name: '4:3 横版',
    label: '1280 × 960',
    width: 1280,
    height: 960,
  },
  {
    id: 'story-916',
    name: '9:16 竖版',
    label: '1080 × 1920',
    width: 1080,
    height: 1920,
  },
  {
    id: 'wide-219',
    name: '21:9 超宽',
    label: '2100 × 900',
    width: 2100,
    height: 900,
  },
]

export const FONT_PRESETS = [
  {
    id: 'serif',
    name: 'Noto Serif SC 编辑宋体',
    family:
      '"Noto Serif SC", "Songti SC", "STSong", "Source Han Serif SC", serif',
  },
  {
    id: 'sans',
    name: 'Noto Sans SC 现代黑体',
    family:
      '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  {
    id: 'display',
    name: 'ZCOOL XiaoWei 海报标题',
    family:
      '"ZCOOL XiaoWei", "Noto Serif SC", serif',
  },
  {
    id: 'handwritten',
    name: 'Ma Shan Zheng 手写标题',
    family:
      '"Ma Shan Zheng", "Noto Serif SC", cursive',
  },
  {
    id: 'brush',
    name: 'Long Cang 泼墨字',
    family:
      '"Long Cang", "Noto Sans SC", cursive',
  },
] as const

const builtinTemplates: TemplateDefinition[] = [
  {
    id: 'quote-card',
    name: '引用卡片',
    description: '轻米色背景，适合金句和观点表达。',
    baseSizeId: 'xhs-34',
    background: {
      fill: '#f7f0dc',
      accent: '#1f2329',
      panel: '#fff9eb',
      texture:
        'linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.25))',
    },
    layers: [
      {
        content: '真正拉开差距的，\n往往是那些看起来不起眼的重复。',
        x: 108,
        y: 180,
        width: 744,
        fontSize: 82,
        lineHeight: 1.18,
        letterSpacing: 1.5,
        fontId: 'serif',
        color: '#171717',
        background: 'rgba(255, 238, 164, 0.86)',
        textAlign: 'left',
        weight: 800,
      },
      {
        content: '别急着找捷径，先把笨功夫做厚。',
        x: 116,
        y: 640,
        width: 720,
        fontSize: 34,
        lineHeight: 1.5,
        letterSpacing: 0,
        fontId: 'serif',
        color: '#5b4636',
        background: 'transparent',
        textAlign: 'left',
        weight: 500,
      },
      {
        content: 'AI学习的老章',
        x: 116,
        y: 1122,
        width: 320,
        fontSize: 20,
        lineHeight: 1.2,
        letterSpacing: 2.5,
        fontId: 'serif',
        color: '#7b6656',
        background: 'rgba(255,255,255,0.5)',
        textAlign: 'left',
        weight: 600,
      },
    ],
  },
  {
    id: 'story-glow',
    name: '故事封面',
    description: '深色氛围和亮色标签，适合视频故事标题。',
    baseSizeId: 'story-916',
    background: {
      fill: '#121826',
      accent: '#f472b6',
      panel: '#1f2a44',
      texture:
        'radial-gradient(circle at 20% 20%, rgba(244, 114, 182, 0.28), transparent 32%), radial-gradient(circle at 80% 12%, rgba(96, 165, 250, 0.25), transparent 28%)',
    },
    layers: [
      {
        content: '凌晨三点的灵感',
        x: 120,
        y: 250,
        width: 840,
        fontSize: 96,
        lineHeight: 1.1,
        letterSpacing: 1,
        fontId: 'serif',
        color: '#fdf2f8',
        background: 'rgba(244, 114, 182, 0.24)',
        textAlign: 'left',
        weight: 800,
      },
      {
        content: '把混乱的思绪，剪成一个能讲给别人听的晚上。',
        x: 120,
        y: 820,
        width: 760,
        fontSize: 38,
        lineHeight: 1.45,
        letterSpacing: 0,
        fontId: 'serif',
        color: '#dbeafe',
        background: 'transparent',
        textAlign: 'left',
        weight: 500,
      },
      {
        content: '夜谈 / VLOG',
        x: 120,
        y: 1450,
        width: 280,
        fontSize: 26,
        lineHeight: 1.2,
        letterSpacing: 3,
        fontId: 'serif',
        color: '#fdf2f8',
        background: 'rgba(15, 23, 42, 0.56)',
        textAlign: 'center',
        weight: 700,
      },
    ],
  },
  {
    id: 'clean-grid',
    name: '清单笔记',
    description: '白底分栏，适合经验分享和方法论。',
    baseSizeId: 'square-1',
    background: {
      fill: '#f8fafc',
      accent: '#10b981',
      panel: '#ffffff',
      texture:
        'linear-gradient(180deg, rgba(16, 185, 129, 0.08), transparent 35%)',
    },
    layers: [
      {
        content: '把复杂问题切成 3 步',
        x: 120,
        y: 140,
        width: 840,
        fontSize: 78,
        lineHeight: 1.12,
        letterSpacing: 0.8,
        fontId: 'serif',
        color: '#0f172a',
        background: 'rgba(255,255,255,0.92)',
        textAlign: 'left',
        weight: 800,
      },
      {
        content: '拆目标\n排优先级\n只做下一步',
        x: 120,
        y: 520,
        width: 360,
        fontSize: 44,
        lineHeight: 1.55,
        letterSpacing: 1,
        fontId: 'serif',
        color: '#1f2937',
        background: 'rgba(209, 250, 229, 0.72)',
        textAlign: 'left',
        weight: 700,
      },
      {
        content: '行动比解释更重要',
        x: 590,
        y: 848,
        width: 280,
        fontSize: 28,
        lineHeight: 1.35,
        letterSpacing: 2,
        fontId: 'serif',
        color: '#065f46',
        background: 'transparent',
        textAlign: 'right',
        weight: 700,
      },
    ],
  },
  {
    id: 'wide-launch',
    name: '发布横幅',
    description: '横版信息流，适合更新说明和活动海报。',
    baseSizeId: 'wide-219',
    background: {
      fill: '#fcfaf7',
      accent: '#f97316',
      panel: '#ffffff',
      texture:
        'linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(249, 115, 22, 0))',
    },
    layers: [
      {
        content: '把你的更新做成一张\n一眼就懂的横幅',
        x: 160,
        y: 120,
        width: 1120,
        fontSize: 92,
        lineHeight: 1.1,
        letterSpacing: 0,
        fontId: 'serif',
        color: '#111827',
        background: 'rgba(255,255,255,0.9)',
        textAlign: 'left',
        weight: 800,
      },
      {
        content: '支持封面、标题、重点标签和导出 PNG',
        x: 160,
        y: 520,
        width: 860,
        fontSize: 40,
        lineHeight: 1.4,
        letterSpacing: 0,
        fontId: 'serif',
        color: '#92400e',
        background: 'transparent',
        textAlign: 'left',
        weight: 600,
      },
      {
        content: 'AI学习的老章',
        x: 1620,
        y: 142,
        width: 240,
        fontSize: 24,
        lineHeight: 1.2,
        letterSpacing: 4,
        fontId: 'serif',
        color: '#9a3412',
        background: 'rgba(255, 237, 213, 0.95)',
        textAlign: 'center',
        weight: 700,
      },
    ],
  },
]

const sizeMap = new Map(SIZE_PRESETS.map((preset) => [preset.id, preset]))
const builtinTemplateMap = new Map(
  builtinTemplates.map((template) => [template.id, template]),
)

const nextId = (prefix = 'id') =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

const findSize = (sizeId: SizeId) => sizeMap.get(sizeId) ?? SIZE_PRESETS[0]

const findBuiltinTemplate = (templateId: BuiltinTemplateId) =>
  builtinTemplateMap.get(templateId) ?? builtinTemplates[0]

const scaleLayer = (
  layer: CanvasLayer,
  from: CanvasSize,
  to: CanvasSize,
): CanvasLayer => {
  const scaleX = to.width / from.width
  const scaleY = to.height / from.height
  const scale = Math.min(scaleX, scaleY)

  if (layer.kind === 'text') {
    return normalizeTextLayer({
      ...layer,
      x: Number((layer.x * scaleX).toFixed(1)),
      y: Number((layer.y * scaleY).toFixed(1)),
      width: Number((layer.width * scaleX).toFixed(1)),
      fontSize: Number((layer.fontSize * scale).toFixed(1)),
    })
  }

  return normalizeImageLayer({
    ...layer,
    x: Number((layer.x * scaleX).toFixed(1)),
    y: Number((layer.y * scaleY).toFixed(1)),
    width: Number((layer.width * scaleX).toFixed(1)),
    height: Number((layer.height * scaleY).toFixed(1)),
    radius: Number((layer.radius * scale).toFixed(1)),
  })
}

const buildLayers = (template: TemplateDefinition, size: CanvasSize) => {
  const baseSize = findSize(template.baseSizeId)
  const layers = template.layers.map((layer) => toTextLayer(layer))

  if (baseSize.id === size.id) {
    return layers
  }

  return layers.map((layer) => scaleLayer(layer, baseSize, size))
}

export const TEMPLATE_OPTIONS = builtinTemplates.map((template) => ({
  id: template.id,
  name: template.name,
  description: template.description,
  baseSizeId: template.baseSizeId,
}))

export const COLOR_SWATCHES = [
  '#111827',
  '#ffffff',
  '#f97316',
  '#ef4444',
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#f472b6',
  '#facc15',
  '#22c55e',
]

export const SOLID_BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'solid-paper',
    name: '纸米色',
    background: {
      fill: '#f7f0dc',
      accent: '#1f2329',
      panel: '#fff9eb',
      texture: '',
    },
  },
  {
    id: 'solid-snow',
    name: '雪白',
    background: {
      fill: '#f8fafc',
      accent: '#0f172a',
      panel: '#ffffff',
      texture: '',
    },
  },
  {
    id: 'solid-sky',
    name: '浅天蓝',
    background: {
      fill: '#e0f2fe',
      accent: '#0c4a6e',
      panel: '#f0f9ff',
      texture: '',
    },
  },
  {
    id: 'solid-blush',
    name: '浅粉',
    background: {
      fill: '#fce7f3',
      accent: '#831843',
      panel: '#fff1f7',
      texture: '',
    },
  },
  {
    id: 'solid-charcoal',
    name: '炭黑',
    background: {
      fill: '#111827',
      accent: '#f9fafb',
      panel: '#1f2937',
      texture: '',
    },
  },
  {
    id: 'solid-teal',
    name: '墨青',
    background: {
      fill: '#0f766e',
      accent: '#ecfeff',
      panel: '#115e59',
      texture: '',
    },
  },
]

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'soft-grid-paper',
    name: 'Soft Grid Paper',
    background: {
      fill: '#fbf7ef',
      accent: '#433b2d',
      panel: '#fffdf8',
      texture:
        'repeating-linear-gradient(0deg, rgba(191,181,159,0.18) 0, rgba(191,181,159,0.18) 1px, transparent 1px, transparent 26px), repeating-linear-gradient(90deg, rgba(191,181,159,0.18) 0, rgba(191,181,159,0.18) 1px, transparent 1px, transparent 26px), linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.2))',
    },
  },
  {
    id: 'blueprint-grid',
    name: 'Blueprint Grid',
    background: {
      fill: '#eef5fb',
      accent: '#1d4f73',
      panel: '#f8fbff',
      texture:
        'repeating-linear-gradient(0deg, rgba(106,144,173,0.2) 0, rgba(106,144,173,0.2) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, rgba(106,144,173,0.2) 0, rgba(106,144,173,0.2) 1px, transparent 1px, transparent 24px), linear-gradient(rgba(255,255,255,0.45), rgba(255,255,255,0.12))',
    },
  },
  {
    id: 'notebook-checks',
    name: 'Notebook Checks',
    background: {
      fill: '#fffdf8',
      accent: '#6b5b45',
      panel: '#ffffff',
      texture:
        'repeating-linear-gradient(0deg, rgba(219,213,201,0.48) 0, rgba(219,213,201,0.48) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(219,213,201,0.48) 0, rgba(219,213,201,0.48) 1px, transparent 1px, transparent 28px)',
    },
  },
  {
    id: 'dot-matrix-paper',
    name: 'Dot Matrix Paper',
    background: {
      fill: '#fcfaf5',
      accent: '#4b5563',
      panel: '#ffffff',
      texture:
        'radial-gradient(circle, rgba(148,163,184,0.32) 1.2px, transparent 1.3px), linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.18))',
      textureSize: '22px 22px, auto',
    },
  },
  {
    id: 'paper-fade',
    name: 'Paper Fade',
    background: {
      fill: '#f7f0dc',
      accent: '#1f2329',
      panel: '#fff9eb',
      texture:
        'linear-gradient(150deg, rgba(255,255,255,0.88), rgba(255,255,255,0.42) 42%, rgba(247,240,220,0.12))',
    },
  },
  {
    id: 'margo',
    name: 'Margo',
    background: {
      fill: '#ffefba',
      accent: '#8f6c22',
      panel: '#fffdf7',
      texture:
        'linear-gradient(135deg, rgba(255,239,186,0.96), rgba(255,255,255,0.98))',
    },
  },
  {
    id: 'moonlit-asteroid',
    name: 'Moonlit Asteroid',
    background: {
      fill: '#0F2027',
      accent: '#b6d8e6',
      panel: '#142a34',
      texture: 'linear-gradient(135deg, #0F2027, #203A43 54%, #2C5364)',
    },
  },
  {
    id: 'wiretap',
    name: 'Wiretap',
    background: {
      fill: '#8A2387',
      accent: '#ffe0cc',
      panel: '#a42c78',
      texture: 'linear-gradient(135deg, #8A2387, #E94057 52%, #F27121)',
    },
  },
  {
    id: 'jshine',
    name: 'JShine',
    background: {
      fill: '#12c2e9',
      accent: '#ffffff',
      panel: '#56cce7',
      texture: 'linear-gradient(135deg, #12c2e9, #c471ed 52%, #f64f59)',
    },
  },
  {
    id: 'sublime-light',
    name: 'Sublime Light',
    background: {
      fill: '#FC5C7D',
      accent: '#ffffff',
      panel: '#f97392',
      texture: 'linear-gradient(135deg, #FC5C7D, #6A82FB)',
    },
  },
  {
    id: 'summer-dog',
    name: 'Summer Dog',
    background: {
      fill: '#a8ff78',
      accent: '#083344',
      panel: '#ddffd0',
      texture: 'linear-gradient(135deg, #a8ff78, #78ffd6)',
    },
  },
  {
    id: 'lush',
    name: 'Lush',
    background: {
      fill: '#56ab2f',
      accent: '#f5fff0',
      panel: '#6ab640',
      texture: 'linear-gradient(135deg, #56ab2f, #a8e063)',
    },
  },
  {
    id: 'quepal',
    name: 'Quepal',
    background: {
      fill: '#11998e',
      accent: '#effff7',
      panel: '#15a392',
      texture: 'linear-gradient(135deg, #11998e, #38ef7d)',
    },
  },
  {
    id: 'frozen',
    name: 'Frozen',
    background: {
      fill: '#403B4A',
      accent: '#ffffff',
      panel: '#4d4858',
      texture: 'linear-gradient(135deg, #403B4A, #E7E9BB)',
    },
  },
]

export const FONT_LOOKUP = Object.fromEntries(
  FONT_PRESETS.map((preset) => [preset.id, preset.family]),
) as Record<FontId, string>

export const createEditorState = (
  templateId: BuiltinTemplateId,
  sizeId?: SizeId,
): EditorState => {
  const template = findBuiltinTemplate(templateId)
  const size = findSize(sizeId ?? template.baseSizeId)
  const layers = buildLayers(template, size)

  return {
    templateId: template.id,
    templateName: template.name,
    templateSource: 'builtin',
    size,
    background: { ...template.background },
    layers,
    selectedLayerId: layers[0]?.id ?? '',
    selectedLayerIds: layers[0] ? [layers[0].id] : [],
  }
}

export const resizeState = (state: EditorState, sizeId: SizeId): EditorState => {
  const nextSize = findSize(sizeId)

  if (state.size.id === nextSize.id) {
    return state
  }

  return {
    ...state,
    size: nextSize,
    layers: state.layers.map((layer) => scaleLayer(layer, state.size, nextSize)),
  }
}

export const setBuiltinTemplate = (
  current: EditorState,
  templateId: BuiltinTemplateId,
  sizeId?: SizeId,
) => createEditorState(templateId, sizeId ?? current.size.id)

export const getLayerById = (state: EditorState, layerId: string) =>
  state.layers.find((layer) => layer.id === layerId)

const uniqueIds = (layerIds: string[]) => [...new Set(layerIds.filter(Boolean))]

export const getSelectedLayerIds = (state: EditorState) => {
  const validIds = uniqueIds(state.selectedLayerIds ?? []).filter((layerId) =>
    state.layers.some((layer) => layer.id === layerId),
  )

  if (state.layers.some((layer) => layer.id === state.selectedLayerId)) {
    return validIds.includes(state.selectedLayerId)
      ? validIds
      : [...validIds, state.selectedLayerId]
  }

  return validIds
}

export const getPrimarySelectedLayerId = (state: EditorState) =>
  getSelectedLayerIds(state).at(-1) ?? ''

const withSelection = (
  state: EditorState,
  layerIds: string[],
  primaryLayerId?: string,
): EditorState => {
  const validIds = uniqueIds(layerIds).filter((layerId) =>
    state.layers.some((layer) => layer.id === layerId),
  )
  const fallbackPrimary = validIds.at(-1) ?? state.layers[0]?.id ?? ''
  const nextPrimary =
    primaryLayerId && validIds.includes(primaryLayerId)
      ? primaryLayerId
      : fallbackPrimary
  const nextIds = validIds.length > 0 ? validIds : nextPrimary ? [nextPrimary] : []

  return {
    ...state,
    selectedLayerId: nextPrimary,
    selectedLayerIds: nextIds,
  }
}

export const selectLayer = (
  state: EditorState,
  layerId: string,
  options?: {
    additive?: boolean
  },
): EditorState => {
  if (!state.layers.some((layer) => layer.id === layerId)) {
    return state
  }

  if (!options?.additive) {
    return withSelection(state, [layerId], layerId)
  }

  const currentIds = getSelectedLayerIds(state)
  const isAlreadySelected = currentIds.includes(layerId)

  if (isAlreadySelected) {
    if (currentIds.length === 1) {
      return withSelection(state, [layerId], layerId)
    }

    const nextIds = currentIds.filter((currentId) => currentId !== layerId)
    const nextPrimary =
      state.selectedLayerId === layerId ? nextIds.at(-1) : state.selectedLayerId

    return withSelection(state, nextIds, nextPrimary)
  }

  return withSelection(state, [...currentIds, layerId], layerId)
}

const clampPosition = (value: number, min: number, max: number) =>
  Number(Math.min(Math.max(value, min), max).toFixed(1))

const getClampedLayerPatch = (
  state: EditorState,
  layer: CanvasLayer,
  patch: Partial<Pick<CanvasLayer, 'x' | 'y'>>,
) => ({
  ...(typeof patch.x === 'number'
    ? {
        x: clampPosition(
          patch.x,
          24,
          Math.max(24, state.size.width - layer.width - 24),
        ),
      }
    : {}),
  ...(typeof patch.y === 'number'
    ? {
        y: clampPosition(
          patch.y,
          24,
          Math.max(24, state.size.height - layer.height - 24),
        ),
      }
    : {}),
})

const getLayersByIds = (state: EditorState, layerIds: string[]) => {
  const selectedSet = new Set(layerIds)
  return state.layers.filter((layer) => selectedSet.has(layer.id))
}

const getLayerBounds = (layers: CanvasLayer[]) => ({
  left: Math.min(...layers.map((layer) => layer.x)),
  right: Math.max(...layers.map((layer) => layer.x + layer.width)),
  top: Math.min(...layers.map((layer) => layer.y)),
  bottom: Math.max(...layers.map((layer) => layer.y + layer.height)),
})

export const alignLayerToCanvas = (
  state: EditorState,
  layerId: string,
  alignment: LayerAlignment,
): EditorState => {
  const layer = getLayerById(state, layerId)

  if (!layer) {
    return state
  }

  const patch =
    alignment === 'left'
      ? { x: 24 }
      : alignment === 'center'
        ? { x: (state.size.width - layer.width) / 2 }
        : alignment === 'right'
          ? { x: state.size.width - layer.width - 24 }
          : alignment === 'top'
            ? { y: 24 }
            : alignment === 'middle'
              ? { y: (state.size.height - layer.height) / 2 }
              : { y: state.size.height - layer.height - 24 }

  return updateLayer(state, layerId, getClampedLayerPatch(state, layer, patch))
}

export const alignLayerToReference = (
  state: EditorState,
  layerId: string,
  referenceId: string,
  alignment: LayerAlignment,
): EditorState => {
  const layer = getLayerById(state, layerId)
  const reference = getLayerById(state, referenceId)

  if (!layer || !reference || layer.id === reference.id) {
    return state
  }

  const patch =
    alignment === 'left'
      ? { x: reference.x }
      : alignment === 'center'
        ? { x: reference.x + (reference.width - layer.width) / 2 }
        : alignment === 'right'
          ? { x: reference.x + reference.width - layer.width }
          : alignment === 'top'
            ? { y: reference.y }
            : alignment === 'middle'
              ? { y: reference.y + (reference.height - layer.height) / 2 }
              : { y: reference.y + reference.height - layer.height }

  return updateLayer(state, layerId, getClampedLayerPatch(state, layer, patch))
}

export const alignSelectedLayers = (
  state: EditorState,
  layerIds: string[],
  alignment: LayerAlignment,
): EditorState => {
  const selectedLayers = getLayersByIds(state, layerIds)

  if (selectedLayers.length < 2) {
    return state
  }

  const bounds = getLayerBounds(selectedLayers)
  const centerX = bounds.left + (bounds.right - bounds.left) / 2
  const centerY = bounds.top + (bounds.bottom - bounds.top) / 2
  const selectedSet = new Set(selectedLayers.map((layer) => layer.id))

  return {
    ...state,
    layers: state.layers.map((layer) => {
      if (!selectedSet.has(layer.id)) {
        return layer
      }

      const nextX =
        alignment === 'left'
          ? bounds.left
          : alignment === 'center'
            ? centerX - layer.width / 2
            : alignment === 'right'
              ? bounds.right - layer.width
              : layer.x
      const nextY =
        alignment === 'top'
          ? bounds.top
          : alignment === 'middle'
            ? centerY - layer.height / 2
            : alignment === 'bottom'
              ? bounds.bottom - layer.height
              : layer.y

      return {
        ...layer,
        x: Number(nextX.toFixed(1)),
        y: Number(nextY.toFixed(1)),
      }
    }),
  }
}

type LayerPositionSnapshot = Record<
  string,
  { x: number; y: number; width: number; height: number }
>

export const getLayerPositionSnapshot = (
  state: EditorState,
  layerIds: string[],
): LayerPositionSnapshot =>
  Object.fromEntries(
    getLayersByIds(state, layerIds).map((layer) => [
      layer.id,
      {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      },
    ]),
  )

export const moveSelectedLayers = (
  state: EditorState,
  layerIds: string[],
  deltaX: number,
  deltaY: number,
  baseSnapshot?: LayerPositionSnapshot,
): EditorState => {
  const snapshot =
    baseSnapshot && Object.keys(baseSnapshot).length > 0
      ? baseSnapshot
      : getLayerPositionSnapshot(state, layerIds)
  const selectedLayers = Object.entries(snapshot)

  if (selectedLayers.length === 0) {
    return state
  }

  const left = Math.min(...selectedLayers.map(([, layer]) => layer.x))
  const right = Math.max(
    ...selectedLayers.map(([, layer]) => layer.x + layer.width),
  )
  const top = Math.min(...selectedLayers.map(([, layer]) => layer.y))
  const bottom = Math.max(
    ...selectedLayers.map(([, layer]) => layer.y + layer.height),
  )
  const appliedDeltaX = clampPosition(
    deltaX,
    24 - left,
    state.size.width - right - 24,
  )
  const appliedDeltaY = clampPosition(
    deltaY,
    24 - top,
    state.size.height - bottom - 24,
  )

  return {
    ...state,
    layers: state.layers.map((layer) => {
      const source = snapshot[layer.id]

      if (!source) {
        return layer
      }

      return {
        ...layer,
        x: Number((source.x + appliedDeltaX).toFixed(1)),
        y: Number((source.y + appliedDeltaY).toFixed(1)),
      }
    }),
  }
}

export const updateLayer = (
  state: EditorState,
  layerId: string,
  patch: Partial<CanvasLayer>,
): EditorState => ({
  ...state,
  layers: state.layers.map((layer) =>
    layer.id !== layerId
      ? layer
      : layer.kind === 'image'
        ? (() => {
            const imagePatch = patch as Partial<ImageLayer>
            const hasWidth =
              typeof imagePatch.width === 'number' &&
              Number.isFinite(imagePatch.width)
            const hasHeight =
              typeof imagePatch.height === 'number' &&
              Number.isFinite(imagePatch.height)

            const lockedSize = (() => {
              if (!hasWidth && !hasHeight) {
                return {}
              }

              if ((imagePatch.shape ?? layer.shape) === 'circle') {
                const side = Number(
                  Math.max(
                    72,
                    imagePatch.width ??
                      imagePatch.height ??
                      Math.min(layer.width, layer.height),
                  ).toFixed(1),
                )

                return {
                  width: side,
                  height: side,
                }
              }

              const ratio = getImageAspectRatio(layer)

              if (hasWidth && !hasHeight) {
                return {
                  width: imagePatch.width,
                  height: Number((imagePatch.width! / ratio).toFixed(1)),
                }
              }

              if (!hasWidth && hasHeight) {
                return {
                  width: Number((imagePatch.height! * ratio).toFixed(1)),
                  height: imagePatch.height,
                }
              }

              const widthScale = imagePatch.width! / Math.max(layer.width, 1)
              const heightScale = imagePatch.height! / Math.max(layer.height, 1)
              const nextScale =
                Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
                  ? widthScale
                  : heightScale

              return {
                width: Number((layer.width * nextScale).toFixed(1)),
                height: Number((layer.height * nextScale).toFixed(1)),
              }
            })()

            return normalizeImageLayer({
              ...layer,
              ...imagePatch,
              ...lockedSize,
            } as ImageLayer)
          })()
        : normalizeTextLayer({ ...layer, ...patch } as TextLayer),
  ),
})

export const addTextBlock = (state: EditorState, content = '输入你的标题') => {
  const scale = state.size.width / 960
  const layer = toTextLayer({
    content,
    x: Number((96 * scale).toFixed(1)),
    y: Number((state.size.height * 0.42).toFixed(1)),
    width: Number((state.size.width * 0.72).toFixed(1)),
    fontSize: Number((64 * scale).toFixed(1)),
    lineHeight: 1.2,
    letterSpacing: 0.8,
    fontId: 'serif',
    color: '#111827',
    background: 'rgba(255,255,255,0.84)',
    textAlign: 'left',
    weight: 800,
  })

  return {
    ...state,
    layers: [...state.layers, layer],
    selectedLayerId: layer.id,
    selectedLayerIds: [layer.id],
  }
}

export const addImageLayer = (
  state: EditorState,
  image: {
    src: string
    name: string
    naturalWidth: number
    naturalHeight: number
  },
) => {
  const safeWidth = Math.max(image.naturalWidth || 1, 1)
  const safeHeight = Math.max(image.naturalHeight || 1, 1)
  const maxWidth = state.size.width * 0.52
  const maxHeight = state.size.height * 0.42
  const scale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight, 1)
  const width = Number(Math.max(140, safeWidth * scale).toFixed(1))
  const height = Number(Math.max(140, safeHeight * scale).toFixed(1))
  const layer: ImageLayer = normalizeImageLayer({
    id: nextId('image'),
    kind: 'image',
    src: image.src,
    name: image.name,
    aspectRatio: Number((safeWidth / safeHeight).toFixed(4)),
    x: Number(((state.size.width - width) / 2).toFixed(1)),
    y: Number(((state.size.height - height) / 2).toFixed(1)),
    width,
    height,
    radius: 24,
    shape: 'rounded',
  })

  return {
    ...state,
    layers: [...state.layers, layer],
    selectedLayerId: layer.id,
    selectedLayerIds: [layer.id],
  }
}

const reorderLayers = (
  state: EditorState,
  layerId: string,
  toIndex: number,
): EditorState => {
  const fromIndex = state.layers.findIndex((layer) => layer.id === layerId)

  if (fromIndex === -1 || fromIndex === toIndex) {
    return state
  }

  const clampedIndex = Math.min(Math.max(toIndex, 0), state.layers.length - 1)

  if (fromIndex === clampedIndex) {
    return state
  }

  const layers = [...state.layers]
  const [layer] = layers.splice(fromIndex, 1)
  layers.splice(clampedIndex, 0, layer)

  return withSelection(
    {
      ...state,
      layers,
    },
    getSelectedLayerIds(state),
    layerId,
  )
}

export const moveLayerForward = (state: EditorState, layerId: string) => {
  const currentIndex = state.layers.findIndex((layer) => layer.id === layerId)
  return reorderLayers(state, layerId, currentIndex + 1)
}

export const moveLayerBackward = (state: EditorState, layerId: string) => {
  const currentIndex = state.layers.findIndex((layer) => layer.id === layerId)
  return reorderLayers(state, layerId, currentIndex - 1)
}

export const bringLayerToFront = (state: EditorState, layerId: string) =>
  reorderLayers(state, layerId, state.layers.length - 1)

export const sendLayerToBack = (state: EditorState, layerId: string) =>
  reorderLayers(state, layerId, 0)

export const duplicateLayer = (
  state: EditorState,
  layerId: string,
): EditorState => {
  const original = state.layers.find((layer) => layer.id === layerId)

  if (!original) {
    return state
  }

  const clone = normalizeLayer({
    ...original,
    id: nextId(original.kind),
    x: original.x + 24,
    y: original.y + 24,
  })

  return {
    ...state,
    layers: [...state.layers, clone],
    selectedLayerId: clone.id,
    selectedLayerIds: [clone.id],
  }
}

export const duplicateLayers = (
  state: EditorState,
  layerIds: string[],
): EditorState => {
  const selectedSet = new Set(layerIds)
  const clones = state.layers
    .filter((layer) => selectedSet.has(layer.id))
    .map((layer) =>
      normalizeLayer({
        ...layer,
        id: nextId(layer.kind),
        x: layer.x + 24,
        y: layer.y + 24,
      }),
    )

  if (clones.length === 0) {
    return state
  }

  return {
    ...state,
    layers: [...state.layers, ...clones],
    selectedLayerId: clones.at(-1)?.id ?? state.selectedLayerId,
    selectedLayerIds: clones.map((layer) => layer.id),
  }
}

export const removeLayers = (
  state: EditorState,
  layerIds: string[],
): EditorState => {
  const removalSet = new Set(layerIds)
  const layers = state.layers.filter((layer) => !removalSet.has(layer.id))
  const remainingSelection = getSelectedLayerIds(state).filter(
    (layerId) => !removalSet.has(layerId),
  )

  return withSelection(
    {
      ...state,
      layers,
    },
    remainingSelection,
    remainingSelection.at(-1),
  )
}

export const removeLayer = (state: EditorState, layerId: string): EditorState =>
  removeLayers(state, [layerId])

export const setImageShape = (
  state: EditorState,
  layerId: string,
  shape: ImageShape,
): EditorState => ({
  ...state,
  layers: state.layers.map((layer) => {
    if (layer.id !== layerId || layer.kind !== 'image') {
      return layer
    }

    return normalizeImageLayer({
      ...layer,
      shape,
      radius: shape === 'circle' ? 999 : layer.radius,
    })
  }),
})

export const createCustomTemplate = (
  name: string,
  state: EditorState,
): UserTemplate => {
  const id = nextId('custom-template')
  const timestamp = new Date().toISOString()
  const snapshot = cloneState({
    ...state,
    templateId: id,
    templateName: name,
    templateSource: 'custom',
  })

  return {
    id,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    snapshot,
  }
}

export const applyCustomTemplate = (template: UserTemplate): EditorState =>
  cloneState(template.snapshot)

export const getTemplateName = (state: EditorState) => state.templateName

export const normalizeEditorState = (state: EditorState): EditorState => {
  const layers = state.layers.map((layer) => normalizeLayer(layer))
  const validSelectedIds = uniqueIds(state.selectedLayerIds ?? []).filter((layerId) =>
    layers.some((layer) => layer.id === layerId),
  )
  const selectedLayerId = layers.some((layer) => layer.id === state.selectedLayerId)
    ? state.selectedLayerId
    : validSelectedIds.at(-1) ?? layers[0]?.id ?? ''
  const selectedLayerIds =
    validSelectedIds.length > 0
      ? validSelectedIds.includes(selectedLayerId)
        ? validSelectedIds
        : [...validSelectedIds, selectedLayerId]
      : selectedLayerId
        ? [selectedLayerId]
        : []

  return {
    ...state,
    layers,
    selectedLayerId,
    selectedLayerIds,
  }
}
