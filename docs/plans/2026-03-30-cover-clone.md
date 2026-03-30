# Cover Clone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local cover editor that recreates the core experience of `cover.qiaomu.ai`.

**Architecture:** Use a single-page React app with local state and preset template data. Keep everything browser-side so it works offline after install, with DOM-based export for image download.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, html-to-image

---

### Task 1: Editor State

**Files:**
- Create: `src/lib/editor.ts`
- Create: `src/lib/editor.test.ts`

**Step 1: Write the failing test**

Write tests for:
- template creation returns expected canvas size and starter text blocks
- resizing scales existing text blocks
- duplicating a selected block offsets the clone

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/editor.test.ts`

**Step 3: Write minimal implementation**

Add pure helper functions for presets, templates, resizing, selection and duplication.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/editor.test.ts`

### Task 2: Main Workspace

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

**Step 1: Write the failing test**

Write tests that confirm:
- the editor loads with the main layout
- template switching updates the canvas label
- adding a text block shows it on the canvas

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

**Step 3: Write minimal implementation**

Replace the starter page with the editor shell, canvas and side panels.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`

### Task 3: Styling and Export

**Files:**
- Modify: `src/index.css`
- Create: `src/App.css`

**Step 1: Write the failing test**

Add any missing assertions for export button availability and visible preset controls.

**Step 2: Run test to verify it fails**

Run: `npm test`

**Step 3: Write minimal implementation**

Apply the final layout and wire up PNG export.

**Step 4: Run test to verify it passes**

Run: `npm test`
