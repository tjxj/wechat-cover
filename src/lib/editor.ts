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
export type FontId = 'sans' | 'serif' | 'display'
export type TextAlign = 'left' | 'center' | 'right'
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
  'id' | 'kind' | 'height' | 'strokeWidth' | 'strokeColor' | 'shadowBlur' | 'shadowColor'
> &
  Partial<
    Pick<TextLayer, 'strokeWidth' | 'strokeColor' | 'shadowBlur' | 'shadowColor'>
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

const estimateTextHeight = (
  content: string,
  fontSize: number,
  lineHeight: number,
) => {
  const lines = Math.max(content.split('\n').length, 1)
  return Number((fontSize * lineHeight * lines + 32).toFixed(1))
}

const toTextLayer = (layer: TextSeed, id = nextId('layer')): TextLayer => ({
  ...layer,
  strokeWidth: layer.strokeWidth ?? 0,
  strokeColor: layer.strokeColor ?? DEFAULT_STROKE_COLOR,
  shadowBlur: layer.shadowBlur ?? 0,
  shadowColor: layer.shadowColor ?? DEFAULT_SHADOW_COLOR,
  id,
  kind: 'text',
  height: estimateTextHeight(layer.content, layer.fontSize, layer.lineHeight),
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

const normalizeTextLayer = (layer: TextLayer): TextLayer => ({
  ...layer,
  width: Number(Math.max(120, layer.width).toFixed(1)),
  lineHeight: Number(Math.min(Math.max(layer.lineHeight ?? 1.2, 0.9), 2.2).toFixed(2)),
  letterSpacing: Number(
    Math.min(Math.max(layer.letterSpacing ?? 0, -4), 12).toFixed(1),
  ),
  strokeWidth: Number(Math.min(Math.max(layer.strokeWidth ?? 0, 0), 12).toFixed(1)),
  strokeColor: layer.strokeColor ?? DEFAULT_STROKE_COLOR,
  shadowBlur: Number(Math.min(Math.max(layer.shadowBlur ?? 0, 0), 48).toFixed(1)),
  shadowColor: layer.shadowColor ?? DEFAULT_SHADOW_COLOR,
  height: estimateTextHeight(
    layer.content,
    layer.fontSize,
    Number(Math.min(Math.max(layer.lineHeight ?? 1.2, 0.9), 2.2).toFixed(2)),
  ),
})

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
    id: 'display',
    name: '标题黑体',
    family:
      '"PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  },
  {
    id: 'serif',
    name: '思源宋体',
    family:
      '"Source Han Serif SC Local", "Source Han Serif SC", "Songti SC", "STSong", "Noto Serif SC", serif',
  },
  {
    id: 'sans',
    name: '清爽正文',
    family:
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
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
        content: '乔木封面实验室',
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
        content: 'LOCAL DEMO',
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

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
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

export const selectLayer = (state: EditorState, layerId: string): EditorState => ({
  ...state,
  selectedLayerId: layerId,
})

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

  return {
    ...state,
    layers,
    selectedLayerId: layerId,
  }
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
  }
}

export const removeLayer = (state: EditorState, layerId: string): EditorState => {
  const layers = state.layers.filter((layer) => layer.id !== layerId)

  return {
    ...state,
    layers,
    selectedLayerId: layers[0]?.id ?? '',
  }
}

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

  return {
    ...state,
    layers,
    selectedLayerId: layers.some((layer) => layer.id === state.selectedLayerId)
      ? state.selectedLayerId
      : layers[0]?.id ?? '',
  }
}
