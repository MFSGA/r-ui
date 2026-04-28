# JSON Schema + MUI 配置生成器 Demo

这是一个基于 **React + TypeScript + Vite + Material UI + react-jsonschema-form** 的配置表单示例项目。

它演示了这条典型链路：

1. 使用 `JSON Schema` 定义配置结构
2. 自动生成表单 UI
3. 用户填写表单
4. 实时拿到对应的配置数据
5. 导出 JSON / YAML / TOML / JSON5 配置
6. 下发给服务端

## 环境要求

- Node.js 20.19+ 或 22.12+
- pnpm 10.13+

## 运行方式

```bash
pnpm install
pnpm dev
```

然后打开终端里提示的本地地址。

## 环境变量

复制 `.env.example` 后按需修改：

```bash
VITE_API_TARGET=http://localhost:8080
VITE_DEV_PORT=5173
```

`VITE_API_TARGET` 用于配置本地开发时 `/api` 代理到的后端地址。
`VITE_DEV_PORT` 用于配置 Vite 开发服务器端口。

## 常用脚本

```bash
pnpm typecheck
pnpm build
pnpm preview
```

## 项目结构

```text
src/
  App.tsx                         # 页面与表单主逻辑
  configFormat.ts                 # 配置格式导入/导出
  main.tsx                        # 应用入口
  schema.ts                       # JSON Schema、uiSchema 与 TS 类型
  theme.ts                        # MUI 主题
  utils/                          # 通用工具函数
```

## 你可以重点修改的地方

### 1. 修改 schema

在 `src/schema.ts` 里新增字段、调整校验规则、修改默认值：

- `type`
- `required`
- `enum`
- `minimum / maximum`
- `default`
- `items`

### 2. 修改 uiSchema

在 `src/schema.ts` 里通过 `uiSchema` 控制 UI 细节：

- 指定 widget
- 设置 placeholder
- 隐藏默认 submit
- 调整局部展示方式

### 3. 调整配置格式

在 `src/configFormat.ts` 里维护配置的导入、导出和服务端下发格式。

## 工程约定

- Vite 配置只维护 `vite.config.ts`，不要提交由 TypeScript 生成的 `vite.config.js` / `vite.config.d.ts`。
- 构建缓存、临时日志、`dist/` 和 `node_modules/` 不进入版本管理。
- 提交前至少运行 `pnpm typecheck`；涉及打包链路时运行 `pnpm build`。
