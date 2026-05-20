/* vless-share.ts */

type Dict<T = unknown> = Record<string, T>;

export type VlessTransport =
    | "tcp"
    | "kcp"
    | "ws"
    | "http"
    | "grpc"
    | "httpupgrade"
    | "xhttp";

export type VlessSecurity = "none" | "tls" | "reality";

export interface VlessShareParams {
    type: VlessTransport;
    encryption: string;
    security: VlessSecurity;

    flow?: string;

    // TLS / REALITY common query fields
    sni?: string;
    fp?: string;
    alpn?: string[];
    ech?: string;
    pcs?: string;
    vcn?: string;

    // REALITY
    pbk?: string;
    sid?: string;
    pqv?: string;
    spx?: string;

    // WS / HTTPUpgrade / XHTTP
    path?: string;
    host?: string;

    // gRPC / XHTTP
    serviceName?: string;
    mode?: string;
    authority?: string;

    // mKCP / legacy compatibility
    mtu?: number;
    tti?: number;
    seed?: string;
    headerType?: string;

    // XHTTP / FinalMask
    extra?: string;
    fm?: string;
}

export interface VlessShare {
    id: string;
    address: string;
    port: number;
    name?: string;
    params: VlessShareParams;
    extraParams?: Record<string, string>;
}

export interface XrayOutbound {
    protocol: "vless";
    tag?: string;
    settings: Dict;
    streamSettings?: Dict;
    [key: string]: unknown;
}

export interface ParseOptions {
    strict?: boolean;
}

export interface FormatOptions {
    strict?: boolean;
    omitDefaults?: boolean;
}

export interface ToXrayOptions {
    tag?: string;
    strict?: boolean;

    /**
     * Xray 新文档中 TCP 已更名为 RAW；为兼容旧配置，可设为 false 输出 network: "tcp"。
     */
    preferRawNetwork?: boolean;

    /**
     * 当前 Xray 文档把 REALITY pbk 映射为 realitySettings.password；
     * 一些旧生态配置常用 publicKey。默认写 password。
     */
    realityPasswordField?: "password" | "publicKey";
}

export interface ImportOptions extends ToXrayOptions {
    mode?: "append" | "replaceByTag" | "replaceFirstVless";
}

export interface ExportOptions extends FormatOptions {
    tag?: string | string[];
    useTagAsName?: boolean;
}

const TRANSPORTS = new Set([
    "tcp",
    "kcp",
    "ws",
    "http",
    "grpc",
    "httpupgrade",
    "xhttp",
]);

const SECURITIES = new Set(["none", "tls", "reality"]);

const KNOWN_QUERY_KEYS = new Set([
    "type",
    "encryption",
    "security",
    "flow",
    "sni",
    "fp",
    "alpn",
    "ech",
    "pcs",
    "vcn",
    "pbk",
    "sid",
    "pqv",
    "spx",
    "path",
    "host",
    "serviceName",
    "mode",
    "authority",
    "mtu",
    "tti",
    "seed",
    "headerType",
    "extra",
    "fm",
]);

