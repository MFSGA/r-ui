# Draft: Protocol Expansion V3 — Hysteria2 / REALITY / XHTTP

## User Request
继续完善项目，优先支持 Hysteria2、REALITY、XHTTP 各种模式。

## Initial Analysis

### 1. Hysteria2 — 全新协议
- **性质**: 独立的新协议，类似 VMess/Trojan/Shadowsocks
- **工作量**: 新工具文件 + 多协议调度更新 + UI 更新 + i18n + xray-core 测试
- **Share Link 格式**: `hysteria2://password@host:port?params#remarks`
- **Xray 支持**: Xray 1.8+ 已内置 hysteria2 inbound/outbound
- **当前状态**: 代码库中尚无任何 hysteria2 支持

### 2. REALITY — 传输安全层
- **性质**: 替代 TLS 的安全层 (streamSettings.security: "reality")
- **工作量**: 修改现有 vless-share.ts / trojan-share.ts，增加 REALITY 参数解析
- **Share Link 格式**: `vless://...?security=reality&fp=...&pbk=...&sid=...`
- **复杂因素**: 需要区分 REALITY 和 TLS，不能破坏现有功能
- **当前状态**: VLESS 和 Trojan 已支持 TLS，但未支持 REALITY

### 3. XHTTP — 新型传输协议
- **性质**: 传输层替换 WebSocket/gRPC (streamSettings.network: "xhttp")
- **工作量**: 修改相关协议工具，在 parse/format/toXray 中增加 xhttp 处理
- **当前状态**: Series 2 已为 VMess 实现了 xhttp 传输，但 VLESS/Trojan 尚未支持

## Open Questions (等待调研结果后确认)
- [ ] Hysteria2 share link 完整格式规范
- [ ] REALITY 参数在 VLESS/Trojan share link 中的位置
- [ ] XHTTP 不同模式 (h2/h3) 如何表示
- [ ] 三个功能的范围/优先级细化
- [ ] xray-core 测试配置方案
