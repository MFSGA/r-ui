## 2026-06-06 F2 Code Quality Review - 3 MAJOR Bugs Found & Fixed

### Bug 1: FinalMask (`fm`) silently dropped in xray conversion
- **Status**: FIXED
- **Fix**: Added `if (p.fm !== undefined) { streamSettings.finalmask = parseJsonMaybe(p.fm); }` in `hy2ShareToXrayOutbound` (after obfs block)
- **Fix**: Added `params.fm = stringifyMaybe(streamSettings.finalmask);` in `outboundToHy2Share` (after obfs reading)
- **Pattern**: Follows vless-share.ts:583-585 and vmess-share.ts:548

### Bug 2: `obfs: "gecko"` silently dropped in `hy2ShareToXrayOutbound`
- **Status**: FIXED
- **Fix**: Changed `if (p.obfs === "salamander")` to `if (p.obfs === "salamander" || p.obfs === "gecko")`
- **Fix**: Changed hardcoded `type: "salamander"` to `type: p.obfs` for dynamic udpmasks type

### Bug 3: `useTls` defaults to `false` — hysteria2 always runs over QUIC/TLS
- **Status**: FIXED
- **Fix**: Changed `const useTls = Boolean(p.sni || p.insecure || p.pinSHA256)` to `const useTls = true`
- **Fix**: Moved `tlsSettings.alpn = ["h3"]` outside the `if (p.sni)` branch so it's always set
