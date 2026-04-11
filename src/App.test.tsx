import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the local cover studio workspace', () => {
    render(<App />)

    const banner = screen.getByRole('banner')

    expect(
      screen.getByRole('heading', { level: 1, name: 'AI学习的章北海' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'AI学习的章北海头像' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('尺寸')).toHaveValue('xhs-34')
    expect(screen.getByLabelText('模板')).toHaveValue('builtin:quote-card')
    expect(
      screen.getByRole('button', { name: '下载 PNG' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '撤销' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重做' })).not.toBeInTheDocument()
    expect(screen.queryByText('尺寸')).not.toBeInTheDocument()
    expect(screen.queryByText('模板')).not.toBeInTheDocument()
    expect(screen.queryByText('本地运行')).not.toBeInTheDocument()
    expect(screen.queryByText('本地复刻版')).not.toBeInTheDocument()
    expect(screen.queryByText(/预览/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '排列' })).not.toBeInTheDocument()
    expect(within(banner).queryByText('AI学习的老章')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '样式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '图层' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '背景' })).toBeInTheDocument()
    expect(screen.getByLabelText('模板名称')).toBeInTheDocument()
    expect(screen.queryByText('乔木封面实验室')).not.toBeInTheDocument()
    expect(screen.getByLabelText('文字图层 3')).toHaveTextContent('AI学习的老章')
  })

  it('switches template presets from the top bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('模板'), 'builtin:story-glow')

    expect(screen.getByLabelText('文字图层 1')).toHaveTextContent(
      '凌晨三点的灵感',
    )
  })

  it('adds a new text block and focuses its content in the editor panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    const beforeCount = screen.getAllByLabelText(/文字图层/).length

    await user.click(screen.getByRole('button', { name: '添加文字' }))

    expect(screen.getAllByLabelText(/文字图层/)).toHaveLength(beforeCount + 1)
    expect(screen.getByLabelText('字号')).toHaveValue(64)
  })

  it('edits text directly on the canvas instead of the right panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.dblClick(screen.getByLabelText('文字图层 1'))

    const editor = await screen.findByLabelText('画布文字编辑器')

    expect(screen.queryByLabelText('文字内容')).not.toBeInTheDocument()
    await user.clear(editor)
    await user.type(editor, '老板的新标题')

    expect(editor).toHaveValue('老板的新标题')
  })

  it('keeps the sidebar minimal and lets text switch background frame', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByLabelText('图片名称')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('图片宽度')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('图片高度')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '无底框' }))

    expect(screen.getByLabelText('文字图层 1')).toHaveStyle({
      background: 'transparent',
    })
  })

  it('switches inspector tabs and exposes solid background colors', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByLabelText('字号')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '背景' }))

    expect(screen.queryByLabelText('字号')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '纯色背景 #f7f0dc' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Moonlit Asteroid' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '图层' }))

    expect(screen.getByRole('button', { name: '上移一层' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '纯色背景 #f7f0dc' })).not.toBeInTheDocument()
  })

  it('clears text outline together with frame when switching to no frame', async () => {
    const user = userEvent.setup()
    render(<App />)

    fireEvent.change(screen.getByLabelText('描边'), {
      target: { value: '3' },
    })

    const textLayer = screen.getByLabelText('文字图层 1')
    expect(textLayer.style.webkitTextStroke).toContain('3px')

    await user.click(screen.getByRole('button', { name: '无底框' }))

    expect(textLayer).toHaveStyle({ background: 'transparent' })
    expect(textLayer.style.webkitTextStroke).toBe('')
    expect(window.getComputedStyle(textLayer).boxShadow).toBe('none')
    expect(window.getComputedStyle(textLayer).paddingTop).toBe('0px')
  })

  it('deletes the selected layer with the keyboard delete key on mac', async () => {
    const user = userEvent.setup()
    render(<App />)

    const beforeCount = screen.getAllByLabelText(/文字图层/).length
    await user.click(screen.getByLabelText('文字图层 1'))
    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(screen.getAllByLabelText(/文字图层/)).toHaveLength(beforeCount - 1)
  })

  it('undoes and redoes editor changes with keyboard shortcuts after deleting a layer', async () => {
    const user = userEvent.setup()
    render(<App />)

    const beforeCount = screen.getAllByLabelText(/文字图层/).length

    await user.click(screen.getByLabelText('文字图层 1'))
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.getAllByLabelText(/文字图层/)).toHaveLength(beforeCount - 1)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(screen.getAllByLabelText(/文字图层/)).toHaveLength(beforeCount)

    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
    expect(screen.getAllByLabelText(/文字图层/)).toHaveLength(beforeCount - 1)
  })

  it('nudges the selected layer with arrow keys for fine positioning', async () => {
    const user = userEvent.setup()
    render(<App />)

    const textLayer = screen.getByLabelText('文字图层 1')

    await user.click(textLayer)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true })

    expect(textLayer).toHaveStyle({ left: '109px', top: '190px' })
  })

  it('shows advanced text controls and layer order actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByLabelText('字距')).toBeInTheDocument()
    expect(screen.getByLabelText('行距')).toBeInTheDocument()
    expect(screen.getByLabelText('描边')).toBeInTheDocument()
    expect(screen.getByLabelText('阴影')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '左对齐' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '居中对齐' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '右对齐' })).toBeInTheDocument()
    expect(screen.queryByText(/^左对齐$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^居中对齐$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^右对齐$/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '图层' }))

    expect(screen.getByRole('button', { name: '上移一层' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下移一层' })).toBeInTheDocument()
  })

  it('changes text alignment from the style panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    const textLayer = screen.getByLabelText('文字图层 1')

    await user.click(screen.getByRole('button', { name: '居中对齐' }))

    expect(textLayer).toHaveStyle({ textAlign: 'center' })
  })

  it('aligns the selected layer to another reference layer from the panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sourceLayer = screen.getByLabelText('文字图层 3')
    await user.click(sourceLayer)
    await user.click(screen.getByRole('button', { name: '图层' }))
    await user.selectOptions(
      screen.getByLabelText('对齐参考'),
      screen.getByRole('option', { name: '文字图层 2' }),
    )
    await user.click(screen.getByRole('button', { name: '参考右边对齐' }))

    expect(sourceLayer).toHaveStyle({ left: '516px' })
  })

  it('applies text emphasis controls from the style panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    const textLayer = screen.getByLabelText('文字图层 1')

    await user.click(screen.getByRole('button', { name: '常规' }))
    await user.click(screen.getByRole('button', { name: '斜体' }))
    await user.click(screen.getByRole('button', { name: '下划线' }))
    await user.click(screen.getByRole('button', { name: '删除线' }))

    expect(textLayer).toHaveStyle({ fontWeight: '500' })
    expect(textLayer).toHaveStyle({ fontStyle: 'italic' })
    expect(textLayer.style.textDecoration).toBe('underline line-through')
  })

  it('shows a resize handle for selected text layers', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByLabelText('文字图层 1'))

    expect(
      screen.getByRole('button', { name: '调整文字宽度' }),
    ).toBeInTheDocument()
  })

  it('saves a custom template and loads it again after remount', async () => {
    const user = userEvent.setup()
    const firstRender = render(<App />)

    await user.clear(screen.getByLabelText('模板名称'))
    await user.type(screen.getByLabelText('模板名称'), '老板常用封面')
    await user.click(screen.getByRole('button', { name: '保存模板' }))

    expect(
      await screen.findByRole('button', { name: '老板常用封面' }),
    ).toBeInTheDocument()

    firstRender.unmount()
    render(<App />)

    expect(
      await screen.findByRole('button', { name: '老板常用封面' }),
    ).toBeInTheDocument()
  })

  it('uploads an image as an editable image layer', async () => {
    const user = userEvent.setup()
    const imageFile = new File(['demo'], 'hero.png', { type: 'image/png' })

    class MockFileReader {
      result = 'data:image/png;base64,abc'
      error = null
      onload: null | ((event: ProgressEvent<FileReader>) => void) = null
      onerror: null | (() => void) = null

      readAsDataURL() {
        if (this.onload) {
          this.onload(new ProgressEvent('load') as ProgressEvent<FileReader>)
        }
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)

    class MockImage {
      naturalWidth = 1200
      naturalHeight = 800
      onload: null | (() => void) = null
      onerror: null | (() => void) = null

      set src(_value: string) {
        if (this.onload) {
          this.onload()
        }
      }
    }

    vi.stubGlobal('Image', MockImage)

    render(<App />)

    await user.upload(screen.getByLabelText('上传图片'), imageFile)

    expect(await screen.findByLabelText(/图片图层/)).toBeInTheDocument()
  })
})