export function parseVlessShareLink(
    rawLink: string,
    options: ParseOptions = {},
): VlessShare {
    const strict = options.strict ?? true;

    let url: URL;
    try {
        url = new URL(rawLink);
    } catch {
        throw new Error("不是合法 URL");
    }

    if (url.protocol !== "vless:") {
        throw new Error(`协议必须是 vless，实际为 ${url.protocol}`);
    }

    const id = decodeUriPart(url.username);
    const address = stripIpv6Brackets(url.hostname);
    const port = Number(url.port);
    const name = url.hash ? decodeUriPart(url.hash.slice(1)) : undefined;

    assertNonEmpty(id, "uuid/id");
    assertNonEmpty(address, "remote-host");
    assertValidPort(port);

    const rawParams = parseRawQuery(url.search.startsWith("?") ? url.search.slice(1) : "");

    const type = (rawParams.type ?? "tcp") as VlessTransport;
    const encryption = rawParams.encryption ?? "none";
    const security = (rawParams.security ?? "none") as VlessSecurity;

    const params: VlessShareParams = {
        type,
        encryption,
        security,
    };

    assignString(params, "flow", rawParams.flow, true);
    assignString(params, "sni", rawParams.sni);
    assignString(params, "fp", rawParams.fp);
    assignString(params, "ech", rawParams.ech, true);
    assignString(params, "pcs", rawParams.pcs, true);
    assignString(params, "vcn", rawParams.vcn, true);

    if (rawParams.alpn !== undefined) {
        if (rawParams.alpn === "") throw new Error("alpn 不可为空字符串");
        params.alpn = rawParams.alpn.split(",");
    }

    assignString(params, "pbk", rawParams.pbk);
    assignString(params, "sid", rawParams.sid, true);
    assignString(params, "pqv", rawParams.pqv, true);
    assignString(params, "spx", rawParams.spx, true);

    assignString(params, "path", rawParams.path);
    assignString(params, "host", rawParams.host, true);
    assignString(params, "serviceName", rawParams.serviceName);
    assignString(params, "mode", rawParams.mode);
    assignString(params, "authority", rawParams.authority, true);

    assignNumber(params, "mtu", rawParams.mtu);
    assignNumber(params, "tti", rawParams.tti);
    assignString(params, "seed", rawParams.seed);
    assignString(params, "headerType", rawParams.headerType);

    assignString(params, "extra", rawParams.extra, true);
    assignString(params, "fm", rawParams.fm, true);

    const extraParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawParams)) {
        if (!KNOWN_QUERY_KEYS.has(key)) extraParams[key] = value;
    }

    const share: VlessShare = { id, address, port, name, params, extraParams };
    validateShare(share, strict);

    return share;
}

export function formatVlessShareLink(
    share: VlessShare,
    options: FormatOptions = {},
): string {
    const strict = options.strict ?? true;
    const omitDefaults = options.omitDefaults ?? false;

    validateShare(share, strict);

    const p = share.params;
    const pairs: Array<[string, string]> = [];

    const add = (key: string, value: unknown, defaultValue?: string) => {
        if (value === undefined || value === null) return;

        const stringValue = Array.isArray(value) ? value.join(",") : String(value);

        if (omitDefaults && defaultValue !== undefined && stringValue === defaultValue) {
            return;
        }

        pairs.push([key, stringValue]);
    };

    add("type", p.type, "tcp");
    add("encryption", p.encryption, "none");
    add("security", p.security, "none");
    add("flow", p.flow);

    add("path", p.path);
    add("host", p.host);
    add("serviceName", p.serviceName);
    add("mode", p.mode);
    add("authority", p.authority);

    add("sni", p.sni);
    add("fp", p.fp, p.security === "tls" ? "chrome" : undefined);
    add("alpn", p.alpn);
    add("ech", p.ech);
    add("pcs", p.pcs);
    add("vcn", p.vcn);

    add("pbk", p.pbk);
    add("sid", p.sid);
    add("pqv", p.pqv);
    add("spx", p.spx);

    add("mtu", p.mtu);
    add("tti", p.tti);
    add("seed", p.seed);
    add("headerType", p.headerType);

    add("extra", p.extra);
    add("fm", p.fm);

    for (const [key, value] of Object.entries(share.extraParams ?? {})) {
        if (!KNOWN_QUERY_KEYS.has(key)) add(key, value);
    }

    const query = pairs
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    const host = formatHostForUri(share.address);
    const fragment = share.name ? `#${encodeURIComponent(share.name)}` : "";

    return `vless://${encodeURIComponent(share.id)}@${host}:${share.port}${query ? `?${query}` : ""
        }${fragment}`;
}

