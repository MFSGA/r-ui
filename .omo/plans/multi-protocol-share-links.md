# Series 🔗2: VMess / Trojan / Shadowsocks 分享链接导入导出

## TL;DR
> **Summary**: 在现有 VLESS 分享链接功能基础上，扩展支持 VMess、Trojan、Shadowsocks 三种协议的分享链接导入导出。复用 Series 1 的 UI 模式，新增协议解析/格式化核心逻辑。
> **Deliverables**: 3 个新协议核心工具 + 统一多协议 UI 组件 + App.tsx 集成 + i18n 词条
> **Effort**: Medium-High (6 tasks, 核心逻辑 + UI 集成)
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 (核心工具) → Task 4 (UI 组件) → Task 5 (App.tsx 集成)

## Context
### Original Request
> VMess / Trojan / Shadowsocks 导入导出

### Interview Summary
- 项目：JSON Schema + MUI 配置生成器（Xray 配置工具）
- 技术栈：React 19 + MUI 7.3 + rjsf 6.4 + Vite 8 + TypeScript 6
- Series 1 已完成 VLESS 分享链接功能（`src/utils/vless-share.ts` + `src/vless/` 组件）
- 需求：扩展支持 VMess、Trojan、Shadowsocks 三种协议的分享链接

### Key Architectural Decisions
1. **新建 `src/utils/vmess-share.ts`、`src/utils/trojan-share.ts`、`src/utils/shadowsocks-share.ts`** — 每个协议独立核心工具，遵循 vless-share.ts 模式
2. **新建 `src/utils/multi-protocol-share.ts`** — 统一接口，自动检测协议类型并分发到对应协议工具
3. **新建 `src/multi-protocol/` 目录** — 所有多协议 UI 组件集中管理
4. **复用 Series 1 UI 模式** — ImportDialog、BatchImportDialog、ShareLinkPanel 的多协议版本
5. **App.tsx 集成** — 在现有 VLESS 导出区域扩展，支持多协议检测和切换
6. **不修改 `src/utils/vless-share.ts`** — 保持 VLESS 核心逻辑稳定
7. **不修改 `src/vless/` 组件** — 保留 VLESS 专用组件，多协议组件独立

## Work Objectives
### Core Objective
将 VMess、Trojan、Shadowsocks 三种协议的分享链接导入导出功能集成到 UI 中，用户能在配置生成器界面直接导入/导出/管理多协议分享链接。

### Deliverables
| # | Deliverable | Description |
|---|------------|-------------|
| 1 | `src/utils/vmess-share.ts` | VMess 分享链接解析/格式化/Xray 互转 |
| 2 | `src/utils/trojan-share.ts` | Trojan 分享链接解析/格式化/Xray 互转 |
| 3 | `src/utils/shadowsocks-share.ts` | Shadowsocks 分享链接解析/格式化/Xray 互转 |
| 4 | `src/utils/multi-protocol-share.ts` | 统一接口，协议自动检测 |
| 5 | `src/multi-protocol/ImportDialog.tsx` | 多协议导入对话框（自动检测协议） |
| 6 | `src/multi-protocol/BatchImportDialog.tsx` | 多协议批量导入向导 |
| 7 | `src/multi-protocol/ShareLinkPanel.tsx` | 多协议管理面板 |
| 8 | App.tsx 多协议导出区域 | outbound 预览区支持多协议复制链接 |
| 9 | 全系列 i18n + 错误处理 | 统一的校验反馈和错误处理机制 |

### Definition of Done (verifiable conditions)
```
pnpm build            # 构建通过，无类型/编译错误
pnpm typecheck        # TypeScript 检查通过
```
- VMess 链接输入后实时解析并展示预览
- Trojan 链接输入后实时解析并展示预览
- Shadowsocks 链接输入后实时解析并展示预览
- 单条多协议链接可正常导入并合并到当前配置
- 批量导入支持多行输入 + 模式选择 + 协议自动检测
- 每个支持的协议 outbound 可一键复制分享链接
- 管理面板显示所有支持的协议 outbound，支持过滤、复制、删除

## Task Breakdown

### Wave 1: 核心协议工具（可并行 3 个任务）

