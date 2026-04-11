import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  ImagePlus,
  Layers3,
  MousePointer2,
  Trash2,
  Type,
} from 'lucide-react'
const brandAvatar = '/IMG.png'
import './App.css'
import {
  addImageLayer,
  addTextBlock,
  alignLayerToCanvas,
  alignLayerToReference,
  applyCustomTemplate,
  BACKGROUND_PRESETS,
  bringLayerToFront,
  COLOR_SWATCHES,
  createCustomTemplate,
  createEditorState,
  duplicateLayer,
  FONT_LOOKUP,
  FONT_PRESETS,
  getLayerById,
  isImageLayer,
  isTextLayer,
  moveLayerBackward,
  moveLayerForward,
  removeLayer,
  resizeState,
  sendLayerToBack,
  selectLayer,
  setBuiltinTemplate,
  setImageShape,
  SIZE_PRESETS,
  SOLID_BACKGROUND_PRESETS,
  TEMPLATE_OPTIONS,
  updateLayer,
  type BuiltinTemplateId,
  type CanvasLayer,
  type EditorState,
  type FontId,
  type ImageLayer,
  type ImageShape,
  type LayerAlignment,
  type SizeId,
  type TextAlign,
  type TextLayer,
  type UserTemplate,
} from './lib/editor'
import {
  deleteCustomTemplate,
  loadWorkspace,
  saveCurrentState,
  saveCustomTemplate,
} from './lib/persistence'

type InteractionState =
  | {
      mode: 'move'
      layerId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'resize'
      layerId: string
      startPointerX: number
      startPointerY: number
      startWidth: number
      startHeight: number
      originX: number
      originY: number
      shape: ImageShape
    }
  | {
      mode: 'resize-text'
      layerId: string
      startPointerX: number
      startWidth: number
      originX: number
    }

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

const defaultState = createEditorState('quote-card', 'xhs-34')
const DEFAULT_TEXT_FRAME = 'rgba(255,255,255,0.88)'
const TEXT_FRAME_SWATCHES = [
  DEFAULT_TEXT_FRAME,
  'rgba(255,238,164,0.86)',
  'rgba(254,215,170,0.82)',
  'rgba(191,219,254,0.84)',
  'rgba(244,114,182,0.24)',
]
const MAX_HISTORY_STEPS = 80

const cloneEditorState = (value: EditorState): EditorState =>
  JSON.parse(JSON.stringify(value)) as EditorState

const getHistorySignature = (value: EditorState) =>
  JSON.stringify({
    ...value,
    selectedLayerId: '',
  })

const appendHistorySnapshot = (
  history: EditorState[],
  snapshot: EditorState,
) => [...history.slice(-(MAX_HISTORY_STEPS - 1)), cloneEditorState(snapshot)]

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const getImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image()
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width || 1080,
        height: image.naturalHeight || image.height || 1080,
      })
    image.onerror = () => resolve({ width: 1080, height: 1080 })
    image.src = src
  })

