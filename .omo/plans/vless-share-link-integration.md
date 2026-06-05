# Series 🔗1: VLESS 分享链接深度集成

## TL;DR
> **Summary**: 在 Xray 配置生成器中集成 VLESS 分享链接的导入、导出、校验和管理功能。核心逻辑已在 `src/utils/vless-share.ts` 中实现，本系列是纯 UI 集成工作。
> **Deliverables**: 5 个新 UI 组件 + App.tsx 集成 + 中英文 i18n 词条
> **Effort**: Medium (5 tasks, pure UI work, no new core logic)
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

## Context
### Original Request
> 设计一系列任务对当前项目不断进行迭代 — 功能优先，小步快跑，专注 Xray 生态

### Interview Summary
- 项目：JSON Schema + MUI 配置生成器（Xray 配置工具）
- 技术栈：React 19 + MUI 7.3 + rjsf 6.4 + Vite 8 + TypeScript 6
- 核心工具 `src/utils/vless-share.ts` 已完整实现 VLESS 解析/格式化/Xray 互转逻辑
- 需求：将 VLESS 分享链接导入/导出功能集成到 UI 中

### Key Architectural Decisions
1. **新建 `src/vless/` 目录** — 所有 VLESS 相关 UI 组件集中管理，不进一步膨胀 App.tsx（已 611 行）
2. **复用现有 Dialog 模式** — 参照 `PostConfigDialog.tsx` 的模式（state → Dialog → onClose/onError 回调）
3. **不修改 vless-share.ts** — 该文件 API 稳定，仅通过 import 调用其导出函数
4. **限制在 outbound 上下文中** — VLESS 相关功能只出现在 selectedField === 'outbounds' 时
5. **i18n 词条统一追加** — 所有新文本在 `src/i18n.ts` 的 `zh-CN` / `en-US` 翻译表中添加
6. **Task 1 包含内联 try/catch 处理 parse 异常** — `parseVlessShareLink()` 是 throw-on-error 的纯函数，UI 层必须捕获。Task 5 将其提取为共享 hook，但 Task 1 不能依赖 Task 5
7. **Task 5 重构 Task 1/3 的代码** — Task 5 在 Wave 3 会修改 Task 1 和 3 创建的组件，这是预期的重构迭代

## Work Objectives
### Core Objective
将已存在的 `vless-share.ts` 核心逻辑通过 UI 组件暴露，使用户能在配置生成器界面中直接导入/导出/管理 VLESS 分享链接。

### Deliverables
| # | Deliverable | Description |
|---|------------|-------------|
| 1 | `src/vless/ImportDialog.tsx` | 单一 VLESS 链接导入对话框（含解析预览） |
| 2 | App.tsx VLESS 导出功能 | outbound 预览区加入"复制分享链接"按钮 |
| 3 | `src/vless/BatchImportDialog.tsx` | 批量 VLESS 链接导入向导 |
| 4 | `src/vless/ShareLinkPanel.tsx` | 分享链接管理面板 |
| 5 | 全系列 i18n + 错误处理 | 统一的校验反馈和错误处理机制 |

### Definition of Done (verifiable conditions)
```
pnpm build            # 构建通过，无类型/编译错误
pnpm typecheck        # TypeScript 检查通过
```
- VLESS 链接输入后实时解析并展示预览
- 单条 VLESS 链接可正常导入并合并到当前配置
- 批量导入支持多行输入 + 模式选择
- 每个 VLESS outbound 可一键复制分享链接
- 错误链接显示友好的错误提示（中英文）
- 所有新功能在 outbound 模块选中时可见

### Must Have
- 单一链接导入（含实时解析预览、确认合并）
- 链接导出（复制到剪贴板 + 反馈）
- 批量导入（多行文本、模式选择、预览）
- 校验反馈（无效链接即时提示）
- 中英文 i18n 支持

### Must NOT Have
- ❌ 不修改 `vless-share.ts` 现有 API
- ❌ 不引入新依赖（如 qrcode 库 — QR 码延期）
- ❌ 不在非 outbound 模块显示 VLESS 功能
- ❌ 不改变现有配置存储/加载逻辑
- ❌ 不引入测试（延后到 Series 6）

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification through build commands and QA scenarios.
- **Test decision**: None this series (deferred to Series 6)
- **QA policy**: Every task has agent-executed build + smoke test scenarios
- **Evidence**: `.omo/evidence/task-{N}-{slug}.md`

## Execution Strategy