#### Task 1: VMess 分享链接核心工具
**File**: `src/utils/vmess-share.ts`

**Protocol Specification**:
- VMess 链接格式：`vmess://` + Base64 编码的 JSON
- JSON 结构：
  ```json
  {
    "v": "2",
    "ps": "备注名称",
    "add": "服务器地址",
    "port": "端口",
    "id": "UUID",
    "aid": "额外 ID (alterId)",
    "scy": "加密方式 (auto/none/aes-128-gcm/chacha20-poly1305)",
    "net": "传输协议 (tcp/kcp/ws/http/grpc/httpupgrade/xhttp)",
    "type": "伪装类型 (none/http/srtp/utp/wechat_video/wireguard)",
    "host": "伪装域名",
    "path": "路径",
    "tls": "TLS 开关 (none/tls)",
    "sni": "SNI 域名",
    "alpn": "ALPN 列表",
    "fp": "指纹"
  }
  ```

**Required Functions**:
- `parseVmessShareLink(rawLink: string, options?: ParseOptions): VmessShare` — 解析 VMess 链接
- `formatVmessShareLink(share: VmessShare, options?: FormatOptions): string` — 格式化为链接
- `vmessShareToXrayOutbound(input: string | VmessShare, options?: ToXrayOptions): XrayOutbound` — 转为 Xray outbound
- `outboundToVmessShare(outbound: Dict, options?: { name?: string; strict?: boolean }): VmessShare` — 从 outbound 转为分享链接
- `importVmessShareToXrayConfig(config: Dict, link: string | VmessShare, options?: ImportOptions): Dict` — 导入到配置
- `exportVmessLinksFromXrayConfig(config: Dict, options?: ExportOptions): string[]` — 从配置导出链接

**Types**:
- `VmessShare` — 解析后的 VMess 分享对象
- `VmessShareParams` — VMess 参数（加密、传输、TLS 等）
- `VmessTransport` — 传输协议类型
- `VmessSecurity` — 安全类型

**Acceptance Criteria**:
- [ ] 能正确解析标准 VMess 链接（Base64 JSON 格式）
- [ ] 能正确格式化 VmessShare 对象为链接
- [ ] 能正确转换为 Xray outbound 配置
- [ ] 能从 Xray outbound 反向生成分享链接
- [ ] 支持所有传输协议（tcp/kcp/ws/http/grpc/httpupgrade/xhttp）
- [ ] 支持 TLS 和 SNI 配置
- [ ] 错误处理完善（非法 Base64、缺少字段、非法值等）
- [ ] `pnpm typecheck` 通过

**QA Scenarios**:
- 标准 VMess 链接解析
- 缺少必填字段的链接（应抛出明确错误）
- 非法 Base64 编码
- 不同传输协议的参数映射
- TLS/SNI 配置
- outbound 反向生成链接

**Commit**: YES | Message: `feat(vmess): add VMess share link core utility` | Files: `src/utils/vmess-share.ts`

---

#### Task 2: Trojan 分享链接核心工具
**File**: `src/utils/trojan-share.ts`

**Protocol Specification**:
- Trojan 链接格式：`trojan://password@host:port?param=value#remarks`
- 标准 URL 格式，参数在 query string 中
- 支持参数：
  - `sni` — SNI 域名
  - `alpn` — ALPN 列表（逗号分隔）
  - `type` — 传输协议（tcp/ws/grpc/httpupgrade/xhttp）
  - `host` — 伪装域名
  - `path` — 路径
  - `fp` — 指纹

**Required Functions**:
- `parseTrojanShareLink(rawLink: string, options?: ParseOptions): TrojanShare` — 解析 Trojan 链接
- `formatTrojanShareLink(share: TrojanShare, options?: FormatOptions): string` — 格式化为链接
- `trojanShareToXrayOutbound(input: string | TrojanShare, options?: ToXrayOptions): XrayOutbound` — 转为 Xray outbound
- `outboundToTrojanShare(outbound: Dict, options?: { name?: string; strict?: boolean }): TrojanShare` — 从 outbound 转为分享链接
- `importTrojanShareToXrayConfig(config: Dict, link: string | TrojanShare, options?: ImportOptions): Dict` — 导入到配置
- `exportTrojanLinksFromXrayConfig(config: Dict, options?: ExportOptions): string[]` — 从配置导出链接

