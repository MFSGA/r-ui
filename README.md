# JSON Schema + MUI 配置生成器 Demo

这是一个基于 **React + TypeScript + Vite + Material UI + react-jsonschema-form** 的示例项目。

它演示了这条典型链路：

1. 使用 `JSON Schema` 定义配置结构
2. 自动生成表单 UI
3. 用户填写表单
4. 实时拿到对应的 `JSON` 配置数据
5. 导出 JSON 配置文件

## 环境要求

- Node.js 20.19+ 或 22.12+
- npm 10+

## 运行方式

```bash
npm install
npm run dev
```

然后打开终端里提示的本地地址。

## 打包

```bash
npm run build
npm run preview
```

## 项目结构

```text
src/
  App.tsx        # 页面与表单逻辑
  main.tsx       # 应用入口，挂载 MUI ThemeProvider
  schema.ts      # JSON Schema、uiSchema 与 TS 类型
  theme.ts       # MUI 主题
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

### 3. 拿到 JSON 数据

在 `src/App.tsx` 中：

- `onChange` 可以拿到实时 `formData`
- `onSubmit` 可以拿到最终提交的 `formData`

## 说明

这个 demo 偏向“配置中心 / 后台设置页 / 动态配置表单”场景。
如果你后续还想做：

- 自定义复杂 widget
- 更强的布局控制
- 接口读写已有配置
- YAML 导出
- 配置版本管理

都可以在当前结构上继续扩展。
