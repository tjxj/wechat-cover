import {
  clearWorkspaceStorage,
  loadWorkspace,
  saveCurrentState,
  saveCustomTemplate,
} from './persistence'
import { createCustomTemplate, createEditorState } from './editor'

describe('workspace persistence', () => {
  it('stores current state and custom templates in indexed storage', async () => {
    await clearWorkspaceStorage()

    const state = createEditorState('story-glow', 'story-916')
    const template = createCustomTemplate('夜聊模板', state)

    await saveCurrentState(state)
    await saveCustomTemplate(template)

    const loaded = await loadWorkspace()

    expect(loaded.currentState?.templateId).toBe('story-glow')
    expect(loaded.templates).toHaveLength(1)
    expect(loaded.templates[0].name).toBe('夜聊模板')
    expect(loaded.templates[0].snapshot.layers).toHaveLength(state.layers.length)
  })
})