**Types**:
- `TrojanShare` — 解析后的 Trojan 分享对象
- `TrojanShareParams` — Trojan 参数（传输、TLS、SNI 等）
- `TrojanTransport` — 传输协议类型

**Acceptance Criteria**:
- [ ] 能正确解析标准 Trojan 链接（URL 格式）
- [ ] 能正确格式化 TrojanShare 对象为链接
- [ ] 能正确转换为 Xray outbound 配置
- [ ] 能从 Xray outbound 反向生成分享链接
- [ ] 支持所有传输协议（tcp/ws/grpc/httpupgrade/xhttp）
- [ ] 支持 TLS 和 SNI 配置
- [ ] 错误处理完善（非法 URL、缺少密码、非法主机等）
- [ ] `pnpm typecheck` 通过

**QA Scenarios**:
- 标准 Trojan 链接解析
- 带 SNI/TLS 参数的链接
- 不同传输协议的参数映射
- 缺少密码的链接（应抛出错误）
- 非法主机名或端口
- outbound 反向生成链接

**Commit**: YES | Message: `feat(trojan): add Trojan share link core utility` | Files: `src/utils/trojan-share.ts`

---

#### Task 3: Shadowsocks 分享链接核心工具
**File**: `src/utils/shadowsocks-share.ts`

**Protocol Specification**:
- Shadowsocks 链接有多种格式：
  1. **Legacy 格式**：`ss://` + Base64 编码的 `method:password@host:port#remarks`
  2. **SIP002 格式**：`ss://` + Base64 编码的 `method:password` + `@host:port/?plugin=...#remarks`
  3. **URL-safe Base64**：部分客户端使用 URL-safe Base64 编码

- 支持的加密方法：
  - `aes-256-gcm`
  - `aes-128-gcm`
  - `chacha20-ietf-poly1305`
  - `xchacha20-ietf-poly1305`
  - `none`（仅用于兼容）

**Required Functions**:
- `parseShadowsocksShareLink(rawLink: string, options?: ParseOptions): ShadowsocksShare` — 解析 SS 链接
- `formatShadowsocksShareLink(share: ShadowsocksShare, options?: FormatOptions): string` — 格式化为链接
- `shadowsocksShareToXrayOutbound(input: string | ShadowsocksShare, options?: ToXrayOptions): XrayOutbound` — 转为 Xray outbound
- `outboundToShadowsocksShare(outbound: Dict, options?: { name?: string; strict?: boolean }): ShadowsocksShare` — 从 outbound 转为分享链接
- `importShadowsocksShareToXrayConfig(config: Dict, link: string | ShadowsocksShare, options?: ImportOptions): Dict` — 导入到配置
- `exportShadowsocksLinksFromXrayConfig(config: Dict, options?: ExportOptions): string[]` — 从配置导出链接

**Types**:
- `ShadowsocksShare` — 解析后的 SS 分享对象
- `ShadowsocksShareParams` — SS 参数（加密方法、插件等）
- `ShadowsocksMethod` — 支持的加密方法

**Acceptance Criteria**:
- [ ] 能正确解析 Legacy 格式 SS 链接
- [ ] 能正确解析 SIP002 格式 SS 链接
- [ ] 能正确格式化 ShadowsocksShare 对象为链接（默认 SIP002）
- [ ] 能正确转换为 Xray outbound 配置
- [ ] 能从 Xray outbound 反向生成分享链接
- [ ] 支持所有常见加密方法
- [ ] 支持插件参数（simple-obfs、v2ray-plugin 等）
- [ ] 错误处理完善（非法 Base64、缺少方法/密码、不支持的加密等）
- [ ] `pnpm typecheck` 通过

**QA Scenarios**:
- Legacy 格式 SS 链接解析
- SIP002 格式 SS 链接解析
- URL-safe Base64 编码
- 不同加密方法的参数映射
- 插件参数解析
- 缺少方法或密码的链接（应抛出错误）
- 不支持的加密方法（应抛出错误）
- outbound 反向生成链接

