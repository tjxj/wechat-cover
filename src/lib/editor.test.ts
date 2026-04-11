import * as editor from './editor'
import {
  addImageLayer,
  applyCustomTemplate,
  bringLayerToFront,
  createCustomTemplate,
  createEditorState,
  duplicateLayer,
  getSelectedLayerIds,
  isTextLayer,
  moveLayerBackward,
  moveLayerForward,
  normalizeEditorState,
  resizeState,
  selectLayer,
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

  it('aligns the selected layer to another layer reference', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const sourceLayerId = base.layers[2].id
    const targetLayerId = base.layers[1].id

    const aligned = (
      editor as {
        alignLayerToReference: (
          state: ReturnType<typeof createEditorState>,
          layerId: string,
          referenceId: string,
          alignment: 'right' | 'middle',
        ) => ReturnType<typeof createEditorState>
      }
    ).alignLayerToReference(base, sourceLayerId, targetLayerId, 'right')

    const rightAlignedLayer = aligned.layers.find(
      (layer) => layer.id === sourceLayerId,
    )
    const targetLayer = aligned.layers.find((layer) => layer.id === targetLayerId)

    expect(rightAlignedLayer).toBeDefined()
    expect(targetLayer).toBeDefined()
    expect(rightAlignedLayer?.x).toBe(
      (targetLayer?.x ?? 0) + (targetLayer?.width ?? 0) - (rightAlignedLayer?.width ?? 0),
    )

    const middleAligned = (
      editor as {
        alignLayerToReference: (
          state: ReturnType<typeof createEditorState>,
          layerId: string,
          referenceId: string,
          alignment: 'right' | 'middle',
        ) => ReturnType<typeof createEditorState>
      }
    ).alignLayerToReference(aligned, sourceLayerId, targetLayerId, 'middle')

    const middleAlignedLayer = middleAligned.layers.find(
      (layer) => layer.id === sourceLayerId,
    )
    const middleTarget = middleAligned.layers.find(
      (layer) => layer.id === targetLayerId,
    )

    expect(middleAlignedLayer?.y).toBeCloseTo(
      (middleTarget?.y ?? 0) +
        ((middleTarget?.height ?? 0) - (middleAlignedLayer?.height ?? 0)) / 2,
      1,
    )
  })

  it('aligns text and image layers against each other', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const withImage = addImageLayer(base, {
      src: 'data:image/png;base64,abc',
      name: 'sample.png',
      naturalWidth: 1200,
      naturalHeight: 800,
    })
    const imageLayer = withImage.layers.find((layer) => layer.id === withImage.selectedLayerId)
    const textLayer = withImage.layers
      .filter(isTextLayer)
      .find((layer) => layer.width <= 320)

    expect(imageLayer).toBeDefined()
    expect(textLayer).toBeDefined()

    const aligned = (
      editor as {
        alignLayerToReference: (
          state: ReturnType<typeof createEditorState>,
          layerId: string,
          referenceId: string,
          alignment: 'left' | 'bottom',
        ) => ReturnType<typeof createEditorState>
      }
    ).alignLayerToReference(
      withImage,
      textLayer?.id ?? '',
      imageLayer?.id ?? '',
      'left',
    )

    const leftAlignedText = aligned.layers.find((layer) => layer.id === textLayer?.id)
    const alignedImage = aligned.layers.find((layer) => layer.id === imageLayer?.id)

    expect(leftAlignedText?.x).toBe(alignedImage?.x)

    const bottomAligned = (
      editor as {
        alignLayerToReference: (
          state: ReturnType<typeof createEditorState>,
          layerId: string,
          referenceId: string,
          alignment: 'left' | 'bottom',
        ) => ReturnType<typeof createEditorState>
      }
    ).alignLayerToReference(
      aligned,
      textLayer?.id ?? '',
      imageLayer?.id ?? '',
      'bottom',
    )

    const bottomAlignedText = bottomAligned.layers.find(
      (layer) => layer.id === textLayer?.id,
    )
    const bottomAlignedImage = bottomAligned.layers.find(
      (layer) => layer.id === imageLayer?.id,
    )

    expect(bottomAlignedText?.y).toBeCloseTo(
      (bottomAlignedImage?.y ?? 0) +
        (bottomAlignedImage?.height ?? 0) -
        (bottomAlignedText?.height ?? 0),
      1,
    )
  })

  it('normalizes legacy text layers with missing emphasis flags', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const legacyState = {
      ...base,
      layers: base.layers.map((layer) => {
        if (!isTextLayer(layer)) {
          return layer
        }

        const legacyLayer = { ...layer } as Record<string, unknown>
        delete legacyLayer.italic
        delete legacyLayer.underline
        delete legacyLayer.strikethrough

        return legacyLayer
      }),
    }

    const normalized = normalizeEditorState(legacyState as never)
    const normalizedTextLayer = normalized.layers.find(isTextLayer)

    expect(normalizedTextLayer).toBeDefined()
    expect((normalizedTextLayer as editor.TextLayer).italic).toBe(false)
    expect((normalizedTextLayer as editor.TextLayer).underline).toBe(false)
    expect((normalizedTextLayer as editor.TextLayer).strikethrough).toBe(false)
  })

  it('supports additive selection and aligns selected layers as a group', () => {
    const base = createEditorState('quote-card', 'xhs-34')
    const multiSelected = selectLayer(base, base.layers[2].id, { additive: true })

    expect(getSelectedLayerIds(multiSelected)).toEqual([
      base.layers[0].id,
      base.layers[2].id,
    ])

    const aligned = (
      editor as {
        alignSelectedLayers: (
          state: ReturnType<typeof createEditorState>,
          layerIds: string[],
          alignment: 'left' | 'middle',
        ) => ReturnType<typeof createEditorState>
      }
    ).alignSelectedLayers(
      multiSelected,
      getSelectedLayerIds(multiSelected),
      'left',
    )

    expect(aligned.layers[0].x).toBe(108)
    expect(aligned.layers[2].x).toBe(108)

    const middleAligned = (
      editor as {
        alignSelectedLayers: (
          state: ReturnType<typeof createEditorState>,
          layerIds: string[],
          alignment: 'left' | 'middle',
        ) => ReturnType<typeof createEditorState>
      }
    ).alignSelectedLayers(
      aligned,
      getSelectedLayerIds(aligned),
      'middle',
    )

    const firstLayer = middleAligned.layers[0]
    const thirdLayer = middleAligned.layers[2]
    const selectionTop = Math.min(firstLayer.y, thirdLayer.y)
    const selectionBottom = Math.max(
      firstLayer.y + firstLayer.height,
      thirdLayer.y + thirdLayer.height,
    )
    const selectionCenter = selectionTop + (selectionBottom - selectionTop) / 2

    expect(firstLayer.y + firstLayer.height / 2).toBeCloseTo(selectionCenter, 1)
    expect(thirdLayer.y + thirdLayer.height / 2).toBeCloseTo(selectionCenter, 1)
  })
})
