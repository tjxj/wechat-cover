import {
  addImageLayer,
  applyCustomTemplate,
  bringLayerToFront,
  createCustomTemplate,
  createEditorState,
  duplicateLayer,
  moveLayerBackward,
  moveLayerForward,
  resizeState,
  sendLayerToBack,
  setImageShape,
  updateLayer,
} from './editor'

describe('editor helpers', () => {
  it('builds the quote template with the requested preset size', () => {
    const state = createEditorState('quote-card', 'xhs-34')

    expect(state.size.id).toBe('xhs-34')
    expect(state.templateId).toBe('quote-card')
    expect(state.layers).toHaveLength(3)
    expect(state.templateName).toBe('引用卡片')
    expect(state.layers[0].kind).toBe('text')
    expect(state.background.fill).toBe('#f7f0dc')
  })

  it('rescales text layers when the canvas size changes', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const original = base.layers[0]

    const resized = resizeState(base, 'compact-34')
    const next = resized.layers[0]

    expect(resized.size.id).toBe('compact-34')
    expect(next.x).toBeCloseTo(original.x * 0.75, 1)
    expect(next.y).toBeCloseTo(original.y * 0.75, 1)
    if (next.kind === 'text' && original.kind === 'text') {
      expect(next.fontSize).toBeCloseTo(original.fontSize * 0.75, 1)
    }
  })

  it('duplicates the selected layer with an offset and keeps its content', () => {
    const base = createEditorState('quote-card', 'xhs-34')

    const duplicated = duplicateLayer(base, base.selectedLayerId)

    expect(duplicated.layers).toHaveLength(base.layers.length + 1)
    expect(duplicated.selectedLayerId).not.toBe(base.selectedLayerId)

    const original = base.layers.find((layer) => layer.id === base.selectedLayerId)
    const clone = duplicated.layers.find(
      (layer) => layer.id === duplicated.selectedLayerId,
    )

    expect(original).toBeDefined()
    expect(clone).toBeDefined()
    expect(clone?.x).toBe((original?.x ?? 0) + 24)
    expect(clone?.y).toBe((original?.y ?? 0) + 24)
  })

  it('adds an image layer and can force it into a circular shape', () => {
    const base = createEditorState('quote-card', 'xhs-34')

    const withImage = addImageLayer(base, {
      src: 'data:image/png;base64,abc',
      name: 'sample.png',
      naturalWidth: 1200,
      naturalHeight: 800,
    })

    const imageLayer = withImage.layers.find(
      (layer) => layer.id === withImage.selectedLayerId,
    )

    expect(imageLayer?.kind).toBe('image')

    const circular = setImageShape(withImage, withImage.selectedLayerId, 'circle')
    const circleLayer = circular.layers.find(
      (layer) => layer.id === circular.selectedLayerId,
    )

    expect(circleLayer?.kind).toBe('image')
    if (circleLayer?.kind === 'image') {
      expect(circleLayer.shape).toBe('circle')
      expect(circleLayer.width).toBe(circleLayer.height)
      expect(circleLayer.radius).toBe(999)
    }
  })

  it('keeps the original image ratio when only width or height changes', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const withImage = addImageLayer(base, {
      src: 'data:image/png;base64,abc',
      name: 'sample.png',
      naturalWidth: 1200,
      naturalHeight: 800,
    })

    const imageLayer = withImage.layers.find(
      (layer) => layer.id === withImage.selectedLayerId,
    )

    expect(imageLayer?.kind).toBe('image')

    const resizedByWidth = updateLayer(withImage, withImage.selectedLayerId, {
      width: 420,
    })
    const resizedWidthLayer = resizedByWidth.layers.find(
      (layer) => layer.id === resizedByWidth.selectedLayerId,
    )

    expect(resizedWidthLayer?.kind).toBe('image')
    if (resizedWidthLayer?.kind === 'image') {
      expect(resizedWidthLayer.width).toBe(420)
      expect(resizedWidthLayer.height).toBeCloseTo(280, 1)
    }

    const resizedByHeight = updateLayer(withImage, withImage.selectedLayerId, {
      height: 360,
    })
    const resizedHeightLayer = resizedByHeight.layers.find(
      (layer) => layer.id === resizedByHeight.selectedLayerId,
    )

    expect(resizedHeightLayer?.kind).toBe('image')
    if (resizedHeightLayer?.kind === 'image') {
      expect(resizedHeightLayer.width).toBeCloseTo(540, 1)
      expect(resizedHeightLayer.height).toBe(360)
    }
  })

  it('reorders layers while keeping the selected layer active', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const middleLayerId = base.layers[1].id
    const selected = {
      ...base,
      selectedLayerId: middleLayerId,
    }

    const forward = moveLayerForward(selected, middleLayerId)
    expect(forward.layers[2].id).toBe(middleLayerId)
    expect(forward.selectedLayerId).toBe(middleLayerId)

    const backward = moveLayerBackward(forward, middleLayerId)
    expect(backward.layers[1].id).toBe(middleLayerId)

    const toFront = bringLayerToFront(selected, middleLayerId)
    expect(toFront.layers.at(-1)?.id).toBe(middleLayerId)

    const toBack = sendLayerToBack(selected, middleLayerId)
    expect(toBack.layers[0].id).toBe(middleLayerId)
  })

  it('creates a custom template snapshot that can be applied later', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const custom = createCustomTemplate('老板专用', base)
    const applied = applyCustomTemplate(custom)

    expect(custom.name).toBe('老板专用')
    expect(applied.templateSource).toBe('custom')
    expect(applied.templateName).toBe('老板专用')
    expect(applied.layers).toHaveLength(base.layers.length)
  })
})