**Commit**: YES | Message: `feat(shadowsocks): add Shadowsocks share link core utility` | Files: `src/utils/shadowsocks-share.ts`

---

### Wave 2: 统一接口 + 验证 Hook（可并行 2 个任务）

#### Task 4: 多协议统一接口
**File**: `src/utils/multi-protocol-share.ts`

**Purpose**: 提供统一的协议检测和分发接口，UI 组件只需调用此文件。

**Required Functions**:
- `detectProtocol(link: string): 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'unknown'` — 自动检测协议类型
- `parseMultiProtocolShareLink(link: string, options?: ParseOptions): MultiProtocolShare` — 统一解析接口
- `formatMultiProtocolShareLink(share: MultiProtocolShare, options?: FormatOptions): string` — 统一格式化接口
- `multiProtocolShareToXrayOutbound(share: MultiProtocolShare, options?: ToXrayOptions): XrayOutbound` — 统一转 outbound
- `outboundToMultiProtocolShare(outbound: Dict, options?: { name?: string; strict?: boolean }): MultiProtocolShare` — 统一从 outbound 转分享链接
- `importMultiProtocolShareToXrayConfig(config: Dict, link: string, options?: ImportOptions): Dict` — 统一导入
- `exportMultiProtocolLinksFromXrayConfig(config: Dict, options?: ExportOptions): MultiProtocolLink[]` — 统一导出

**Types**:
- `MultiProtocolShare` — 联合类型，包含所有协议的分享对象
- `MultiProtocolLink` — 包含协议类型和分享链接的对象
- `ProtocolType` — 协议类型枚举

**Acceptance Criteria**:
- [ ] 能正确检测所有支持的协议（vless/vmess/trojan/shadowsocks）
- [ ] 能正确分发到对应协议的解析/格式化函数
- [ ] 统一接口返回类型正确，UI 组件可直接使用
- [ ] 错误处理完善（未知协议、解析失败等）
- [ ] `pnpm typecheck` 通过

**Commit**: YES | Message: `feat(multi-protocol): add unified multi-protocol share link interface` | Files: `src/utils/multi-protocol-share.ts`

---

#### Task 5: 多协议验证 Hook
**File**: `src/multi-protocol/useMultiProtocolValidation.ts`

**Purpose**: 共享的验证 Hook，供 ImportDialog 和 BatchImportDialog 使用。

**Required Interface**:
```typescript
interface MultiProtocolValidationResult {
  input: string;
  detectedProtocol: ProtocolType;
  parsedShare: MultiProtocolShare | null;
  error: string | null;
  isValidating: boolean;
  validate: (input: string) => void;
  clear: () => void;
}

export function useMultiProtocolValidation(): MultiProtocolValidationResult;
```

**Acceptance Criteria**:
- [ ] 输入后自动检测协议并解析
- [ ] 解析成功返回 parsedShare，失败返回 error
- [ ] 支持 clear 重置状态
- [ ] `pnpm typecheck` 通过

**Commit**: YES | Message: `feat(multi-protocol): add shared validation hook` | Files: `src/multi-protocol/useMultiProtocolValidation.ts`

---

### Wave 3: UI 组件 + App.tsx 集成（可并行 3 个任务）

#### Task 6: 多协议导入对话框
**File**: `src/multi-protocol/ImportDialog.tsx`

**Purpose**: 单一多协议链接导入对话框，自动检测协议并显示解析预览。

**Props**:
```typescript
interface MultiProtocolImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: XrayConfig;
  onConfigUpdate: (updatedConfig: XrayConfig) => void;
  onError: (error: string | null) => void;
}
```

**Features**:
- [ ] TextField 输入分享链接
- [ ] 实时协议检测（输入时显示协议类型图标）
- [ ] 解析成功后显示预览卡片（根据协议类型显示不同字段）
- [ ] 解析失败显示错误提示（红色边框 + 错误信息）
- [ ] 确认导入按钮（仅在解析成功时启用）
- [ ] 支持 Enter 键确认
- [ ] 调用 `importMultiProtocolShareToXrayConfig` 导入
- [ ] 使用 `useMultiProtocolValidation` Hook

