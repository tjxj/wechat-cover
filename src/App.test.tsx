import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the local cover studio workspace', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: '封面工作台' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('尺寸')).toHaveValue('xhs-34')
    expect(screen.getByLabelText('模板')).toHaveValue('builtin:quote-card')
    expect(
      screen.getByRole('button', { name: '下载 PNG' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('本地运行')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '排列' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Moonlit Asteroid' })).toBeInTheDocument()
  })

  it('switches template presets from the top bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('模板'), 'builtin:story-glow')

    expect(screen.getByTestId('current-template-name')).toHaveTextContent(
      '故事封面',
    )
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

  it('shows advanced text controls and layer order actions', async () => {
    render(<App />)

    expect(screen.getByLabelText('字距')).toBeInTheDocument()
    expect(screen.getByLabelText('行距')).toBeInTheDocument()
    expect(screen.getByLabelText('描边')).toBeInTheDocument()
    expect(screen.getByLabelText('阴影')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上移一层' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下移一层' })).toBeInTheDocument()
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
