import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { clearWorkspaceStorage } from '../lib/persistence'

beforeEach(async () => {
  window.localStorage?.clear?.()
  await clearWorkspaceStorage()
})