**Acceptance Criteria**:
- [ ] 对话框打开时自动聚焦输入框
- [ ] 输入合法链接后实时显示协议类型和解析预览
- [ ] 输入非法链接时显示明确错误信息
- [ ] 确认导入后配置正确更新
- [ ] `pnpm typecheck` 和 `pnpm build` 通过

**QA Scenarios**:
- 输入 VLESS 链接 → 显示 VLESS 预览
- 输入 VMess 链接 → 显示 VMess 预览
- 输入 Trojan 链接 → 显示 Trojan 预览
- 输入 Shadowsocks 链接 → 显示 Shadowsocks 预览
- 输入非法链接 → 显示错误
- 空输入 → 确认按钮禁用
- Enter 键确认 → 导入成功

**Commit**: YES | Message: `feat(multi-protocol): add multi-protocol import dialog` | Files: `src/multi-protocol/ImportDialog.tsx`, `src/i18n.ts`

---

#### Task 7: 多协议批量导入向导
**File**: `src/multi-protocol/BatchImportDialog.tsx`

**Purpose**: 批量多协议链接导入向导，支持多行输入、协议自动检测、模式选择。

**Props**:
```typescript
interface MultiProtocolBatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: XrayConfig;
  onConfigUpdate: (updatedConfig: XrayConfig) => void;
  onError: (error: string | null) => void;
}
```

**Features**:
- [ ] 多行 TextField 输入（minRows=6）
- [ ] "解析并预览"按钮（逐行解析，显示协议类型和状态）
- [ ] 每行显示协议图标 + 状态徽章（✓ 成功 / ✗ 失败）
- [ ] 失败行显示错误信息
- [ ] 导入模式选择（Append / Replace by tag / Replace first matching）
- [ ] 汇总显示（X 条成功, Y 条失败）
- [ ] "确认导入"按钮（仅在至少 1 条成功时启用）
- [ ] 调用 `importMultiProtocolShareToXrayConfig` 批量导入

**Acceptance Criteria**:
- [ ] 多行输入后点击解析，逐行显示结果
- [ ] 每行正确检测协议类型
- [ ] 成功/失败状态清晰显示
- [ ] 导入模式选择正常工作
- [ ] 确认导入后配置正确更新
- [ ] `pnpm typecheck` 和 `pnpm build` 通过

**QA Scenarios**:
- 输入混合协议链接 → 逐行解析，显示不同协议图标
- 输入包含非法链接 → 失败行显示错误
- 选择不同导入模式 → 导入结果正确
- 全部失败 → 确认按钮禁用
- 部分成功 → 仅导入成功行

**Commit**: YES | Message: `feat(multi-protocol): add multi-protocol batch import wizard` | Files: `src/multi-protocol/BatchImportDialog.tsx`, `src/i18n.ts`

---

#### Task 8: 多协议管理面板
**File**: `src/multi-protocol/ShareLinkPanel.tsx`

**Purpose**: 多协议分享链接管理面板，显示所有支持的协议 outbound，支持过滤、复制、删除。

**Props**:
```typescript
interface MultiProtocolShareLinkPanelProps {
  open: boolean;
  onClose: () => void;
  config: XrayConfig;
  onCopyLink: (link: string) => Promise<void>;
  onDeleteOutbound: (index: number) => void;
}
```

**Features**:
- [ ] 表格显示所有支持的协议 outbound（VLESS/VMess/Trojan/Shadowsocks）
- [ ] 列：协议图标、Tag、地址、端口、传输协议、安全类型、分享链接、操作
- [ ] 协议过滤器（全部 / VLESS / VMess / Trojan / Shadowsocks）
- [ ] 搜索框（按 Tag 或地址过滤）
- [ ] 每行复制按钮（复制分享链接）
- [ ] 每行删除按钮（带确认提示）
- [ ] "复制所有"按钮
- [ ] 空状态提示

**Acceptance Criteria**:
- [ ] 面板打开时显示所有支持的协议 outbound
- [ ] 协议过滤器正常工作
- [ ] 搜索框过滤正确
- [ ] 复制按钮成功复制分享链接
- [ ] 删除按钮带确认提示
- [ ] 空状态显示正确
- [ ] `pnpm typecheck` 和 `pnpm build` 通过

