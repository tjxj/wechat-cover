import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  Copy,
  Download,
  ImagePlus,
  Layers3,
  MousePointer2,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import './App.css'
import {
  addImageLayer,
  addTextBlock,
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
  getTemplateName,
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
  TEMPLATE_OPTIONS,
  updateLayer,
  type BuiltinTemplateId,
  type CanvasLayer,
  type EditorState,
  type FontId,
  type ImageLayer,
  type ImageShape,
  type SizeId,
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const defaultState = createEditorState('quote-card', 'xhs-34')
const DEFAULT_TEXT_FRAME = 'rgba(255,255,255,0.88)'
const TEXT_FRAME_SWATCHES = [
  DEFAULT_TEXT_FRAME,
  'rgba(255,238,164,0.86)',
  'rgba(254,215,170,0.82)',
  'rgba(191,219,254,0.84)',
  'rgba(244,114,182,0.24)',
]

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
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null)
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
    let cancelled = false

    const hydrate = async () => {
      const workspace = await loadWorkspace()

      if (cancelled) {
        return
      }

      setCustomTemplates(workspace.templates)

      if (workspace.currentState) {
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
      interactionRef.current = null
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
    setEditingTextLayerId(null)

    if (value.startsWith('builtin:')) {
      const templateId = value.replace('builtin:', '') as BuiltinTemplateId
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
    setEditingTextLayerId(null)
    setState((current) => resizeState(current, value as SizeId))
  }

  const handleAddText = () => {
    setEditingTextLayerId(null)
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

    setEditingTextLayerId(null)
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

    setEditingTextLayerId(null)
    setState((current) => duplicateLayer(current, selectedLayer.id))
  }

  const handleDelete = () => {
    if (!selectedLayer) {
      return
    }

    setEditingTextLayerId(null)
    setState((current) => removeLayer(current, selectedLayer.id))
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

    setState((current) => updateLayer(current, selectedLayer.id, patch))
  }

  const handleSelectLayer = (layerId: string) => {
    setEditingTextLayerId(null)
    setState((current) => selectLayer(current, layerId))
  }

  const handleStartEditingText = (layerId: string) => {
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

  const canvasHeight = Math.round(state.size.height * previewScale)
  const canvasWidth = Math.round(state.size.width * previewScale)
  const zoomLabel = `${Math.round(previewScale * 100)}%`
  const selectedBackgroundPresetId =
    BACKGROUND_PRESETS.find(
      (preset) =>
        preset.background.fill === state.background.fill &&
        preset.background.texture === state.background.texture,
    )?.id ?? null

  const textLayers = state.layers.filter(isTextLayer)
  const imageLayers = state.layers.filter(isImageLayer)

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">Q</div>
          <div>
            <p className="eyebrow">本地复刻版</p>
            <h1>封面工作台</h1>
          </div>
        </div>

        <div className="topbar__controls">
          <label className="field field--compact">
            <span>尺寸</span>
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
          </label>

          <label className="field field--compact">
            <span>模板</span>
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
          </label>

          <button className="ghost-button" type="button" onClick={handleAddText}>
            <Plus size={16} />
            添加文字
          </button>

          <label className="ghost-button upload-trigger">
            <ImagePlus size={16} />
            添加图片
            <input
              aria-label="上传图片"
              type="file"
              accept="image/*"
              onChange={handleAddImage}
            />
          </label>

          <button
            className="ghost-button"
            type="button"
            onClick={handleDuplicate}
            disabled={!selectedLayer}
          >
            <Copy size={16} />
            复制图层
          </button>

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
          <button className="tool-rail__button is-active" type="button">
            <MousePointer2 size={18} />
          </button>
          <button
            className="tool-rail__button"
            type="button"
            onClick={handleAddText}
          >
            <Type size={18} />
          </button>
          <label className="tool-rail__button tool-rail__label">
            <ImagePlus size={18} />
            <input type="file" accept="image/*" onChange={handleAddImage} />
          </label>
          <button
            className="tool-rail__button"
            type="button"
            onClick={handleDuplicate}
          >
            <Layers3 size={18} />
          </button>
          <button
            className="tool-rail__button"
            type="button"
            onClick={handleDelete}
          >
            <Trash2 size={18} />
          </button>
        </aside>

        <main className="workspace">
          <div className="workspace__status">
            <strong data-testid="current-template-name">{getTemplateName(state)}</strong>
            <span>预览 {zoomLabel}</span>
          </div>

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
                        WebkitTextStroke:
                          layer.strokeWidth > 0
                            ? `${layer.strokeWidth}px ${layer.strokeColor}`
                            : undefined,
                        paintOrder: 'stroke fill',
                        textShadow:
                          layer.shadowBlur > 0
                            ? `0 ${Math.max(1, layer.shadowBlur / 4).toFixed(1)}px ${layer.shadowBlur}px ${layer.shadowColor}`
                            : 'none',
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
                                setEditingTextLayerId(null)
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
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
              <div className="template-panel__actions template-panel__actions--row">
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

              <p className="template-panel__status">{statusMessage}</p>
            </section>

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
                        handleLayerUpdate({ background: 'transparent' })
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
                          selectedTextLayer.color === swatch ? 'is-active' : '',
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
                          onClick={() => handleLayerUpdate({ background: swatch })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

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
                      selectedImageLayer.shape === 'rounded' ? 'is-active' : ''
                    }
                    onClick={() =>
                      setState((current) =>
                        setImageShape(current, selectedImageLayer.id, 'rounded'),
                      )
                    }
                  >
                    圆角矩形
                  </button>
                  <button
                    type="button"
                    className={
                      selectedImageLayer.shape === 'circle' ? 'is-active' : ''
                    }
                    onClick={() =>
                      setState((current) =>
                        setImageShape(current, selectedImageLayer.id, 'circle'),
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

            <section className="panel">
              <div className="panel__heading">
                <h2>背景</h2>
              </div>

              <div className="background-grid">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={preset.name}
                    className={[
                      'background-card',
                      selectedBackgroundPresetId === preset.id ? 'is-active' : '',
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
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