export function vlessShareToXrayOutbound(
    input: string | VlessShare,
    options: ToXrayOptions = {},
): XrayOutbound {
    const strict = options.strict ?? true;
    const share = typeof input === "string" ? parseVlessShareLink(input, { strict }) : input;

    validateShare(share, strict);

    const p = share.params;
    const user: Dict = {
        id: share.id,
        encryption: p.encryption ?? "none",
    };

    if (p.flow !== undefined) user.flow = p.flow;

    const streamSettings: Dict = {
        network: shareTypeToXrayNetwork(p.type, options.preferRawNetwork ?? true),
        security: p.security ?? "none",
    };

    applyTransportToStreamSettings(p, streamSettings);
    applySecurityToStreamSettings(p, streamSettings, options);

    const outbound: XrayOutbound = {
        protocol: "vless",
        settings: {
            vnext: [
                {
                    address: share.address,
                    port: share.port,
                    users: [user],
                },
            ],
        },
        streamSettings,
    };

    const tag = options.tag ?? share.name;
    if (tag) outbound.tag = tag;

    return outbound;
}

export function outboundToVlessShare(
    outbound: Dict,
    options: { name?: string; strict?: boolean } = {},
): VlessShare {
    if (outbound.protocol !== "vless") {
        throw new Error("outbound.protocol 必须是 vless");
    }

    const endpoint = readVlessEndpoint(outbound);
    const stream = asDict(outbound.streamSettings);
    const security = ((stream.security as string | undefined) ?? "none") as VlessSecurity;
    const type = xrayNetworkToShareType((stream.network as string | undefined) ?? "tcp");

    const params: VlessShareParams = {
        type,
        encryption: endpoint.encryption ?? "none",
        security,
    };

    if (endpoint.flow !== undefined) params.flow = endpoint.flow;

    readTransportFromStreamSettings(type, params, stream);
    readSecurityFromStreamSettings(security, params, stream);

    const share: VlessShare = {
        id: endpoint.id,
        address: endpoint.address,
        port: endpoint.port,
        name: options.name ?? stringOrUndefined(outbound.tag),
        params,
    };

    validateShare(share, options.strict ?? true);
    return share;
}