**QA Scenarios**:
- 面板显示所有协议 outbound
- 按协议过滤 → 仅显示对应协议
- 搜索 Tag → 过滤正确
- 复制链接 → 剪贴板内容正确
- 删除 outbound → 确认后删除
- 无支持的协议 → 显示空状态

**Commit**: YES | Message: `feat(multi-protocol): add multi-protocol share link management panel` | Files: `src/multi-protocol/ShareLinkPanel.tsx`, `src/i18n.ts`

---

#### Task 9: App.tsx 多协议集成
**File**: `src/App.tsx`

**Changes**:
- [ ] 添加多协议导入/导出相关 imports
- [ ] 添加多协议状态变量（`multiProtocolImportOpen`, `multiProtocolBatchImportOpen`, `multiProtocolPanelOpen`）
- [ ] 添加多协议 handlers（open/close/confirm/copy/delete）
- [ ] 在现有 VLESS 导出区域扩展，添加多协议按钮
- [ ] 修改 outbound 列表显示，支持多协议复制链接
- [ ] 放置多协议 Dialog 组件

**Acceptance Criteria**:
- [ ] 多协议按钮仅在 `selectedField === 'outbounds'` 时显示
- [ ] 多协议导入对话框正常工作
- [ ] 多协议批量导入对话框正常工作
- [ ] 多协议管理面板正常工作
- [ ] 每个支持的协议 outbound 可一键复制分享链接
- [ ] 不支持的协议 outbound 显示"不支持分享链接"
- [ ] `pnpm typecheck` 和 `pnpm build` 通过

**Commit**: YES | Message: `feat(multi-protocol): integrate multi-protocol share links into App.tsx` | Files: `src/App.tsx`, `src/i18n.ts`

---

### Wave 4: 全系列 i18n + 错误处理增强

#### Task 10: 全系列 i18n 词条
**File**: `src/i18n.ts`

**Required Keys**:
```typescript
// Multi-protocol common
'app.multiProtocol.importTitle': '导入分享链接'
'app.multiProtocol.importHint': '支持 VLESS、VMess、Trojan、Shadowsocks 分享链接'
'app.multiProtocol.importLabel': '分享链接'
'app.multiProtocol.importPlaceholder': 'vless://... 或 vmess://... 或 trojan://... 或 ss://...'
'app.multiProtocol.importConfirm': '确认导入'
'app.multiProtocol.importCancel': '取消'
'app.multiProtocol.parseSuccess': '解析成功'
'app.multiProtocol.parseFailed': '解析失败'
'app.multiProtocol.detectedProtocol': '检测到协议：%s'
'app.multiProtocol.unknownProtocol': '未知协议'

// VMess specific
'app.multiProtocol.vmess.previewScy': '加密方式'
'app.multiProtocol.vmess.previewAid': '额外 ID'

// Trojan specific
'app.multiProtocol.trojan.previewPassword': '密码'

// Shadowsocks specific
'app.multiProtocol.ss.previewMethod': '加密方法'
'app.multiProtocol.ss.previewPlugin': '插件'

// Batch import
'app.multiProtocol.batchTitle': '批量导入'
'app.multiProtocol.batchHint': '每行一个分享链接，支持混合协议'
'app.multiProtocol.batchLabel': '分享链接列表'
'app.multiProtocol.batchPlaceholder': 'vless://...\nvmess://...\ntrojan://...\nss://...'
'app.multiProtocol.batchParse': '解析并预览'
'app.multiProtocol.batchParsing': '正在解析...'
'app.multiProtocol.batchConfirm': '确认导入'
'app.multiProtocol.batchImporting': '正在导入...'
'app.multiProtocol.batchCancel': '取消'
'app.multiProtocol.batchResult': '解析结果'
'app.multiProtocol.batchPreview': '预览'
'app.multiProtocol.batchValidCount': '%d 条成功'
'app.multiProtocol.batchInvalidCount': '%d 条失败'

// Management panel
'app.multiProtocol.panelTitle': '分享链接管理'
'app.multiProtocol.panelEmpty': '暂无支持的分享链接配置'
'app.multiProtocol.panelFilter': '协议过滤'
'app.multiProtocol.panelFilterAll': '全部'
'app.multiProtocol.panelTag': 'Tag'
'app.multiProtocol.panelProtocol': '协议'
'app.multiProtocol.panelAddress': '地址'
'app.multiProtocol.panelPort': '端口'
'app.multiProtocol.panelNetwork': '传输协议'
'app.multiProtocol.panelSecurity': '安全类型'
'app.multiProtocol.panelLink': '分享链接'
'app.multiProtocol.panelActions': '操作'
'app.multiProtocol.panelCopyAll': '复制所有'
'app.multiProtocol.panelDelete': '删除'
'app.multiProtocol.panelDeleteConfirm': '确认删除 outbound %s？此操作不可撤销。'
'app.multiProtocol.panelSearch': '搜索 Tag 或地址'
'app.multiProtocol.panelNoResults': '未找到匹配的 outbound'

// Export section
'app.multiProtocol.exportSection': '分享链接导出'
'app.multiProtocol.copyLink': '复制链接'
'app.multiProtocol.copied': '已复制 ✓'
'app.multiProtocol.notShareable': '不支持分享链接'
'app.multiProtocol.outboundTag': 'Outbound Tag'
'app.multiProtocol.clipboardManualCopy': '手动复制'

// Validation errors
'app.multiProtocol.validationError': '验证错误：%s'
'app.multiProtocol.parsingProgress': '正在解析 %1/%2...'
'app.multiProtocol.copyFailed': '复制失败'
```

