/* vmess-share.ts */

import { type Dict, assertNonEmpty, assertValidPort, asDict, stringOrUndefined, numberOrUndefined, parseJsonMaybe, stringifyMaybe, deepClone } from './share-utils';

export type VmessTransport =
    | "tcp"
    | "kcp"
    | "ws"
    | "http"
    | "grpc"
    | "httpupgrade"
    | "xhttp";

export type VmessSecurity = "none" | "tls";

export type VmessCipher =
    | "auto"
    | "none"
    | "aes-128-gcm"
    | "chacha20-poly1305"
    | "zero";

export interface VmessShareParams {
    scy: VmessCipher;
    net: VmessTransport;
    type: string; // header type (none/http/srtp/utp/wechat_video/wireguard)
    tls: VmessSecurity;
    aid: number; // alterId
    v: string; // version

    // TLS fields
    sni?: string;
    alpn?: string[];
    fp?: string;

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

export interface VmessShare {
    id: string;
    address: string;
    port: number;
    name?: string;
    params: VmessShareParams;
    extraParams?: Record<string, string>;
}

export interface XrayOutbound {
    protocol: "vmess";
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
}

export interface ImportOptions extends ToXrayOptions {
    mode?: "append" | "replaceByTag" | "replaceFirstVmess";
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

const SECURITIES = new Set(["none", "tls"]);

const KNOWN_JSON_KEYS = new Set([
    "v",
    "ps",
    "add",
    "port",
    "id",
    "aid",
    "scy",
    "net",
    "type",
    "host",
    "path",
    "tls",
    "sni",
    "alpn",
    "fp",
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

/* ---------------- public API ---------------- */

export function parseVmessShareLink(
    rawLink: string,
    options: ParseOptions = {},
): VmessShare {
    const strict = options.strict ?? true;

    if (!rawLink.startsWith("vmess://")) {
        throw new Error("链接必须以 vmess:// 开头");
    }

    const base64Part = rawLink.slice("vmess://".length);
    if (!base64Part) {
        throw new Error("vmess:// 后缺少 Base64 内容");
    }

    const decoded = base64Decode(base64Part);
    let json: Dict;
    try {
        json = JSON.parse(decoded) as Dict;
    } catch {
        throw new Error("Base64 解码后的内容不是合法 JSON");
    }

    if (typeof json !== "object" || json === null) {
        throw new Error("JSON 内容必须是对象");
    }

    const address = stringOrUndefined(json.add) ?? "";
    const portRaw = stringOrUndefined(json.port) ?? "";
    const id = stringOrUndefined(json.id) ?? "";
    const name = stringOrUndefined(json.ps);

    assertNonEmpty(id, "uuid/id");
    assertNonEmpty(address, "remote-host");

    const port = Number(portRaw);
    assertValidPort(port);

    const scy = (stringOrUndefined(json.scy) ?? "auto") as VmessCipher;
    const net = (stringOrUndefined(json.net) ?? "tcp") as VmessTransport;
    const type = stringOrUndefined(json.type) ?? "none";
    const tls = (stringOrUndefined(json.tls) ?? "none") as VmessSecurity;
    const aid = json.aid !== undefined ? Number(json.aid) : 0;
    const v = stringOrUndefined(json.v) ?? "2";

    const params: VmessShareParams = {
        scy,
        net,
        type,
        tls,
        aid,
        v,
    };

    params.sni = stringOrUndefined(json.sni);
    params.fp = stringOrUndefined(json.fp);
    if (json.alpn !== undefined && String(json.alpn) !== "") {
        params.alpn = String(json.alpn).split(",").map((s) => s.trim()).filter(Boolean);
    }

    params.path = stringOrUndefined(json.path);
    params.host = stringOrUndefined(json.host);
    params.serviceName = stringOrUndefined(json.serviceName);
    params.mode = stringOrUndefined(json.mode);
    params.authority = stringOrUndefined(json.authority);

    if (json.mtu !== undefined) params.mtu = Number(json.mtu);
    if (json.tti !== undefined) params.tti = Number(json.tti);
    params.seed = stringOrUndefined(json.seed);
    params.headerType = stringOrUndefined(json.headerType);

    params.extra = stringOrUndefined(json.extra);
    params.fm = stringOrUndefined(json.fm);

    const extraParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
        if (!KNOWN_JSON_KEYS.has(key) && typeof value === "string") {
            extraParams[key] = value;
        }
    }

    const share: VmessShare = { id, address, port, name, params, extraParams };
    validateShare(share, strict);

    return share;
}

export function formatVmessShareLink(
    share: VmessShare,
    options: FormatOptions = {},
): string {
    const strict = options.strict ?? true;
    const omitDefaults = options.omitDefaults ?? false;

    validateShare(share, strict);

    const p = share.params;
    const json: Dict = {};

    const setField = (key: string, value: unknown, defaultValue?: string) => {
        if (value === undefined || value === null) return;

        const stringValue = Array.isArray(value) ? value.join(",") : String(value);

        if (omitDefaults && defaultValue !== undefined && stringValue === defaultValue) {
            return;
        }

        json[key] = stringValue;
    };

    setField("v", p.v, "2");
    if (share.name) json.ps = share.name;
    json.add = share.address;
    json.port = String(share.port);
    json.id = share.id;
    setField("aid", p.aid, "0");
    setField("scy", p.scy, "auto");
    setField("net", p.net, "tcp");
    setField("type", p.type, "none");
    setField("tls", p.tls, "none");

    setField("host", p.host);
    setField("path", p.path);
    setField("serviceName", p.serviceName);
    setField("mode", p.mode);
    setField("authority", p.authority);

    setField("sni", p.sni);
    setField("fp", p.fp, p.tls === "tls" ? "chrome" : undefined);
    setField("alpn", p.alpn);

    setField("mtu", p.mtu);
    setField("tti", p.tti);
    setField("seed", p.seed);
    setField("headerType", p.headerType);

    setField("extra", p.extra);
    setField("fm", p.fm);

    for (const [key, value] of Object.entries(share.extraParams ?? {})) {
        if (!KNOWN_JSON_KEYS.has(key)) json[key] = value;
    }

    const jsonStr = JSON.stringify(json);
    const base64Str = base64Encode(jsonStr);

    return `vmess://${base64Str}`;
}

export function vmessShareToXrayOutbound(
    input: string | VmessShare,
    options: ToXrayOptions = {},
): XrayOutbound {
    const strict = options.strict ?? true;
    const share = typeof input === "string" ? parseVmessShareLink(input, { strict }) : input;

    validateShare(share, strict);

    const p = share.params;
    const user: Dict = {
        id: share.id,
        alterId: p.aid ?? 0,
        security: p.scy ?? "auto",
    };

    const streamSettings: Dict = {
        network: shareTypeToXrayNetwork(p.net, options.preferRawNetwork ?? true),
        security: p.tls ?? "none",
    };

    applyTransportToStreamSettings(p, streamSettings);
    applySecurityToStreamSettings(p, streamSettings);

    const outbound: XrayOutbound = {
        protocol: "vmess",
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

export function outboundToVmessShare(
    outbound: Dict,
    options: { name?: string; strict?: boolean } = {},
): VmessShare {
    if (outbound.protocol !== "vmess") {
        throw new Error("outbound.protocol 必须是 vmess");
    }

    const endpoint = readVmessEndpoint(outbound);
    const stream = asDict(outbound.streamSettings);
    const security = ((stream.security as string | undefined) ?? "none") as VmessSecurity;
    const type = xrayNetworkToShareType((stream.network as string | undefined) ?? "tcp");

    const params: VmessShareParams = {
        scy: (endpoint.cipher ?? "auto") as VmessCipher,
        net: type,
        type: "none",
        tls: security,
        aid: endpoint.alterId ?? 0,
        v: "2",
    };

    readTransportFromStreamSettings(type, params, stream);
    readSecurityFromStreamSettings(security, params, stream);

    const share: VmessShare = {
        id: endpoint.id,
        address: endpoint.address,
        port: endpoint.port,
        name: options.name ?? stringOrUndefined(outbound.tag),
        params,
    };

    validateShare(share, options.strict ?? true);
    return share;
}

export function importVmessShareToXrayConfig(
    config: Dict,
    link: string | VmessShare,
    options: ImportOptions = {},
): Dict {
    const next = deepClone(config ?? {});
    const outbound = vmessShareToXrayOutbound(link, options);

    const outbounds = Array.isArray(next.outbounds) ? [...next.outbounds] : [];
    const mode = options.mode ?? "append";

    if (mode === "append") {
        outbounds.push(outbound);
    } else if (mode === "replaceByTag") {
        if (!outbound.tag) throw new Error("replaceByTag 需要提供 tag 或链接 name");
        const index = outbounds.findIndex((item) => item?.tag === outbound.tag);
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else if (mode === "replaceFirstVmess") {
        const index = outbounds.findIndex((item) => item?.protocol === "vmess");
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else {
        throw new Error(`未知导入模式: ${mode}`);
    }

    next.outbounds = outbounds;
    return next;
}

export function importVmessShareToXrayConfigJson(
    configJson: string,
    link: string | VmessShare,
    options: ImportOptions = {},
): string {
    const config = configJson.trim() ? JSON.parse(configJson) : {};
    const next = importVmessShareToXrayConfig(config, link, options);
    return JSON.stringify(next, null, 2);
}

export function exportVmessLinksFromXrayConfig(
    config: Dict,
    options: ExportOptions = {},
): string[] {
    const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
    const tagFilter =
        options.tag === undefined
            ? undefined
            : new Set(Array.isArray(options.tag) ? options.tag : [options.tag]);

    return outbounds
        .filter((outbound) => outbound?.protocol === "vmess")
        .filter((outbound) => !tagFilter || tagFilter.has(String(outbound.tag)))
        .map((outbound) => {
            const name = options.useTagAsName === false ? undefined : stringOrUndefined(outbound.tag);
            const share = outboundToVmessShare(outbound, {
                name,
                strict: options.strict ?? true,
            });

            return formatVmessShareLink(share, {
                strict: options.strict ?? true,
                omitDefaults: options.omitDefaults ?? false,
            });
        });
}

export function exportVmessLinksFromXrayConfigJson(
    configJson: string,
    options: ExportOptions = {},
): string[] {
    return exportVmessLinksFromXrayConfig(JSON.parse(configJson), options);
}

/* ---------------- internal helpers ---------------- */

function validateShare(share: VmessShare, strict: boolean): void {
    assertNonEmpty(share.id, "uuid/id");
    assertNonEmpty(share.address, "remote-host");
    assertValidPort(share.port);

    const p = share.params;

    assertNonEmpty(p.scy, "scy");
    assertNonEmpty(p.net, "net");
    assertNonEmpty(p.tls, "tls");

    if (strict && !TRANSPORTS.has(p.net)) {
        throw new Error(`不支持的 net: ${p.net}`);
    }

    if (strict && !SECURITIES.has(p.tls)) {
        throw new Error(`不支持的 tls: ${p.tls}`);
    }

    if (p.sni === "") throw new Error("sni 不可为空字符串");
    if (p.fp === "") throw new Error("fp 不可为空字符串");

    if (p.alpn?.some((item) => item === "")) {
        throw new Error("alpn 中不可包含空字符串");
    }

    if (["ws", "httpupgrade", "xhttp"].includes(p.net) && p.path === "") {
        throw new Error(`${p.net} 的 path 不可为空字符串`);
    }

    if (p.net === "grpc" && p.serviceName === "") {
        throw new Error("grpc serviceName 不可为空字符串");
    }
}

function applyTransportToStreamSettings(p: VmessShareParams, stream: Dict): void {
    switch (p.net) {
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
    p: VmessShareParams,
    stream: Dict,
): void {
    if (p.tls === "tls") {
        const tls: Dict = {};
        if (p.sni !== undefined) tls.serverName = p.sni;
        if (p.fp !== undefined) tls.fingerprint = p.fp;
        if (p.alpn !== undefined) tls.alpn = p.alpn;

        if (Object.keys(tls).length > 0) stream.tlsSettings = tls;
    }
}

function readTransportFromStreamSettings(
    type: VmessTransport,
    params: VmessShareParams,
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
    security: VmessSecurity,
    params: VmessShareParams,
    stream: Dict,
): void {
    if (security === "tls") {
        const tls = asDict(stream.tlsSettings);
        params.sni = stringOrUndefined(tls.serverName);
        params.fp = stringOrUndefined(tls.fingerprint);
        params.alpn = Array.isArray(tls.alpn) ? tls.alpn.map(String) : undefined;
    }
}

function readVmessEndpoint(outbound: Dict): {
    address: string;
    port: number;
    id: string;
    alterId?: number;
    cipher?: string;
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
            alterId: numberOrUndefined(user.alterId),
            cipher: stringOrUndefined(user.security) ?? stringOrUndefined(settings.security),
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
        alterId: numberOrUndefined(settings.alterId),
        cipher: stringOrUndefined(settings.security),
    };
}

function shareTypeToXrayNetwork(type: VmessTransport, preferRaw: boolean): string {
    if (type === "tcp") return preferRaw ? "raw" : "tcp";
    return type;
}

function xrayNetworkToShareType(network: string): VmessTransport {
    if (network === "raw" || network === "tcp") return "tcp";
    if (network === "kcp") return "kcp";
    if (network === "ws") return "ws";
    if (network === "grpc") return "grpc";
    if (network === "httpupgrade") return "httpupgrade";
    if (network === "xhttp") return "xhttp";
    if (network === "http" || network === "h2") return "http";
    return "tcp";
}

function base64Decode(input: string): string {
    // 标准化 Base64：移除空白，替换 URL-safe 字符
    let normalized = input.replace(/\s/g, "");
    normalized = normalized.replace(/-/g, "+").replace(/_/g, "/");

    // 补全 padding
    while (normalized.length % 4 !== 0) normalized += "=";

    return atob(normalized);
}

function base64Encode(input: string): string {
    const base64 = btoa(input);

    // VMess 标准：移除 padding，使用 URL-safe 字符
    return base64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}