export function importVlessShareToXrayConfig(
    config: Dict,
    link: string | VlessShare,
    options: ImportOptions = {},
): Dict {
    const next = deepClone(config ?? {});
    const outbound = vlessShareToXrayOutbound(link, options);

    const outbounds = Array.isArray(next.outbounds) ? [...next.outbounds] : [];
    const mode = options.mode ?? "append";

    if (mode === "append") {
        outbounds.push(outbound);
    } else if (mode === "replaceByTag") {
        if (!outbound.tag) throw new Error("replaceByTag 需要提供 tag 或链接 name");
        const index = outbounds.findIndex((item) => item?.tag === outbound.tag);
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else if (mode === "replaceFirstVless") {
        const index = outbounds.findIndex((item) => item?.protocol === "vless");
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else {
        throw new Error(`未知导入模式: ${mode}`);
    }

    next.outbounds = outbounds;
    return next;
}

export function importVlessShareToXrayConfigJson(
    configJson: string,
    link: string | VlessShare,
    options: ImportOptions = {},
): string {
    const config = configJson.trim() ? JSON.parse(configJson) : {};
    const next = importVlessShareToXrayConfig(config, link, options);
    return JSON.stringify(next, null, 2);
}

export function exportVlessLinksFromXrayConfig(
    config: Dict,
    options: ExportOptions = {},
): string[] {
    const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
    const tagFilter =
        options.tag === undefined
            ? undefined
            : new Set(Array.isArray(options.tag) ? options.tag : [options.tag]);

    return outbounds
        .filter((outbound) => outbound?.protocol === "vless")
        .filter((outbound) => !tagFilter || tagFilter.has(String(outbound.tag)))
        .map((outbound) => {
            const name = options.useTagAsName === false ? undefined : stringOrUndefined(outbound.tag);
            const share = outboundToVlessShare(outbound, {
                name,
                strict: options.strict ?? true,
            });

            return formatVlessShareLink(share, {
                strict: options.strict ?? true,
                omitDefaults: options.omitDefaults ?? false,
            });
        });
}

export function exportVlessLinksFromXrayConfigJson(
    configJson: string,
    options: ExportOptions = {},
): string[] {
    return exportVlessLinksFromXrayConfig(JSON.parse(configJson), options);
}

/* ---------------- internal helpers ---------------- */

function parseRawQuery(rawQuery: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!rawQuery) return result;

    for (const part of rawQuery.split("&")) {
        if (!part) continue;

        const eq = part.indexOf("=");
        const rawKey = eq >= 0 ? part.slice(0, eq) : part;
        const rawValue = eq >= 0 ? part.slice(eq + 1) : "";

        const key = decodeUriPart(rawKey);
        const value = decodeUriPart(rawValue);

        if (!key) throw new Error("query 参数名不可为空");
        if (Object.prototype.hasOwnProperty.call(result, key)) {
            throw new Error(`重复 query 参数: ${key}`);
        }

        result[key] = value;
    }

    return result;
}

function validateShare(share: VlessShare, strict: boolean): void {
    assertNonEmpty(share.id, "uuid/id");
    assertNonEmpty(share.address, "remote-host");
    assertValidPort(share.port);

    const p = share.params;

    assertNonEmpty(p.type, "type");
    assertNonEmpty(p.encryption, "encryption");
    assertNonEmpty(p.security, "security");

    if (strict && !TRANSPORTS.has(p.type)) {
        throw new Error(`不支持的 type: ${p.type}`);
    }

    if (strict && !SECURITIES.has(p.security)) {
        throw new Error(`不支持的 security: ${p.security}`);
    }

    if (p.sni === "") throw new Error("sni 不可为空字符串");
    if (p.fp === "") throw new Error("fp 不可为空字符串");

    if (p.alpn?.some((item) => item === "")) {
        throw new Error("alpn 中不可包含空字符串");
    }

    if (["ws", "httpupgrade", "xhttp"].includes(p.type) && p.path === "") {
        throw new Error(`${p.type} 的 path 不可为空字符串`);
    }

    if (p.type === "grpc" && p.serviceName === "") {
        throw new Error("grpc serviceName 不可为空字符串");
    }

    if (p.security === "reality") {
        assertNonEmpty(p.pbk, "REALITY pbk");
        if (strict) assertNonEmpty(p.fp, "REALITY fp");
    }
}

function applyTransportToStreamSettings(p: VlessShareParams, stream: Dict): void {
    switch (p.type) {
        case "ws": {
            const ws: Dict = { path: p.path ?? "/" };
            if (p.host !== undefined) ws.host = p.host;
            stream.wsSettings = ws;
            break;
        }

        case "httpupgrade": {
            const httpupgrade: Dict = { path: p.path ?? "/" };
            if (p.host !== undefined) httpupgrade.host = p.host;
            stream.httpupgradeSettings = httpupgrade;
            break;
        }

        case "grpc": {
            const grpc: Dict = {};
            if (p.serviceName !== undefined) grpc.serviceName = p.serviceName;
            if (p.authority !== undefined) grpc.authority = p.authority;

            if (p.mode === "multi") grpc.multiMode = true;
            else if (p.mode && p.mode !== "gun") grpc.mode = p.mode;

            stream.grpcSettings = grpc;
            break;
        }

        case "kcp": {
            const kcp: Dict = {};
            if (p.mtu !== undefined) kcp.mtu = p.mtu;
            if (p.tti !== undefined) kcp.tti = p.tti;

            // 旧生态兼容：新版 mKCP 已建议用 FinalMask 代替 seed/header。
            if (p.seed !== undefined) kcp.seed = p.seed;
            if (p.headerType !== undefined) kcp.header = { type: p.headerType };

            stream.kcpSettings = kcp;
            break;
        }

        case "http": {
            const http: Dict = {};
            if (p.path !== undefined) http.path = p.path;
            if (p.host !== undefined) http.host = [p.host];
            stream.httpSettings = http;
            break;
        }

        case "xhttp": {
            const xhttp: Dict = { path: p.path ?? "/" };
            if (p.host !== undefined) xhttp.host = p.host;
            if (p.mode !== undefined) xhttp.mode = p.mode;
            if (p.extra !== undefined) xhttp.extra = parseJsonMaybe(p.extra);
            stream.xhttpSettings = xhttp;
            break;
        }

        case "tcp":
        default:
            break;
    }

    if (p.fm !== undefined) {
        stream.finalmask = parseJsonMaybe(p.fm);
    }
}

function applySecurityToStreamSettings(
    p: VlessShareParams,
    stream: Dict,
    options: ToXrayOptions,
): void {
    if (p.security === "tls") {
        const tls: Dict = {};
        if (p.sni !== undefined) tls.serverName = p.sni;
        if (p.fp !== undefined) tls.fingerprint = p.fp;
        if (p.alpn !== undefined) tls.alpn = p.alpn;
        if (p.ech !== undefined) tls.echConfigList = p.ech;
        if (p.pcs !== undefined) tls.pinnedPeerCertSha256 = p.pcs;
        if (p.vcn !== undefined) tls.verifyPeerCertByName = p.vcn;

        if (Object.keys(tls).length > 0) stream.tlsSettings = tls;
    }

    if (p.security === "reality") {
        const reality: Dict = {
            fingerprint: p.fp ?? "chrome",
            password: p.pbk,
        };

        const passwordField = options.realityPasswordField ?? "password";
        delete reality.password;
        reality[passwordField] = p.pbk;

        if (p.sni !== undefined) reality.serverName = p.sni;
        if (p.sid !== undefined) reality.shortId = p.sid;
        if (p.pqv !== undefined) reality.mldsa65Verify = p.pqv;
        if (p.spx !== undefined) reality.spiderX = p.spx;

        stream.realitySettings = reality;
    }
}

function readTransportFromStreamSettings(
    type: VlessTransport,
    params: VlessShareParams,
    stream: Dict,
): void {
    if (type === "ws") {
        const ws = asDict(stream.wsSettings);
        params.path = stringOrUndefined(ws.path);
        params.host =
            stringOrUndefined(ws.host) ??
            stringOrUndefined(asDict(ws.headers).Host) ??
            stringOrUndefined(asDict(ws.headers).host);
    }

    if (type === "httpupgrade") {
        const hu = asDict(stream.httpupgradeSettings);
        params.path = stringOrUndefined(hu.path);
        params.host = stringOrUndefined(hu.host);
    }

    if (type === "grpc") {
        const grpc = asDict(stream.grpcSettings);
        params.serviceName = stringOrUndefined(grpc.serviceName);
        params.authority = stringOrUndefined(grpc.authority);
        params.mode = grpc.multiMode === true ? "multi" : stringOrUndefined(grpc.mode);
    }

    if (type === "kcp") {
        const kcp = asDict(stream.kcpSettings);
        params.mtu = numberOrUndefined(kcp.mtu);
        params.tti = numberOrUndefined(kcp.tti);
        params.seed = stringOrUndefined(kcp.seed);
        params.headerType = stringOrUndefined(asDict(kcp.header).type);
    }

    if (type === "http") {
        const http = asDict(stream.httpSettings);
        params.path = stringOrUndefined(http.path);
        const host = http.host;
        params.host = Array.isArray(host) ? stringOrUndefined(host[0]) : stringOrUndefined(host);
    }

    if (type === "xhttp") {
        const xhttp = asDict(stream.xhttpSettings);
        params.path = stringOrUndefined(xhttp.path);
        params.host = stringOrUndefined(xhttp.host);
        params.mode = stringOrUndefined(xhttp.mode);
        params.extra = stringifyMaybe(xhttp.extra);
    }

    params.fm = stringifyMaybe(stream.finalmask);
}

function readSecurityFromStreamSettings(
    security: VlessSecurity,
    params: VlessShareParams,
    stream: Dict,
): void {
    if (security === "tls") {
        const tls = asDict(stream.tlsSettings);
        params.sni = stringOrUndefined(tls.serverName);
        params.fp = stringOrUndefined(tls.fingerprint);
        params.alpn = Array.isArray(tls.alpn) ? tls.alpn.map(String) : undefined;
        params.ech = stringOrUndefined(tls.echConfigList);
        params.pcs = stringOrUndefined(tls.pinnedPeerCertSha256);
        params.vcn = stringOrUndefined(tls.verifyPeerCertByName);
    }

    if (security === "reality") {
        const reality = asDict(stream.realitySettings);
        params.sni = stringOrUndefined(reality.serverName);
        params.fp = stringOrUndefined(reality.fingerprint) ?? "chrome";
        params.pbk =
            stringOrUndefined(reality.password) ??
            stringOrUndefined(reality.publicKey);
        params.sid = stringOrUndefined(reality.shortId) ?? "";
        params.pqv = stringOrUndefined(reality.mldsa65Verify);
        params.spx = stringOrUndefined(reality.spiderX);
    }
}

function readVlessEndpoint(outbound: Dict): {
    address: string;
    port: number;
    id: string;
    encryption?: string;
    flow?: string;
} {
    const settings = asDict(outbound.settings);
    const vnext = Array.isArray(settings.vnext) ? asDict(settings.vnext[0]) : undefined;

    if (vnext) {
        const users = Array.isArray(vnext.users) ? vnext.users : [];
        const user = asDict(users[0]);

        const address = stringOrUndefined(vnext.address);
        const port = Number(vnext.port);
        const id = stringOrUndefined(user.id);

        assertNonEmpty(address, "settings.vnext[0].address");
        assertValidPort(port);
        assertNonEmpty(id, "settings.vnext[0].users[0].id");

        return {
            address,
            port,
            id,
            encryption: stringOrUndefined(user.encryption) ?? stringOrUndefined(settings.encryption),
            flow: stringOrUndefined(user.flow) ?? stringOrUndefined(settings.flow),
        };
    }

    // 兼容某些简化结构：settings.address / settings.port / settings.id
    const address = stringOrUndefined(settings.address);
    const port = Number(settings.port);
    const id = stringOrUndefined(settings.id);

    assertNonEmpty(address, "settings.address");
    assertValidPort(port);
    assertNonEmpty(id, "settings.id");

    return {
        address,
        port,
        id,
        encryption: stringOrUndefined(settings.encryption),
        flow: stringOrUndefined(settings.flow),
    };
}

function shareTypeToXrayNetwork(type: VlessTransport, preferRaw: boolean): string {
    if (type === "tcp") return preferRaw ? "raw" : "tcp";
    return type;
}

function xrayNetworkToShareType(network: string): VlessTransport {
    if (network === "raw" || network === "tcp") return "tcp";
    if (network === "kcp") return "kcp";
    if (network === "ws") return "ws";
    if (network === "grpc") return "grpc";
    if (network === "httpupgrade") return "httpupgrade";
    if (network === "xhttp") return "xhttp";
    if (network === "http" || network === "h2") return "http";
    return "tcp";
}

function decodeUriPart(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        throw new Error(`URL 编码非法: ${value}`);
    }
}