**Acceptance Criteria**:
- [ ] 所有 i18n 键在 `zh-CN` 和 `en-US` 中都有对应翻译
- [ ] 翻译文本准确、专业
- [ ] `pnpm typecheck` 通过

**Commit**: YES | Message: `feat(multi-protocol): add full i18n support for multi-protocol share links` | Files: `src/i18n.ts`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE.
- [x] F1. Plan Compliance Audit — oracle ✅ APPROVE
- [x] F2. Code Quality Review — unspecified-high ✅ APPROVE
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI) ✅ APPROVE
- [x] F4. Scope Fidelity Check — deep ✅ APPROVE

## Commit Strategy
| Task | Commit Message | Scope |
|------|---------------|-------|
| 1 | `feat(vmess): add VMess share link core utility` | `src/utils/vmess-share.ts` |
| 2 | `feat(trojan): add Trojan share link core utility` | `src/utils/trojan-share.ts` |
| 3 | `feat(shadowsocks): add Shadowsocks share link core utility` | `src/utils/shadowsocks-share.ts` |
| 4 | `feat(multi-protocol): add unified multi-protocol share link interface` | `src/utils/multi-protocol-share.ts` |
| 5 | `feat(multi-protocol): add shared validation hook` | `src/multi-protocol/useMultiProtocolValidation.ts` |
| 6 | `feat(multi-protocol): add multi-protocol import dialog` | `src/multi-protocol/ImportDialog.tsx`, `src/i18n.ts` |
| 7 | `feat(multi-protocol): add multi-protocol batch import wizard` | `src/multi-protocol/BatchImportDialog.tsx`, `src/i18n.ts` |
| 8 | `feat(multi-protocol): add multi-protocol share link management panel` | `src/multi-protocol/ShareLinkPanel.tsx`, `src/i18n.ts` |
| 9 | `feat(multi-protocol): integrate multi-protocol share links into App.tsx` | `src/App.tsx`, `src/i18n.ts` |
| 10 | `feat(multi-protocol): add full i18n support` | `src/i18n.ts` |

## Success Criteria
- [ ] All 10 tasks completed with passing `pnpm typecheck` and `pnpm build`
- [ ] VMess link import works: paste link → preview → confirm → config updated
- [ ] Trojan link import works: paste link → preview → confirm → config updated
- [ ] Shadowsocks link import works: paste link → preview → confirm → config updated
- [ ] VLESS link import still works (no regression)
- [ ] Multi-protocol batch import works: multi-line → parse → mode select → apply
- [ ] Management panel shows, filters, and deletes outbounds for all protocols
- [ ] All validation provides real-time feedback with i18n
- [ ] No modifications to `vless-share.ts` core logic
- [ ] All new components in `src/multi-protocol/` directory
- [ ] All new utilities in `src/utils/` directory
