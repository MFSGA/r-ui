# Protocol Expansion V3: Hysteria2 + REALITY + XHTTP

## Goal
Add Hysteria2 protocol support to the multi-protocol share link system, and complete REALITY/XHTTP test coverage.

## Background
- REALITY: Already fully implemented in VLESS share code (`vless-share.ts`). Needs xray-core test config.
- XHTTP: Already fully implemented in VMess, Trojan, and VLESS share code. Needs trojan-xhttp and vless-xhttp test configs.
- Hysteria2: New protocol - needs full implementation from scratch.

## TODOs

### P1: Test Configs for Existing Features
- [x] Add vless-reality xray-core test config (17-vless-reality.json)
- [x] Add trojan-xhttp xray-core test config (18-trojan-xhttp.json)
- [x] Add vless-xhttp xray-core test config (19-vless-xhttp.json)
- [x] Verify all test configs with xray-core

### P2: Hysteria2 Implementation
- [x] Create `src/utils/hysteria2-share.ts` — parse/format/toXray/outboundTo
- [x] Update `src/utils/multi-protocol-share.ts` — add hysteria2 to dispatch
- [x] Update `src/multi-protocol/ImportDialog.tsx` — hysteria2 preview fields
- [x] Update `src/multi-protocol/ShareLinkPanel.tsx` — add hysteria2 protocol support
- [x] Update `src/App.tsx` — add hysteria2 to shareable protocols
- [x] Update `src/i18n.ts` — add hysteria2 translation keys
- [x] Add hysteria2 xray-core test config (20-hysteria2.json)
- [x] Run all tests — typecheck + build + xray-core verification

### P3: Final Verification Wave
- [x] F1: Oracle reviews goal/constraint alignment
- [x] F2: Oracle reviews code quality
- [x] F3: Hands-on QA execution
- [x] F4: Context mining & review

## Files Modified
- `src/utils/hysteria2-share.ts` (NEW)
- `src/utils/multi-protocol-share.ts` (modify)
- `src/multi-protocol/ImportDialog.tsx` (modify)
- `src/multi-protocol/ShareLinkPanel.tsx` (modify)
- `src/App.tsx` (modify)
- `src/i18n.ts` (modify)
- `tests/xray-protocols/17-vless-reality.json` (NEW)
- `tests/xray-protocols/18-trojan-xhttp.json` (NEW)
- `tests/xray-protocols/19-vless-xhttp.json` (NEW)
- `tests/xray-protocols/20-hysteria2.json` (NEW)

## Notepad
- `.omo/notepads/protocol-expansion-v3/learnings.md`
- `.omo/notepads/protocol-expansion-v3/issues.md`
- `.omo/notepads/protocol-expansion-v3/decisions.md`

## Dependencies
- P2 depends on P1 (need to understand xray-core test pattern)
- P3 depends on P2