function stripIpv6Brackets(host: string): string {
    if (host.startsWith("[") && host.endsWith("]")) {
        return host.slice(1, -1);
    }
    return host;
}

function formatHostForUri(host: string): string {
    const ascii = toAsciiHost(stripIpv6Brackets(host.trim()));
    return ascii.includes(":") && !ascii.startsWith("[") ? `[${ascii}]` : ascii;
}

function toAsciiHost(host: string): string {
    if (host.includes(":")) return host; // IPv6
    try {
        return new URL(`http://${host}`).hostname;
    } catch {
        return host;
    }
}

function assignString<K extends keyof VlessShareParams>(
    target: VlessShareParams,
    key: K,
    value: string | undefined,
    allowEmpty = false,
): void {
    if (value === undefined) return;
    if (!allowEmpty && value === "") return;
    (target[key] as unknown) = value;
}

function assignNumber<K extends keyof VlessShareParams>(
    target: VlessShareParams,
    key: K,
    value: string | undefined,
): void {
    if (value === undefined || value === "") return;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${String(key)} 必须是数字`);
    (target[key] as unknown) = n;
}

function assertNonEmpty(value: unknown, name: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${name} 不可省略或为空`);
    }
}

function assertValidPort(port: unknown): asserts port is number {
    if (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error("remote-port 必须是 1 到 65535 的整数");
    }
}

function asDict(value: unknown): Dict {
    return value && typeof value === "object" ? (value as Dict) : {};
}

function stringOrUndefined(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseJsonMaybe(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) return value;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }

    return value;
}

function stringifyMaybe(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}

function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
