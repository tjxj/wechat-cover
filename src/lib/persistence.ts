import { createStore, del, get, set } from 'idb-keyval'
import {
  normalizeEditorState,
  type EditorState,
  type UserTemplate,
} from './editor'

const workspaceStore = createStore('cover-clone-local-db', 'workspace')
const CURRENT_STATE_KEY = 'current-state'
const CUSTOM_TEMPLATES_KEY = 'custom-templates'

interface WorkspacePayload {
  currentState: EditorState | null
  templates: UserTemplate[]
}

export const loadWorkspace = async (): Promise<WorkspacePayload> => {
  const [currentState, templates] = await Promise.all([
    get<EditorState>(CURRENT_STATE_KEY, workspaceStore),
    get<UserTemplate[]>(CUSTOM_TEMPLATES_KEY, workspaceStore),
  ])

  return {
    currentState: currentState ? normalizeEditorState(currentState) : null,
    templates:
      templates?.map((template) => ({
        ...template,
        snapshot: normalizeEditorState(template.snapshot),
      })) ?? [],
  }
}

export const saveCurrentState = async (state: EditorState) => {
  await set(CURRENT_STATE_KEY, state, workspaceStore)
}

export const saveCustomTemplate = async (template: UserTemplate) => {
  const templates =
    (await get<UserTemplate[]>(CUSTOM_TEMPLATES_KEY, workspaceStore)) ?? []

  const nextTemplates = [
    template,
    ...templates.filter((item) => item.id !== template.id),
  ]

  await set(CUSTOM_TEMPLATES_KEY, nextTemplates, workspaceStore)

  return nextTemplates
}

export const deleteCustomTemplate = async (templateId: string) => {
  const templates =
    (await get<UserTemplate[]>(CUSTOM_TEMPLATES_KEY, workspaceStore)) ?? []
  const nextTemplates = templates.filter((item) => item.id !== templateId)

  await set(CUSTOM_TEMPLATES_KEY, nextTemplates, workspaceStore)

  return nextTemplates
}

export const clearWorkspaceStorage = async () => {
  await Promise.all([
    del(CURRENT_STATE_KEY, workspaceStore),
    del(CUSTOM_TEMPLATES_KEY, workspaceStore),
  ])
}