### Parallel Execution Waves
```
Wave 1 (Foundation): Task 1 (Import Dialog) — defines component pattern, i18n additions
Wave 2 (Features):   Task 2 + Task 3 — export and batch import, parallelizable
Wave 3 (Polish):     Task 4 + Task 5 — management panel and validation polish
```

### Dependency Matrix
| Task | Depends On | Blocks | Parallelizable |
|------|-----------|--------|---------------|
| 1. Import Dialog | — | 3, 5 | Wave 1 |
| 2. Export Button | — | — | Wave 2 (parallel with 3) |
| 3. Batch Import | 1 | 4 | Wave 2 (parallel with 2) |
| 4. Management Panel | 2, 3 | — | Wave 3 |
| 5. Validation Polish | 1 | — | Wave 3 (parallel with 4) |

### Agent Dispatch Summary
| Wave | Tasks | Category | Skills |
|------|-------|----------|--------|
| Wave 1 | Task 1 | unspecified-high | React, MUI, Dialog pattern |
| Wave 2 | Task 2, 3 | unspecified-high | React, clipboard API, batch operations |
| Wave 3 | Task 4, 5 | unspecified-high | React, state management, validation |

## TODOs

- [x] 1. VLESS 单条链接导入对话框

  **What to do**:
  1. Create `src/vless/` directory
   2. Create `src/vless/ImportDialog.tsx`:
     - Dialog component following `PostConfigDialog` patterns
     - Text input for VLESS URL
     - Real-time parsing preview: on input change, call `parseVlessShareLink()` wrapped in try/catch (this function THROWS on invalid input — catch the error and display it as validation text, do NOT let it crash the component)
     - Show parsed result in a preview panel (address, port, protocol, encryption, security, etc.)
     - Error state for invalid links (red text + error icon from MUI `Alert`)
     - "确认导入" button that calls `importVlessShareToXrayConfig(config, link)` → updates parent config
     - Props: `open`, `onClose`, `config`, `onConfigUpdate`, `onError`
     - Support keyboard: Enter to confirm
  3. Add i18n keys in `src/i18n.ts`:
     - `app.vless.importTitle`, `app.vless.importHint`, `app.vless.importLabel`, `app.vless.importConfirm`, `app.vless.importCancel`
     - `app.vless.parseSuccess`, `app.vless.parseFailed`
     - `app.vless.previewProtocol`, `app.vless.previewAddress`, `app.vless.previewPort`, `app.vless.previewEncryption`, `app.vless.previewSecurity`
  4. Modify `src/App.tsx`:
     - Add `vlessImportOpen` state (boolean)
     - Add `handleVlessImport` handler that opens dialog
     - Add `handleVlessImportConfirm(configUpdate)` that merges and sets config
     - Add "导入 VLESS 链接" button in the form button area (only when `selectedField === 'outbounds'`)
     - Place `<VlessImportDialog>` component next to `<PostConfigDialog>`
  5. Style: Use same Dialog pattern as PostConfigDialog (maxWidth="sm", fullWidth)

  **Must NOT do**:
  - Do NOT modify `vless-share.ts`
  - Do NOT add external dependencies
  - Do NOT show VLESS import button for non-outbound modules

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Moderately complex multi-file change with MUI Dialog, real-time parsing, and state wiring
  - Skills: N/A (no relevant skills available)
  - Omitted: N/A

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 5 | Blocked By: —

  **References**:
  - Pattern: `src/PostConfigDialog.tsx` — Dialog pattern (state, open/close props, error handling)
  - Pattern: `src/App.tsx:566-591` — Import URL Dialog pattern (TextField + validation + submit flow)
  - API: `src/utils/vless-share.ts:parseVlessShareLink` — async parsing function
  - API: `src/utils/vless-share.ts:importVlessShareToXrayConfig` — merge into config
  - API: `src/utils/vless-share.ts:VlessShare` — parsed result type
  - Types: `src/utils/vless-share.ts:VlessShareParams` — transport/security/encryption fields
  - Types: `src/utils/vless-share.ts:ImportOptions` — mode options (append/replaceByTag/replaceFirstVless)

  **Acceptance Criteria** (agent-executable):
  - [ ] `pnpm typecheck` passes with zero errors
  - [ ] `pnpm build` succeeds
  - [ ] New file `src/vless/ImportDialog.tsx` exists
  - [ ] App.tsx has VLESS import button visible only when outbound is selected
  - [ ] importVlessShareToXrayConfig is called on confirm with correct params

  **QA Scenarios**:
  ```
  Scenario: VLESS Import - Static Analysis
    Tool: interactive_bash
    Steps:
      1. Run `pnpm typecheck` — must pass with zero errors
      2. Run `pnpm build` — must succeed
      3. Read `src/App.tsx` and verify: VlessImportDialog is imported, "导入 VLESS 链接" button exists, vlessImportOpen state exists
      4. Read `src/vless/ImportDialog.tsx` and verify:
         - TextField for URL input exists
         - parseVlessShareLink() called inside a try/catch block
         - importVlessShareToXrayConfig() called on confirm
         - Error state (MUI Alert) renders when URL is invalid
    Expected: All static verifications pass
    Evidence: .omo/evidence/task-1-import-dialog.md
  ```

  **Commit**: YES | Message: `feat(vless): add single VLESS link import dialog` | Files: `src/vless/ImportDialog.tsx`, `src/App.tsx`, `src/i18n.ts`