function App() {
  const [state, setState] = useState<EditorState>(defaultState)
  const [customTemplates, setCustomTemplates] = useState<UserTemplate[]>([])
  const [historyPast, setHistoryPast] = useState<EditorState[]>([])
  const [historyFuture, setHistoryFuture] = useState<EditorState[]>([])
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null)
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    'style' | 'layer' | 'background'
  >('style')
  const [alignmentReferenceId, setAlignmentReferenceId] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const [templateDraft, setTemplateDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    '当前画布和自定义模板都会保存在这个浏览器里，刷新后还在。',
  )
  const [previewScale, setPreviewScale] = useState(1)
  const [isHydrated, setIsHydrated] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const canvasTextEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const interactionRef = useRef<InteractionState | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const stateRef = useRef<EditorState>(cloneEditorState(defaultState))
  const previousStateRef = useRef<EditorState>(cloneEditorState(defaultState))
  const skipHistoryRef = useRef(false)
  const historyTransactionRef = useRef<{
    snapshot: EditorState
    signature: string
  } | null>(null)

  const selectedLayer =
    state.layers.find((layer) => layer.id === state.selectedLayerId) ??
    state.layers[0] ??
    null
  const selectedTextLayer =
    selectedLayer && isTextLayer(selectedLayer) ? selectedLayer : null
  const selectedImageLayer =
    selectedLayer && isImageLayer(selectedLayer) ? selectedLayer : null
  const selectedLayerIndex = selectedLayer
    ? state.layers.findIndex((layer) => layer.id === selectedLayer.id)
    : -1

  const beginHistoryTransaction = () => {
    if (historyTransactionRef.current) {
      return
    }

    const snapshot = cloneEditorState(stateRef.current)
    historyTransactionRef.current = {
      snapshot,
      signature: getHistorySignature(snapshot),
    }
  }

  const endHistoryTransaction = () => {
    const transaction = historyTransactionRef.current

    if (!transaction) {
      return
    }

    historyTransactionRef.current = null

    const currentSnapshot = cloneEditorState(stateRef.current)

    if (transaction.signature !== getHistorySignature(currentSnapshot)) {
      setHistoryPast((current) =>
        appendHistorySnapshot(current, transaction.snapshot),
      )
      setHistoryFuture([])
    }

    previousStateRef.current = currentSnapshot
  }

  const handleSetTextAlign = (textAlign: TextAlign) => {
    if (!selectedTextLayer) {
      return
    }

    handleLayerUpdate({ textAlign })
  }

  const handleAlignLayerToCanvas = (alignment: LayerAlignment) => {
    if (!selectedLayer) {
      return
    }

    endHistoryTransaction()
    setEditingTextLayerId(null)
    setState((current) => alignLayerToCanvas(current, selectedLayer.id, alignment))
  }

  const handleAlignLayerToReference = (alignment: LayerAlignment) => {
    if (!selectedLayer || !alignmentReferenceId) {
      return
    }

    endHistoryTransaction()
    setEditingTextLayerId(null)
    setState((current) =>
      alignLayerToReference(
        current,
        selectedLayer.id,
        alignmentReferenceId,
        alignment,
      ),
    )
  }

  const templateSelectValue = useMemo(() => {
    if (
      state.templateSource === 'custom' &&
      customTemplates.some((template) => template.id === state.templateId)
    ) {
      return `custom:${state.templateId}`
    }

    return `builtin:${
      state.templateSource === 'builtin' ? state.templateId : 'quote-card'
    }`
  }, [customTemplates, state.templateId, state.templateSource])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const workspace = await loadWorkspace()

      if (cancelled) {
        return
      }

      setCustomTemplates(workspace.templates)

      if (workspace.currentState) {
        skipHistoryRef.current = true
        previousStateRef.current = cloneEditorState(workspace.currentState)
        setState(workspace.currentState)
        if (workspace.currentState.templateSource === 'custom') {
          setTemplateDraft(workspace.currentState.templateName)
        }
      }

      setIsHydrated(true)
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) {
      previousStateRef.current = cloneEditorState(state)
      return
    }

    const previousState = previousStateRef.current

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      previousStateRef.current = cloneEditorState(state)
      return
    }

    if (historyTransactionRef.current) {
      previousStateRef.current = cloneEditorState(state)
      return
    }

    if (getHistorySignature(previousState) !== getHistorySignature(state)) {
      setHistoryPast((current) => appendHistorySnapshot(current, previousState))
      setHistoryFuture([])
    }

    previousStateRef.current = cloneEditorState(state)
  }, [isHydrated, state])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveCurrentState(state)
    }, 160)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [isHydrated, state])

  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = viewportRef.current?.clientWidth ?? state.size.width
      const nextScale = Math.min(
        1,
        Math.max(0.24, (viewportWidth - 32) / state.size.width),
      )
      setPreviewScale(nextScale)
    }

    updateScale()

    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(updateScale)

    if (viewportRef.current) {
      observer.observe(viewportRef.current)
    }

    return () => observer.disconnect()
  }, [state.size.width])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = interactionRef.current
      const canvas = canvasRef.current

      if (!active || !canvas) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const pointerX = (event.clientX - rect.left) / previewScale
      const pointerY = (event.clientY - rect.top) / previewScale

      setState((current) => {
        const layer = getLayerById(current, active.layerId)

        if (!layer) {
          return current
        }

        if (active.mode === 'move') {
          return updateLayer(current, layer.id, {
            x: Number(
              clamp(
                pointerX - active.offsetX,
                24,
                current.size.width - layer.width - 24,
              ).toFixed(1),
            ),
            y: Number(
              clamp(
                pointerY - active.offsetY,
                24,
                current.size.height - layer.height - 24,
              ).toFixed(1),
            ),
          })
        }

        if (active.mode === 'resize-text') {
          if (!isTextLayer(layer)) {
            return current
          }

          const deltaX = (event.clientX - active.startPointerX) / previewScale
          const maxWidth = current.size.width - active.originX - 24

          return updateLayer(current, layer.id, {
            width: Number(clamp(active.startWidth + deltaX, 120, maxWidth).toFixed(1)),
          })
        }

        if (!isImageLayer(layer)) {
          return current
        }

        const deltaX = (event.clientX - active.startPointerX) / previewScale
        const deltaY = (event.clientY - active.startPointerY) / previewScale
        const maxWidth = current.size.width - active.originX - 24
        const maxHeight = current.size.height - active.originY - 24

        if (active.shape === 'circle') {
          const side = clamp(
            Math.max(active.startWidth + deltaX, active.startHeight + deltaY),
            72,
            Math.min(maxWidth, maxHeight),
          )

          return updateLayer(current, layer.id, {
            width: side,
            height: side,
            radius: 999,
          })
        }

        const widthScale = (active.startWidth + deltaX) / Math.max(active.startWidth, 1)
        const heightScale =
          (active.startHeight + deltaY) / Math.max(active.startHeight, 1)
        const preferredScale =
          Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
            ? widthScale
            : heightScale
        const minScale = Math.max(72 / active.startWidth, 72 / active.startHeight)
        const maxScale = Math.min(
          maxWidth / active.startWidth,
          maxHeight / active.startHeight,
        )
        const nextScale = clamp(preferredScale, minScale, maxScale)

        return updateLayer(current, layer.id, {
          width: Number((active.startWidth * nextScale).toFixed(1)),
        })
      })
    }

    const handlePointerUp = () => {
      if (!interactionRef.current) {
        return
      }

      interactionRef.current = null

      const transaction = historyTransactionRef.current

      if (!transaction) {
        return
      }

      historyTransactionRef.current = null

      const currentSnapshot = cloneEditorState(stateRef.current)

      if (transaction.signature !== getHistorySignature(currentSnapshot)) {
        setHistoryPast((current) =>
          appendHistorySnapshot(current, transaction.snapshot),
        )
        setHistoryFuture([])
      }

      previousStateRef.current = currentSnapshot
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [previewScale])

  useEffect(() => {
    if (!editingTextLayerId) {
      return
    }

    canvasTextEditorRef.current?.focus()
  }, [editingTextLayerId])

  useEffect(() => {
    if (
      editingTextLayerId &&
      !state.layers.some((layer) => layer.id === editingTextLayerId)
    ) {
      setEditingTextLayerId(null)
    }
  }, [editingTextLayerId, state.layers])

  const handleSelectTemplate = (value: string) => {
    endHistoryTransaction()
    setEditingTextLayerId(null)

    if (value.startsWith('builtin:')) {
      const templateId = value.replace('builtin:', '') as BuiltinTemplateId
      setTemplateDraft('')
      setState((current) => setBuiltinTemplate(current, templateId))
      return
    }

    const templateId = value.replace('custom:', '')
    const template = customTemplates.find((item) => item.id === templateId)

    if (!template) {
      return
    }

    setState(applyCustomTemplate(template))
    setTemplateDraft(template.name)
    setStatusMessage(`已载入模板“${template.name}”。`)
  }

  const handleSelectSize = (value: string) => {
    endHistoryTransaction()
    setEditingTextLayerId(null)
    setState((current) => resizeState(current, value as SizeId))
  }

  const handleAddText = () => {
    endHistoryTransaction()
    setEditingTextLayerId(null)
    setActiveInspectorTab('style')
    setState((current) => addTextBlock(current))
    setStatusMessage('文字已添加，双击画布里的文字就能直接改。')
  }

  const handleAddImage = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    endHistoryTransaction()
    setEditingTextLayerId(null)
    setActiveInspectorTab('style')
    const src = await readFileAsDataUrl(file)
    const dimensions = await getImageDimensions(src)

    setState((current) =>
      addImageLayer(current, {
        src,
        name: file.name,
        naturalWidth: dimensions.width,
        naturalHeight: dimensions.height,
      }),
    )
    setStatusMessage(`已插入图片“${file.name}”，可以直接拖动和改大小。`)
    event.target.value = ''
  }

  const handleDuplicate = () => {
    if (!selectedLayer) {
      return
    }

    endHistoryTransaction()
    setEditingTextLayerId(null)
    setState((current) => duplicateLayer(current, selectedLayer.id))
  }

  const handleDelete = () => {
    if (!selectedLayer) {
      return
    }

    endHistoryTransaction()
    setEditingTextLayerId(null)
    setState((current) => removeLayer(current, selectedLayer.id))
    setStatusMessage('已删除当前选中的元素。')
  }

  const handleExport = async () => {
    if (!canvasRef.current) {
      return
    }

    setExporting(true)
    setStatusMessage('正在生成 PNG...')

    try {
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      })
      const link = document.createElement('a')
      link.download = `cover-${Date.now()}.png`
      link.href = dataUrl
      link.click()
      setStatusMessage('导出完成，图片已经开始下载。')
    } catch {
      setStatusMessage('导出失败，请再试一次。')
    } finally {
      setExporting(false)
    }
  }

  const handleSaveTemplate = async () => {
    endHistoryTransaction()
    setEditingTextLayerId(null)
    const name = templateDraft.trim() || `${state.templateName} 模板`
    const template = createCustomTemplate(name, state)
    const templates = await saveCustomTemplate(template)

    setCustomTemplates(templates)
    setState(applyCustomTemplate(template))
    setTemplateDraft(name)
    setStatusMessage(`模板“${name}”已保存，刷新页面也还在。`)
  }

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    endHistoryTransaction()
    setEditingTextLayerId(null)
    const templates = await deleteCustomTemplate(templateId)
    setCustomTemplates(templates)

    if (state.templateSource === 'custom' && state.templateId === templateId) {
      setState((current) => ({
        ...current,
        templateSource: 'builtin',
        templateId: 'quote-card',
        templateName: '当前画布',
      }))
    }

    setStatusMessage(`模板“${templateName}”已删除。`)
  }

  const handleLayerUpdate = (patch: Partial<CanvasLayer>) => {
    if (!selectedLayer) {
      return
    }

    endHistoryTransaction()
    setState((current) => updateLayer(current, selectedLayer.id, patch))
  }

  const handleSelectLayer = (layerId: string) => {
    endHistoryTransaction()
    setEditingTextLayerId(null)
    setActiveInspectorTab('style')
    setState((current) => selectLayer(current, layerId))
  }

  const handleStartEditingText = (layerId: string) => {
    beginHistoryTransaction()
    setState((current) => selectLayer(current, layerId))
    setEditingTextLayerId(layerId)
  }

  const startMoveLayer = (
    event: React.PointerEvent<HTMLElement>,
    layer: CanvasLayer,
  ) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.canvas__resize-handle')
    ) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setEditingTextLayerId(null)
    beginHistoryTransaction()

    if (!canvasRef.current) {
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    const pointerX = (event.clientX - rect.left) / previewScale
    const pointerY = (event.clientY - rect.top) / previewScale

    interactionRef.current = {
      mode: 'move',
      layerId: layer.id,
      offsetX: pointerX - layer.x,
      offsetY: pointerY - layer.y,
    }

    setState((current) => selectLayer(current, layer.id))
  }

  const startResizeImage = (
    event: React.PointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setEditingTextLayerId(null)
    beginHistoryTransaction()

    interactionRef.current = {
      mode: 'resize',
      layerId: layer.id,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startWidth: layer.width,
      startHeight: layer.height,
      originX: layer.x,
      originY: layer.y,
      shape: layer.shape,
    }

    setState((current) => selectLayer(current, layer.id))
  }

  const startResizeText = (
    event: React.PointerEvent<HTMLButtonElement>,
    layer: TextLayer,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setEditingTextLayerId(null)
    beginHistoryTransaction()

    interactionRef.current = {
      mode: 'resize-text',
      layerId: layer.id,
      startPointerX: event.clientX,
      startWidth: layer.width,
      originX: layer.x,
    }

    setState((current) => selectLayer(current, layer.id))
  }

  const canvasHeight = Math.round(state.size.height * previewScale)
  const canvasWidth = Math.round(state.size.width * previewScale)
  const selectedBackgroundPresetId =
    BACKGROUND_PRESETS.find(
      (preset) =>
        preset.background.fill === state.background.fill &&
        preset.background.texture === state.background.texture,
    )?.id ?? null
  const selectedSolidBackgroundPresetId =
    SOLID_BACKGROUND_PRESETS.find(
      (preset) =>
        preset.background.fill === state.background.fill &&
        preset.background.texture === state.background.texture,
    )?.id ?? null

  const textLayers = state.layers.filter(isTextLayer)
  const imageLayers = state.layers.filter(isImageLayer)
  const alignmentReferenceOptions = useMemo(
    () =>
      selectedLayer
        ? state.layers
            .filter((layer) => layer.id !== selectedLayer.id)
            .map((layer) => ({
              value: layer.id,
              label: isTextLayer(layer)
                ? `文字图层 ${textLayers.findIndex((item) => item.id === layer.id) + 1}`
                : `图片图层 ${imageLayers.findIndex((item) => item.id === layer.id) + 1}`,
            }))
        : [],
    [imageLayers, selectedLayer, state.layers, textLayers],
  )

  useEffect(() => {
    if (!selectedLayer) {
      if (alignmentReferenceId) {
        setAlignmentReferenceId('')
      }
      return
    }

    const nextReferenceId = alignmentReferenceOptions[0]?.value ?? ''

    if (
      alignmentReferenceId === selectedLayer.id ||
      !alignmentReferenceOptions.some(
        (option) => option.value === alignmentReferenceId,
      )
    ) {
      if (alignmentReferenceId !== nextReferenceId) {
        setAlignmentReferenceId(nextReferenceId)
      }
    }
  }, [alignmentReferenceId, alignmentReferenceOptions, selectedLayer])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const undo = () => {
        const transaction = historyTransactionRef.current

        if (transaction) {
          historyTransactionRef.current = null

          const currentSnapshot = cloneEditorState(stateRef.current)

          if (transaction.signature !== getHistorySignature(currentSnapshot)) {
            setHistoryPast((current) =>
              appendHistorySnapshot(current, transaction.snapshot),
            )
            setHistoryFuture([])
          }

          previousStateRef.current = currentSnapshot
        }

        const previousSnapshot = historyPast[historyPast.length - 1]

        if (!previousSnapshot) {
          return
        }

        const currentSnapshot = cloneEditorState(stateRef.current)
        setEditingTextLayerId(null)
        setHistoryPast((current) => current.slice(0, -1))
        setHistoryFuture((current) => [
          ...current.slice(-(MAX_HISTORY_STEPS - 1)),
          currentSnapshot,
        ])
        const nextState = cloneEditorState(previousSnapshot)
        skipHistoryRef.current = true
        previousStateRef.current = cloneEditorState(nextState)
        setState(nextState)
        setStatusMessage('已撤销上一步。')
      }

      const redo = () => {
        const transaction = historyTransactionRef.current

        if (transaction) {
          historyTransactionRef.current = null

          const currentSnapshot = cloneEditorState(stateRef.current)

          if (transaction.signature !== getHistorySignature(currentSnapshot)) {
            setHistoryPast((current) =>
              appendHistorySnapshot(current, transaction.snapshot),
            )
            setHistoryFuture([])
          }

          previousStateRef.current = currentSnapshot
        }

        const nextSnapshot = historyFuture[historyFuture.length - 1]

        if (!nextSnapshot) {
          return
        }

        const currentSnapshot = cloneEditorState(stateRef.current)
        setEditingTextLayerId(null)
        setHistoryFuture((current) => current.slice(0, -1))
        setHistoryPast((current) => [
          ...current.slice(-(MAX_HISTORY_STEPS - 1)),
          currentSnapshot,
        ])
        const nextState = cloneEditorState(nextSnapshot)
        skipHistoryRef.current = true
        previousStateRef.current = cloneEditorState(nextState)
        setState(nextState)
        setStatusMessage('已恢复刚才撤销的内容。')
      }

      const isUndoCommand =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'z'
      const isRedoCommand =
        ((event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          event.shiftKey &&
          event.key.toLowerCase() === 'z') ||
        (event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'y')

      if (isUndoCommand || isRedoCommand) {
        if (event.defaultPrevented || isEditableTarget(event.target)) {
          return
        }

        event.preventDefault()

        if (isRedoCommand) {
          redo()
          return
        }

        undo()
        return
      }

      if (
        !selectedLayer ||
        editingTextLayerId ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        setEditingTextLayerId(null)
        setState((current) => removeLayer(current, selectedLayer.id))
        setStatusMessage('已删除当前选中的元素。')
        return
      }

      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        const step = event.shiftKey ? 10 : 1
        const deltaX =
          event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const deltaY =
          event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0

        event.preventDefault()
        setState((current) => {
          const layer = getLayerById(current, selectedLayer.id)

          if (!layer) {
            return current
          }

          return updateLayer(current, layer.id, {
            x: Number(
              clamp(
                layer.x + deltaX,
                24,
                current.size.width - layer.width - 24,
              ).toFixed(1),
            ),
            y: Number(
              clamp(
                layer.y + deltaY,
                24,
                current.size.height - layer.height - 24,
              ).toFixed(1),
            ),
          })
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingTextLayerId, historyFuture, historyPast, selectedLayer])

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">
            <img
              src={brandAvatar}
              alt="AI学习的章北海头像"
              className="brand__avatar"
            />
          </div>
          <h1>AI学习的章北海</h1>
        </div>

        <div className="topbar__controls">
          <div className="topbar__select field--compact">
            <select
              aria-label="尺寸"
              value={state.size.id}
              onChange={(event) => handleSelectSize(event.target.value)}
            >
              {SIZE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} · {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="topbar__select field--compact">
            <select
              aria-label="模板"
              value={templateSelectValue}
              onChange={(event) => handleSelectTemplate(event.target.value)}
            >
              <optgroup label="内置模板">
                {TEMPLATE_OPTIONS.map((template) => (
                  <option key={template.id} value={`builtin:${template.id}`}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
              {customTemplates.length > 0 && (
                <optgroup label="我的模板">
                  {customTemplates.map((template) => (
                    <option key={template.id} value={`custom:${template.id}`}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="topbar__template-save">
            <input
              aria-label="模板名称"
              value={templateDraft}
              placeholder="模板名"
              onChange={(event) => setTemplateDraft(event.target.value)}
            />
            <button className="ghost-button" type="button" onClick={handleSaveTemplate}>
              保存模板
            </button>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={16} />
            {exporting ? '导出中...' : '下载 PNG'}
          </button>
        </div>
      </header>

      <div className="studio-grid">
        <aside className="tool-rail" aria-label="工具栏">
          <button
            className="tool-rail__button is-active"
            type="button"
            aria-label="选择工具"
          >
            <MousePointer2 size={18} />
          </button>
          <button
            className="tool-rail__button"
            type="button"
            onClick={handleAddText}
            aria-label="添加文字"
          >
            <Type size={18} />
          </button>
          <label className="tool-rail__button tool-rail__label">
            <ImagePlus size={18} />
            <input
              type="file"
              accept="image/*"
              aria-label="上传图片"
              onChange={handleAddImage}
            />
          </label>
          <button
            className="tool-rail__button"
            type="button"
            onClick={handleDuplicate}
            aria-label="复制图层"
          >
            <Layers3 size={18} />
          </button>
          <button
            className="tool-rail__button"
            type="button"
            onClick={handleDelete}
            aria-label="删除元素"
          >
            <Trash2 size={18} />
          </button>
        </aside>

        <main className="workspace">
          <div className="workspace__viewport" ref={viewportRef}>
            <div
              className="workspace__canvas-stage"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
              }}
            >
              <div
                className="workspace__canvas-scale"
                style={{
                  width: `${state.size.width}px`,
                  height: `${state.size.height}px`,
                  transform: `scale(${previewScale})`,
                }}
              >
                <div
                  ref={canvasRef}
                  className="canvas"
                  style={{
                    width: `${state.size.width}px`,
                    height: `${state.size.height}px`,
                    backgroundColor: state.background.fill,
                  }}
                >
                  <div
                    className="canvas__texture"
                    style={{ backgroundImage: state.background.texture }}
                  />
                  <div className="canvas__accent" />

                  {state.layers.map((layer) => {
                    const isSelected = layer.id === selectedLayer?.id

                    if (isTextLayer(layer)) {
                      const textIndex =
                        textLayers.findIndex((item) => item.id === layer.id) + 1
                      const isEditing = editingTextLayerId === layer.id
                      const textLayerStyle = {
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        width: `${layer.width}px`,
                        minHeight: `${layer.height}px`,
                        color: layer.color,
                        background: layer.background,
                        fontSize: `${layer.fontSize}px`,
                        lineHeight: String(layer.lineHeight),
                        letterSpacing: `${layer.letterSpacing}px`,
                        fontFamily: FONT_LOOKUP[layer.fontId],
                        textAlign: layer.textAlign,
                        fontWeight: layer.weight,
                        fontStyle: layer.italic ? 'italic' : 'normal',
                        textDecoration: [
                          layer.underline ? 'underline' : '',
                          layer.strikethrough ? 'line-through' : '',
                        ]
                          .filter(Boolean)
                          .join(' '),
                        WebkitTextStroke:
                          layer.strokeWidth > 0
                            ? `${layer.strokeWidth}px ${layer.strokeColor}`
                            : undefined,
                        paintOrder: 'stroke fill',
                        textShadow:
                          layer.shadowBlur > 0
                            ? `0 ${Math.max(1, layer.shadowBlur / 4).toFixed(1)}px ${layer.shadowBlur}px ${layer.shadowColor}`
                            : 'none',
                        boxShadow:
                          layer.background === 'transparent' ? 'none' : undefined,
                        padding:
                          layer.background === 'transparent' ? '0px' : undefined,
                        borderRadius:
                          layer.background === 'transparent' ? '0px' : undefined,
                      }

                      if (isEditing) {
                        return (
                          <textarea
                            key={layer.id}
                            ref={isSelected ? canvasTextEditorRef : null}
                            aria-label="画布文字编辑器"
                            className={[
                              'canvas__layer',
                              'canvas__text-layer',
                              'canvas__text-editor',
                              layer.background === 'transparent'
                                ? 'canvas__text-layer--plain'
                                : '',
                              isSelected ? 'is-selected' : '',
                            ]
                              .join(' ')
                              .trim()}
                            style={textLayerStyle}
                            value={layer.content}
                            rows={Math.max(layer.content.split('\n').length, 2)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setState((current) =>
                                updateLayer(current, layer.id, {
                                  content: event.target.value,
                                }),
                              )
                            }
                            onBlur={() => {
                              if (editingTextLayerId === layer.id) {
                                endHistoryTransaction()
                                setEditingTextLayerId(null)
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                endHistoryTransaction()
                                setEditingTextLayerId(null)
                                event.currentTarget.blur()
                              }
                            }}
                          />
                        )
                      }

                      return (
                        <div
                          key={layer.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`文字图层 ${textIndex}`}
                          className={[
                            'canvas__layer',
                            'canvas__text-layer',
                            layer.background === 'transparent'
                              ? 'canvas__text-layer--plain'
                              : '',
                            isSelected ? 'is-selected' : '',
                          ]
                            .join(' ')
                            .trim()}
                          style={textLayerStyle}
                          onPointerDown={(event) => startMoveLayer(event, layer)}
                          onClick={() => handleSelectLayer(layer.id)}
                          onDoubleClick={() => handleStartEditingText(layer.id)}
                        >
                          {layer.content}
                          {isSelected && (
                            <button
                              type="button"
                              aria-label="调整文字宽度"
                              className="canvas__resize-handle canvas__resize-handle--text"
                              onPointerDown={(event) => startResizeText(event, layer)}
                            />
                          )}
                        </div>
                      )
                    }

                    const imageIndex =
                      imageLayers.findIndex((item) => item.id === layer.id) + 1

                    return (
                      <div
                        key={layer.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`图片图层 ${imageIndex}`}
                        className={[
                          'canvas__layer',
                          'canvas__image-layer',
                          isSelected ? 'is-selected' : '',
                        ]
                          .join(' ')
                          .trim()}
                        style={{
                          left: `${layer.x}px`,
                          top: `${layer.y}px`,
                          width: `${layer.width}px`,
                          height: `${layer.height}px`,
                        }}
                        onPointerDown={(event) => startMoveLayer(event, layer)}
                        onClick={() => handleSelectLayer(layer.id)}
                      >
                        <img
                          src={layer.src}
                          alt={layer.name}
                          draggable={false}
                          className="canvas__image-frame"
                          style={{
                            borderRadius:
                              layer.shape === 'circle' ? '999px' : `${layer.radius}px`,
                          }}
                        />
                        {isSelected && (
                          <button
                            type="button"
                            aria-label="调整图片大小"
                            className="canvas__resize-handle"
                            onPointerDown={(event) => startResizeImage(event, layer)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="inspector">
          <div className="panel-stack">
            <section className="panel template-panel template-panel--compact">
              <div className="panel__heading">
                <h2>我的模板</h2>
              </div>

              {customTemplates.length > 0 && (
                <div className="template-list">
                  {customTemplates.map((template) => (
                    <div className="template-chip" key={template.id}>
                      <button
                        type="button"
                        className={[
                          'template-chip__main',
                          state.templateSource === 'custom' &&
                          state.templateId === template.id
                            ? 'is-active'
                            : '',
                        ]
                          .join(' ')
                          .trim()}
                        onClick={() => handleSelectTemplate(`custom:${template.id}`)}
                      >
                        {template.name}
                      </button>
                      <button
                        type="button"
                        className="template-chip__remove"
                        aria-label={`删除模板 ${template.name}`}
                        onClick={() =>
                          handleDeleteTemplate(template.id, template.name)
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {customTemplates.length === 0 && (
                <p>保存后的模板会出现在这里。</p>
              )}

              <p className="template-panel__status">{statusMessage}</p>
            </section>

            <div className="tabs" role="tablist" aria-label="右侧设置">
              {[
                ['style', '样式'],
                ['layer', '图层'],
                ['background', '背景'],
              ].map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  className={activeInspectorTab === tabId ? 'is-active' : ''}
                  onClick={() =>
                    setActiveInspectorTab(
                      tabId as 'style' | 'layer' | 'background',
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {activeInspectorTab === 'style' && (
              <>
                {selectedTextLayer && (
                  <section className="panel">
                    <div className="panel__heading">
                      <h2>文字样式</h2>
                    </div>

                    <div className="field-grid">
                      <label className="field">
                        <span>字号</span>
                        <input
                          type="number"
                          min={18}
                          max={180}
                          aria-label="字号"
                          value={Math.round(selectedTextLayer.fontSize)}
                          onChange={(event) =>
                            handleLayerUpdate({
                              fontSize: Number(event.target.value),
                            })
                          }
                        />
                      </label>

                      <label className="field">
                        <span>字体</span>
                        <select
                          aria-label="字体"
                          value={selectedTextLayer.fontId}
                          onChange={(event) =>
                            handleLayerUpdate({
                              fontId: event.target.value as FontId,
                            })
                          }
                        >
                          {FONT_PRESETS.map((font) => (
                            <option key={font.id} value={font.id}>
                              {font.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="panel-subsection">
                      <span className="subtle-label">字重</span>
                      <div className="icon-group">
                        {([
                          ['常规', 500],
                          ['中黑', 700],
                          ['加粗', 800],
                        ] as const).map(([label, weight]) => (
                          <button
                            key={label}
                            type="button"
                            className={selectedTextLayer.weight === weight ? 'is-active' : ''}
                            onClick={() => handleLayerUpdate({ weight })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="panel-subsection">
                      <span className="subtle-label">文字样式</span>
                      <div className="icon-group">
                        <button
                          type="button"
                          className={selectedTextLayer.italic ? 'is-active' : ''}
                          onClick={() =>
                            handleLayerUpdate({
                              italic: !selectedTextLayer.italic,
                            })
                          }
                        >
                          斜体
                        </button>
                        <button
                          type="button"
                          className={selectedTextLayer.underline ? 'is-active' : ''}
                          onClick={() =>
                            handleLayerUpdate({
                              underline: !selectedTextLayer.underline,
                            })
                          }
                        >
                          下划线
                        </button>
                        <button
                          type="button"
                          className={selectedTextLayer.strikethrough ? 'is-active' : ''}
                          onClick={() =>
                            handleLayerUpdate({
                              strikethrough: !selectedTextLayer.strikethrough,
                            })
                          }
                        >
                          删除线
                        </button>
                      </div>
                    </div>

                    <div className="panel-subsection">
                      <div className="field-grid">
                        <label className="field">
                          <span>字距</span>
                          <input
                            type="number"
                            min={-4}
                            max={12}
                            step={0.5}
                            aria-label="字距"
                            value={selectedTextLayer.letterSpacing}
                            onChange={(event) =>
                              handleLayerUpdate({
                                letterSpacing: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>行距</span>
                          <input
                            type="number"
                            min={0.9}
                            max={2.2}
                            step={0.05}
                            aria-label="行距"
                            value={selectedTextLayer.lineHeight}
                            onChange={(event) =>
                              handleLayerUpdate({
                                lineHeight: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="panel-subsection">
                      <span className="subtle-label">文字对齐</span>
                      <div className="icon-group">
                        <button
                          type="button"
                          aria-label="左对齐"
                          className={
                            selectedTextLayer.textAlign === 'left'
                              ? 'is-active'
                              : ''
                          }
                          onClick={() => handleSetTextAlign('left')}
                        >
                          <AlignLeft size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="居中对齐"
                          className={
                            selectedTextLayer.textAlign === 'center'
                              ? 'is-active'
                              : ''
                          }
                          onClick={() => handleSetTextAlign('center')}
                        >
                          <AlignCenter size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="右对齐"
                          className={
                            selectedTextLayer.textAlign === 'right'
                              ? 'is-active'
                              : ''
                          }
                          onClick={() => handleSetTextAlign('right')}
                        >
                          <AlignRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="panel-subsection">
                      <div className="field-grid">
                        <label className="field">
                          <span>描边</span>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.5}
                            aria-label="描边"
                            value={selectedTextLayer.strokeWidth}
                            onChange={(event) =>
                              handleLayerUpdate({
                                strokeWidth: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>阴影</span>
                          <input
                            type="range"
                            min={0}
                            max={40}
                            step={1}
                            aria-label="阴影"
                            value={selectedTextLayer.shadowBlur}
                            onChange={(event) =>
                              handleLayerUpdate({
                                shadowBlur: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="panel-subsection">
                      <div className="icon-group icon-group--double">
                        <button
                          type="button"
                          className={
                            selectedTextLayer.background !== 'transparent'
                              ? 'is-active'
                              : ''
                          }
                          onClick={() =>
                            handleLayerUpdate({
                              background:
                                selectedTextLayer.background === 'transparent'
                                  ? DEFAULT_TEXT_FRAME
                                  : selectedTextLayer.background,
                            })
                          }
                        >
                          带底框
                        </button>
                        <button
                          type="button"
                          className={
                            selectedTextLayer.background === 'transparent'
                              ? 'is-active'
                              : ''
                          }
                          onClick={() =>
                            handleLayerUpdate({
                              background: 'transparent',
                              strokeWidth: 0,
                            })
                          }
                        >
                          无底框
                        </button>
                      </div>
                    </div>

                    <div className="panel-subsection">
                      <span className="subtle-label">字色</span>
                      <div className="swatches">
                        {COLOR_SWATCHES.slice(0, 6).map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            title={swatch}
                            className={[
                              'swatch',
                              selectedTextLayer.color === swatch
                                ? 'is-active'
                                : '',
                            ]
                              .join(' ')
                              .trim()}
                            style={{ background: swatch }}
                            onClick={() => handleLayerUpdate({ color: swatch })}
                          />
                        ))}
                      </div>
                    </div>

                    {selectedTextLayer.strokeWidth > 0 && (
                      <div className="panel-subsection">
                        <span className="subtle-label">描边色</span>
                        <div className="swatches">
                          {COLOR_SWATCHES.slice(0, 6).map((swatch) => (
                            <button
                              key={`stroke-${swatch}`}
                              type="button"
                              title={swatch}
                              className={[
                                'swatch',
                                selectedTextLayer.strokeColor === swatch
                                  ? 'is-active'
                                  : '',
                              ]
                                .join(' ')
                                .trim()}
                              style={{ background: swatch }}
                              onClick={() =>
                                handleLayerUpdate({ strokeColor: swatch })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTextLayer.shadowBlur > 0 && (
                      <div className="panel-subsection">
                        <span className="subtle-label">阴影色</span>
                        <div className="swatches">
                          {[
                            'rgba(15,23,42,0.35)',
                            'rgba(17,24,39,0.56)',
                            'rgba(37,99,235,0.32)',
                            'rgba(244,114,182,0.34)',
                            'rgba(249,115,22,0.34)',
                          ].map((swatch) => (
                            <button
                              key={`shadow-${swatch}`}
                              type="button"
                              title={swatch}
                              className={[
                                'swatch',
                                selectedTextLayer.shadowColor === swatch
                                  ? 'is-active'
                                  : '',
                              ]
                                .join(' ')
                                .trim()}
                              style={{ background: swatch }}
                              onClick={() =>
                                handleLayerUpdate({ shadowColor: swatch })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTextLayer.background !== 'transparent' && (
                      <div className="panel-subsection">
                        <span className="subtle-label">底框</span>
                        <div className="swatches">
                          {TEXT_FRAME_SWATCHES.map((swatch) => (
                            <button
                              key={swatch}
                              type="button"
                              title={swatch}
                              className={[
                                'swatch',
                                selectedTextLayer.background === swatch
                                  ? 'is-active'
                                  : '',
                              ]
                                .join(' ')
                                .trim()}
                              style={{ background: swatch }}
                              onClick={() =>
                                handleLayerUpdate({ background: swatch })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {selectedImageLayer && (
                  <section className="panel">
                    <div className="panel__heading">
                      <h2>图片形状</h2>
                    </div>

                    <div className="icon-group icon-group--double">
                      <button
                        type="button"
                        className={
                          selectedImageLayer.shape === 'rounded'
                            ? 'is-active'
                            : ''
                        }
                        onClick={() =>
                          setState((current) =>
                            setImageShape(
                              current,
                              selectedImageLayer.id,
                              'rounded',
                            ),
                          )
                        }
                      >
                        圆角矩形
                      </button>
                      <button
                        type="button"
                        className={
                          selectedImageLayer.shape === 'circle'
                            ? 'is-active'
                            : ''
                        }
                        onClick={() =>
                          setState((current) =>
                            setImageShape(
                              current,
                              selectedImageLayer.id,
                              'circle',
                            ),
                          )
                        }
                      >
                        正圆图片
                      </button>
                    </div>

                    {selectedImageLayer.shape === 'rounded' && (
                      <div className="panel-subsection">
                        <span className="subtle-label">圆角</span>
                        <input
                          type="range"
                          aria-label="图片圆角"
                          min={0}
                          max={160}
                          step={1}
                          value={selectedImageLayer.radius}
                          onChange={(event) =>
                            handleLayerUpdate({
                              radius: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    )}
                  </section>
                )}

                {!selectedLayer && (
                  <section className="panel panel--muted">
                    <p>先选中画布里的文字或图片，再改样式。</p>
                  </section>
                )}
              </>
            )}

            {activeInspectorTab === 'layer' && (
              <>
                {selectedLayer && (
                  <section className="panel">
                    <div className="panel__heading">
                      <h2>图层顺序</h2>
                    </div>

                    <div className="icon-group icon-group--double">
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) =>
                            moveLayerForward(current, selectedLayer.id),
                          )
                        }
                        disabled={selectedLayerIndex === state.layers.length - 1}
                      >
                        上移一层
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) =>
                            moveLayerBackward(current, selectedLayer.id),
                          )
                        }
                        disabled={selectedLayerIndex <= 0}
                      >
                        下移一层
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) =>
                            bringLayerToFront(current, selectedLayer.id),
                          )
                        }
                        disabled={selectedLayerIndex === state.layers.length - 1}
                      >
                        置顶
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) =>
                            sendLayerToBack(current, selectedLayer.id),
                          )
                        }
                        disabled={selectedLayerIndex <= 0}
                      >
                        置底
                      </button>
                    </div>

                    <div className="panel-subsection">
                      <span className="subtle-label">对齐画布</span>
                      <div className="icon-group">
                        <button type="button" onClick={() => handleAlignLayerToCanvas('left')}>
                          靠左
                        </button>
                        <button type="button" onClick={() => handleAlignLayerToCanvas('center')}>
                          水平居中
                        </button>
                        <button type="button" onClick={() => handleAlignLayerToCanvas('right')}>
                          靠右
                        </button>
                        <button type="button" onClick={() => handleAlignLayerToCanvas('top')}>
                          靠上
                        </button>
                        <button type="button" onClick={() => handleAlignLayerToCanvas('middle')}>
                          垂直居中
                        </button>
                        <button type="button" onClick={() => handleAlignLayerToCanvas('bottom')}>
                          靠下
                        </button>
                      </div>
                    </div>

                    {alignmentReferenceOptions.length > 0 && (
                      <div className="panel-subsection">
                        <span className="subtle-label">对齐其它元素</span>
                        <label className="field">
                          <span>参考图层</span>
                          <select
                            aria-label="对齐参考"
                            value={alignmentReferenceId}
                            onChange={(event) =>
                              setAlignmentReferenceId(event.target.value)
                            }
                          >
                            {alignmentReferenceOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="icon-group">
                          <button
                            type="button"
                            aria-label="参考左边对齐"
                            onClick={() => handleAlignLayerToReference('left')}
                          >
                            左边对齐
                          </button>
                          <button
                            type="button"
                            aria-label="参考水平居中"
                            onClick={() => handleAlignLayerToReference('center')}
                          >
                            水平居中
                          </button>
                          <button
                            type="button"
                            aria-label="参考右边对齐"
                            onClick={() => handleAlignLayerToReference('right')}
                          >
                            右边对齐
                          </button>
                          <button
                            type="button"
                            aria-label="参考上边对齐"
                            onClick={() => handleAlignLayerToReference('top')}
                          >
                            上边对齐
                          </button>
                          <button
                            type="button"
                            aria-label="参考垂直居中"
                            onClick={() => handleAlignLayerToReference('middle')}
                          >
                            垂直居中
                          </button>
                          <button
                            type="button"
                            aria-label="参考下边对齐"
                            onClick={() => handleAlignLayerToReference('bottom')}
                          >
                            下边对齐
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {!selectedLayer && (
                  <section className="panel panel--muted">
                    <p>先选中一个元素，再调整图层顺序。</p>
                  </section>
                )}
              </>
            )}

            {activeInspectorTab === 'background' && (
              <section className="panel">
                <div className="panel__heading">
                  <h2>背景</h2>
                </div>

                <div className="panel-subsection">
                  <span className="subtle-label">纯色</span>
                  <div className="solid-background-grid">
                    {SOLID_BACKGROUND_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-label={`纯色背景 ${preset.background.fill}`}
                        className={[
                          'solid-background-swatch',
                          selectedSolidBackgroundPresetId === preset.id
                            ? 'is-active'
                            : '',
                        ]
                          .join(' ')
                          .trim()}
                        style={{ backgroundColor: preset.background.fill }}
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            background: { ...preset.background },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="panel-subsection">
                  <span className="subtle-label">渐变</span>
                  <div className="background-grid">
                    {BACKGROUND_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-label={preset.name}
                        className={[
                          'background-card',
                          selectedBackgroundPresetId === preset.id
                            ? 'is-active'
                            : '',
                        ]
                          .join(' ')
                          .trim()}
                        style={{
                          backgroundColor: preset.background.fill,
                          backgroundImage: preset.background.texture,
                        }}
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            background: { ...preset.background },
                          }))
                        }
                      >
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