- [x] 2. VLESS 链接导出（复制到剪贴板）

   **What to do**:
   1. In `src/App.tsx`, modify the right-panel module preview area (the `<Paper>` that shows `selectedModulePreview`):
      - After the JSON `<pre>` block, when `selectedField === 'outbounds'` AND `config.outbounds` is a non-empty array, render a VLESS export section
      - Iterate over `config.outbounds` array
      - For each outbound where `protocol === 'vless'`, render a VLESS export row:
        - Outbound tag name (or index if no tag)
        - "复制链接" button that:
          1. Calls `outboundToVlessShare(outbound)` then `formatVlessShareLink(share)`
          2. Attempts `navigator.clipboard.writeText()` 
          3. **Fallback**: if clipboard API fails (e.g. non-HTTPS local dev), render a read-only `<TextField>` with the link text pre-selected for manual copy, plus a text "请手动复制"
          4. Shows a temporary "已复制 ✓" indicator (use local state `copiedIndex` + `setTimeout` to auto-clear after 2s)
        - Visual divider between outbound items
      - For non-VLESS outbounds, show grayed text "不支持分享链接"
   2. Add i18n keys:
      - `app.vless.copyLink`, `app.vless.copied`, `app.vless.notShareable`, `app.vless.outboundTag`, `app.vless.exportSection`
      - `app.vless.clipboardManualCopy` — "请手动复制" fallback text
   3. Handle clipboard API errors gracefully (fallback message via state, not blocking)
   4. Use inline `Alert` component (already imported in App.tsx) for copy success/error feedback

  **Must NOT do**:
  - Do NOT call format on non-VLESS outbounds
  - Do NOT block on clipboard API rejection — show error toast and continue
  - Do NOT add new external dependencies for clipboard (native API suffices)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Component enhancement with clipboard API and conditional rendering
  - Skills: N/A
  - Omitted: N/A

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4 | Blocked By: —

  **References**:
  - Pattern: `src/App.tsx:483-522` — Right panel module preview area (modify/extend)
  - API: `src/utils/vless-share.ts:outboundToVlessShare` — convert outbound → share
  - API: `src/utils/vless-share.ts:formatVlessShareLink` — format share → string
  - Types: `src/utils/vless-share.ts:XrayOutbound` — outbound structure
  - Types: `src/utils/vless-share.ts:VlessShare` — share struct
  - Browser API: `navigator.clipboard.writeText()`

  **Acceptance Criteria** (agent-executable):
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm build` succeeds
  - [ ] VLESS outbounds show "复制链接" button in right panel
  - [ ] Non-VLESS outbounds show "不支持分享链接"
  - [ ] Clicking copy button writes VLESS link to clipboard
  - [ ] "已复制" indicator appears temporarily after copy

  **QA Scenarios**:
  ```
  Scenario: VLESS Export - Static Analysis
    Tool: interactive_bash
    Steps:
      1. Run `pnpm typecheck` — must pass with zero errors
      2. Run `pnpm build` — must succeed
      3. Read modified sections of `src/App.tsx` and verify:
         - Export section renders only when selectedField === 'outbounds'
         - outboundToVlessShare is called per outbound item
         - formatVlessShareLink is called on each result
         - clipboard.writeText is called with fallback
         - Non-VLESS outbounds show "不支持分享链接" text
         - Copied state indicator exists (useState for copiedIndex)
    Expected: All static verifications pass
    Evidence: .omo/evidence/task-2-export-copy.md
  ```

  **Commit**: YES | Message: `feat(vless): add VLESS link export with clipboard copy` | Files: `src/App.tsx`, `src/i18n.ts`

- [x] 3. VLESS 批量导入向导

  **What to do**:
  1. Create `src/vless/BatchImportDialog.tsx`:
     - Multi-line `TextField` (minRows=6) accepting one VLESS link per line
     - "解析并预览" button that:
       - Splits text by newline, filters empty lines
       - Parses each line with `parseVlessShareLink()`
       - Builds a result list showing: link preview, status (valid ✓ / invalid ✗), parsed info if valid
       - Invalid links show specific error message (from exception)
     - Import mode selector (dropdown):
       - `append` — 追加到现有 outbounds
       - `replaceByTag` — 按 tag 替换
       - `replaceFirstVless` — 替换第一个 VLESS outbound
     - "确认导入" button that:
       - Collects only valid parsed share objects
       - For each, calls `vlessShareToXrayOutbound()` to convert to config
       - Calls `importVlessShareToXrayConfig()` with selected mode
       - Updates parent config
     - Summary: "X 条成功, Y 条失败"
  2. Add i18n keys:
     - `app.vless.batchTitle`, `app.vless.batchHint`, `app.vless.batchPlaceholder`
     - `app.vless.batchParse`, `app.vless.batchConfirm`, `app.vless.batchCancel`
     - `app.vless.batchResult`, `app.vless.batchSuccess`, `app.vless.batchFailed`
     - `app.vless.importMode`, `app.vless.modeAppend`, `app.vless.modeReplaceTag`, `app.vless.modeReplaceFirst`
     - `app.vless.valid`, `app.vless.invalid`
  3. Modify `src/App.tsx`:
     - Add `vlessBatchImportOpen` state
     - Add button "批量导入 VLESS" (only when `selectedField === 'outbounds'`)
     - Add handler that creates a new `XrayConfig` from batch results via `importVlessShareToXrayConfig`
     - Place `<VlessBatchImportDialog>` next to other dialogs

  **Must NOT do**:
  - Do NOT auto-import invalid links — user must review and confirm
  - Do NOT allow empty input to proceed
  - Do NOT add dependencies on external text editors

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Complex dialog with multi-step wizard, batch processing, and mode selection
  - Skills: N/A
  - Omitted: N/A

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4 | Blocked By: 1

  **References**:
  - Pattern: `src/PostConfigDialog.tsx` — Dialog with form controls and submission flow
  - Pattern: `src/App.tsx:566-591` — Import URL Dialog pattern (validation + confirm + error)
  - API: `src/utils/vless-share.ts:parseVlessShareLink` — per-line parsing
  - API: `src/utils/vless-share.ts:vlessShareToXrayOutbound` — share → outbound config
  - API: `src/utils/vless-share.ts:importVlessShareToXrayConfig` — merge into config
  - Types: `src/utils/vless-share.ts:ImportOptions.mode` — import mode enum
  - UI: `src/vless/ImportDialog.tsx` — reuse parsing preview pattern

  **Acceptance Criteria** (agent-executable):
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm build` succeeds
  - [ ] Batch import dialog accepts multi-line input
  - [ ] Each line is parsed and shows valid/invalid status
  - [ ] Import mode selector is present and functional
  - [ ] Only valid links are imported on confirm
  - [ ] Summary result is shown after import

  **QA Scenarios**:
  ```
  Scenario: Batch Import - Static Analysis
    Tool: interactive_bash
    Steps:
      1. Run `pnpm typecheck` — must pass with zero errors
      2. Run `pnpm build` — must succeed
      3. Read `src/vless/BatchImportDialog.tsx` and verify:
         - Multi-line TextField (minRows >= 6) exists
         - "解析并预览" button splits by newline and parses each line
         - Valid/invalid status display per line (green badge / red badge)
         - Import mode Select with 3 options (append, replaceByTag, replaceFirstVless)
         - Only valid links are passed to importVlessShareToXrayConfig on confirm
         - Summary result ("X 条成功, Y 条失败") displayed after import
      4. Read `src/App.tsx` and verify: batch import button + state + handler exist
    Expected: All static verifications pass
    Evidence: .omo/evidence/task-3-batch-import.md
  ```

  **Commit**: YES | Message: `feat(vless): add batch VLESS import wizard` | Files: `src/vless/BatchImportDialog.tsx`, `src/App.tsx`, `src/i18n.ts`

- [x] 4. VLESS 分享链接管理面板

  **What to do**:
   1. Create `src/vless/ShareLinkPanel.tsx`:
     - Table/list view showing ALL VLESS outbounds from config
     - Columns: Tag, Protocol, Address, Port, Network, Security, Share Link, Actions
     - Share Link column shows truncated link + "复制" button
     - Actions column: "复制链接" + "删除 outbound" buttons
     - Filter/search input to filter by tag or address
     - "复制所有" button — copies all VLESS links (one per line) to clipboard
     - Empty state: "暂无 VLESS outbound 配置"
     - Delete confirmation before removing an outbound:
       - Deleting removes the item from `config.outbounds` array by index
       - Call `orderXrayConfig(updatedConfig)` to maintain field ordering
       - Show MUI `Alert` with "确认删除 [tag] 这个 outbound？删除后不可恢复" + 取消/确认按钮
  2. Add i18n keys:
     - `app.vless.panelTitle`, `app.vless.panelEmpty`
     - `app.vless.panelTag`, `app.vless.panelProtocol`, `app.vless.panelAddress`, `app.vless.panelPort`
     - `app.vless.panelNetwork`, `app.vless.panelSecurity`, `app.vless.panelLink`
     - `app.vless.panelCopyAll`, `app.vless.panelDelete`, `app.vless.panelDeleteConfirm`
     - `app.vless.panelSearch`
  3. Modify `src/App.tsx`:
     - Add `vlessPanelOpen` state
     - Add "分享链接管理" button (only when `selectedField === 'outbounds'`)
     - Add delete handler that removes outbound by index and updates config
     - Place `<VlessShareLinkPanel>` dialog component

  **Must NOT do**:
  - Do NOT implement QR code generation
  - Do NOT add server-side persistence
  - Do NOT modify outbounds when panel is closed (no side effects)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Data-display panel with reactive delete operations on parent state
  - Skills: N/A
  - Omitted: N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: — | Blocked By: 2, 3

  **References**:
  - Pattern: `src/App.tsx:593-599` — Dialog pattern (PostConfigDialog)
  - API: `src/utils/vless-share.ts:exportVlessLinksFromXrayConfig` — bulk export
  - API: `src/utils/vless-share.ts:outboundToVlessShare` — single conversion
  - API: `src/utils/vless-share.ts:formatVlessShareLink` — format
  - MUI: `Table`, `TableContainer`, `TableHead`, `TableBody`, `TableRow`, `TableCell` — for list display
  - MUI: `TextField` with search icon — for filter input
  - MUI: `Dialog` with `maxWidth="md"` — enough space for table columns

  **Acceptance Criteria** (agent-executable):
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm build` succeeds
  - [ ] Panel shows table with all VLESS outbounds
  - [ ] Each row has copy and delete actions
  - [ ] Delete shows confirmation and removes outbound
  - [ ] "复制所有" copies all links to clipboard
  - [ ] Search/filter works by tag and address
  - [ ] Empty state renders when no VLESS outbounds

  **QA Scenarios**:
  ```
  Scenario: Share Link Panel - Static Analysis
    Tool: interactive_bash
    Steps:
      1. Run `pnpm typecheck` — must pass
      2. Run `pnpm build` — must succeed
      3. Read `src/vless/ShareLinkPanel.tsx` and verify:
         - Table with columns: Tag, Protocol, Address, Port, Network, Security, Share Link, Actions
         - Copy button per row calls clipboard API
         - Delete button shows confirmation (Alert + confirm/cancel)
         - "复制所有" button copies all links to clipboard
         - Search/Filter input filters by tag or address
         - Empty state renders when config.outbounds is empty or has no VLESS
      4. Read `src/App.tsx` and verify: panel button + state + delete handler exist
    Expected: All static verifications pass
    Evidence: .omo/evidence/task-4-management-panel.md
  ```

  **Commit**: YES | Message: `feat(vless): add share link management panel` | Files: `src/vless/ShareLinkPanel.tsx`, `src/App.tsx`, `src/i18n.ts`

- [x] 5. VLESS 校验反馈与错误处理增强

  **What to do**:
  1. Extract shared validation logic into `src/vless/useVlessValidation.ts`:
     - `useVlessValidation()` custom hook
     - State: `input`, `parsedResult`, `error`, `isValidating`
     - Method: `validate(link: string)` — calls `parseVlessShareLink()`, sets parsed result or error
     - Method: `clear()` — resets state
     - Reusable by both ImportDialog and BatchImportDialog
  2. Enhance ImportDialog (`src/vless/ImportDialog.tsx`):
     - Use the new `useVlessValidation` hook
     - Add colored border/styling: green border for valid, red for invalid
     - Show structured parsed data in a MUI `Card` or styled box:
       - Each field (address, port, protocol, security, etc.) shown as key-value
       - Use MUI `Table` or `Stack` layout for clean display
     - Add "复制解析结果" button to copy raw parsed JSON
  3. Enhance BatchImportDialog (`src/vless/BatchImportDialog.tsx`):
     - Show per-link validation status badges (green check / red X)
     - Hover/click on invalid link shows error detail tooltip
     - Auto-scroll to first invalid link
     - Show progress indicator during batch parsing
  4. Add MUI `Collapse` animation for showing/hiding parsed details (UX polish)
  5. All error messages use i18n translation (already partially done, but audit for coverage)

  **Must NOT do**:
  - Do NOT change the parse API — only wrap it with React state management
  - Do NOT add server-side validation
  - Do NOT modify existing error handling in App.tsx

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Refactoring and enhancing existing components with shared hook and UX polish
  - Skills: N/A
  - Omitted: N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: — | Blocked By: 1

  **References**:
  - Hook pattern: `src/i18n.ts:useI18n()` — existing custom hook pattern
  - Component: `src/vless/ImportDialog.tsx` — the component to refactor
  - Component: `src/vless/BatchImportDialog.tsx` — the component to enhance
  - API: `src/utils/vless-share.ts:parseVlessShareLink` — validation logic source
  - MUI: `Collapse` — for animated expand/collapse
  - MUI: `Card`, `Table` — for structured data display
  - MUI: `Badge`, `Tooltip` — for validation status indicators

  **Acceptance Criteria** (agent-executable):
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm build` succeeds
  - [ ] `src/vless/useVlessValidation.ts` exists with the custom hook
  - [ ] ImportDialog uses the shared hook
  - [ ] BatchImportDialog shows per-link validation status
  - [ ] Colored border/styling for valid/invalid input
  - [ ] All error messages are i18n-translated

  **QA Scenarios**:
  ```
  Scenario: Validation Hook - Static Analysis
    Tool: interactive_bash
    Steps:
      1. Run `pnpm typecheck` — must pass
      2. Run `pnpm build` — must succeed
      3. Read `src/vless/useVlessValidation.ts` and verify:
         - Custom React hook (useVlessValidation) exists
         - Returns: { input, parsedResult, error, isValidating, validate, clear }
         - validate() calls parseVlessShareLink inside try/catch
         - validate() sets parsedResult on success, error on exception
         - clear() resets all state
      4. Read updated `src/vless/ImportDialog.tsx` and verify:
         - Imports and uses useVlessValidation
         - TextField border is green when valid, red when error
         - Structured parsed data shown in Card/Stack layout
      5. Read updated `src/vless/BatchImportDialog.tsx` and verify:
         - Per-link validation status badges (green check / red X)
         - Error detail on hover/tooltip for invalid links
    Expected: All static verifications pass
    Evidence: .omo/evidence/task-5-validation-hook.md
  ```

  **Commit**: YES | Message: `feat(vless): add validation hook and enhance error UX` | Files: `src/vless/useVlessValidation.ts`, `src/vless/ImportDialog.tsx`, `src/vless/BatchImportDialog.tsx`, `src/i18n.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
| Task | Commit Message | Scope |
|------|---------------|-------|
| 1 | `feat(vless): add single VLESS link import dialog` | `src/vless/`, `src/App.tsx`, `src/i18n.ts` |
| 2 | `feat(vless): add VLESS link export with clipboard copy` | `src/App.tsx`, `src/i18n.ts` |
| 3 | `feat(vless): add batch VLESS import wizard` | `src/vless/`, `src/App.tsx`, `src/i18n.ts` |
| 4 | `feat(vless): add share link management panel` | `src/vless/`, `src/App.tsx`, `src/i18n.ts` |
| 5 | `feat(vless): add validation hook and enhance error UX` | `src/vless/`, `src/i18n.ts` |

## Success Criteria
- [x] All 5 tasks completed with passing `pnpm typecheck` and `pnpm build`
- [x] VLESS link import works: paste link → preview → confirm → config updated
- [x] VLESS link export works: one-click copy per outbound
- [x] Batch import works: multi-line → parse → mode select → apply
- [x] Management panel shows, filters, and deletes outbounds
- [x] All validation provides real-time feedback with i18n
- [x] No modifications to `vless-share.ts` core logic
- [x] All new components in `src/vless/` directory
