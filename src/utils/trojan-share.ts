/* trojan-share.ts */

type Dict<T = unknown> = Record<string, T>;

export type TrojanTransport =
    | "tcp"
    | "kcp"
    | "ws"
    | "http"
    | "grpc"
    | "httpupgrade"
    | "xhttp";

export interface TrojanShareParams {
    type: TrojanTransport;

    sni?: string;
    fp?: string;
    alpn?: string[];

    // WS / HTTPUpgrade / XHTTP
    path?: string;
    host?: string;

    // gRPC / XHTTP
    serviceName?: string;
    mode?: string;
    authority?: string;

    // mKCP
    mtu?: number;
    tti?: number;
    seed?: string;
    headerType?: string;
}

export interface TrojanShare {
    password: string;
    address: string;
    port: number;
    name?: string;
    params: TrojanShareParams;
    extraParams?: Record<string, string>;
}

export interface XrayOutbound {
    protocol: "trojan";
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
    mode?: "append" | "replaceByTag" | "replaceFirstTrojan";
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

const KNOWN_QUERY_KEYS = new Set([
    "type",
    "sni",
    "fp",
    "alpn",
    "path",
    "host",
    "serviceName",
    "mode",
    "authority",
    "mtu",
    "tti",
    "seed",
    "headerType",
]);

export function parseTrojanShareLink(
    rawLink: string,
    options: ParseOptions = {},
): TrojanShare {
    const strict = options.strict ?? true;

    let url: URL;
    try {
        url = new URL(rawLink);
    } catch {
        throw new Error("不是合法 URL");
    }

    if (url.protocol !== "trojan:") {
        throw new Error(`协议必须是 trojan，实际为 ${url.protocol}`);
    }

    const password = decodeUriPart(url.username);
    const address = stripIpv6Brackets(url.hostname);
    const port = Number(url.port);
    const name = url.hash ? decodeUriPart(url.hash.slice(1)) : undefined;

    assertNonEmpty(password, "password");
    assertNonEmpty(address, "remote-host");
    assertValidPort(port);

    const rawParams = parseRawQuery(url.search.startsWith("?") ? url.search.slice(1) : "");

    const type = (rawParams.type ?? "tcp") as TrojanTransport;

    const params: TrojanShareParams = {
        type,
    };

    assignString(params, "sni", rawParams.sni);
    assignString(params, "fp", rawParams.fp);

    if (rawParams.alpn !== undefined && rawParams.alpn !== "") {
        params.alpn = rawParams.alpn.split(",");
    }

    assignString(params, "path", rawParams.path);
    assignString(params, "host", rawParams.host, true);
    assignString(params, "serviceName", rawParams.serviceName);
    assignString(params, "mode", rawParams.mode);
    assignString(params, "authority", rawParams.authority, true);

    assignNumber(params, "mtu", rawParams.mtu);
    assignNumber(params, "tti", rawParams.tti);
    assignString(params, "seed", rawParams.seed);
    assignString(params, "headerType", rawParams.headerType);

    const extraParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawParams)) {
        if (!KNOWN_QUERY_KEYS.has(key)) extraParams[key] = value;
    }

    const share: TrojanShare = { password, address, port, name, params, extraParams };
    validateShare(share, strict);

    return share;
}

export function formatTrojanShareLink(
    share: TrojanShare,
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

    add("path", p.path);
    add("host", p.host);
    add("serviceName", p.serviceName);
    add("mode", p.mode);
    add("authority", p.authority);

    add("sni", p.sni);
    add("fp", p.fp, "chrome");
    add("alpn", p.alpn);

    add("mtu", p.mtu);
    add("tti", p.tti);
    add("seed", p.seed);
    add("headerType", p.headerType);

    for (const [key, value] of Object.entries(share.extraParams ?? {})) {
        if (!KNOWN_QUERY_KEYS.has(key)) add(key, value);
    }

    const query = pairs
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    const host = formatHostForUri(share.address);
    const fragment = share.name ? `#${encodeURIComponent(share.name)}` : "";

    return `trojan://${encodeURIComponent(share.password)}@${host}:${share.port}${query ? `?${query}` : ""
        }${fragment}`;
}

export function trojanShareToXrayOutbound(
    input: string | TrojanShare,
    options: ToXrayOptions = {},
): XrayOutbound {
    const strict = options.strict ?? true;
    const share = typeof input === "string" ? parseTrojanShareLink(input, { strict }) : input;

    validateShare(share, strict);

    const p = share.params;

    const streamSettings: Dict = {
        network: shareTypeToXrayNetwork(p.type, options.preferRawNetwork ?? true),
        security: "tls",
    };

    applyTransportToStreamSettings(p, streamSettings);
    applyTlsToStreamSettings(p, streamSettings);

    const outbound: XrayOutbound = {
        protocol: "trojan",
        settings: {
            servers: [
                {
                    address: share.address,
                    port: share.port,
                    password: share.password,
                },
            ],
        },
        streamSettings,
    };

    const tag = options.tag ?? share.name;
    if (tag) outbound.tag = tag;

    return outbound;
}

export function outboundToTrojanShare(
    outbound: Dict,
    options: { name?: string; strict?: boolean } = {},
): TrojanShare {
    if (outbound.protocol !== "trojan") {
        throw new Error("outbound.protocol 必须是 trojan");
    }

    const endpoint = readTrojanEndpoint(outbound);
    const stream = asDict(outbound.streamSettings);
    const type = xrayNetworkToShareType((stream.network as string | undefined) ?? "tcp");

    const params: TrojanShareParams = { type };

    readTransportFromStreamSettings(type, params, stream);
    readTlsFromStreamSettings(params, stream);

    const share: TrojanShare = {
        password: endpoint.password,
        address: endpoint.address,
        port: endpoint.port,
        name: options.name ?? stringOrUndefined(outbound.tag),
        params,
    };

    validateShare(share, options.strict ?? true);
    return share;
}

export function importTrojanShareToXrayConfig(
    config: Dict,
    link: string | TrojanShare,
    options: ImportOptions = {},
): Dict {
    const next = deepClone(config ?? {});
    const outbound = trojanShareToXrayOutbound(link, options);

    const outbounds = Array.isArray(next.outbounds) ? [...next.outbounds] : [];
    const mode = options.mode ?? "append";

    if (mode === "append") {
        outbounds.push(outbound);
    } else if (mode === "replaceByTag") {
        if (!outbound.tag) throw new Error("replaceByTag 需要提供 tag 或链接 name");
        const index = outbounds.findIndex((item) => item?.tag === outbound.tag);
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else if (mode === "replaceFirstTrojan") {
        const index = outbounds.findIndex((item) => item?.protocol === "trojan");
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else {
        throw new Error(`未知导入模式: ${mode}`);
    }

    next.outbounds = outbounds;
    return next;
}

export function importTrojanShareToXrayConfigJson(
    configJson: string,
    link: string | TrojanShare,
    options: ImportOptions = {},
): string {
    const config = configJson.trim() ? JSON.parse(configJson) : {};
    const next = importTrojanShareToXrayConfig(config, link, options);
    return JSON.stringify(next, null, 2);
}

export function exportTrojanLinksFromXrayConfig(
    config: Dict,
    options: ExportOptions = {},
): string[] {
    const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
    const tagFilter =
        options.tag === undefined
            ? undefined
            : new Set(Array.isArray(options.tag) ? options.tag : [options.tag]);

    return outbounds
        .filter((outbound) => outbound?.protocol === "trojan")
        .filter((outbound) => !tagFilter || tagFilter.has(String(outbound.tag)))
        .map((outbound) => {
            const name = options.useTagAsName === false ? undefined : stringOrUndefined(outbound.tag);
            const share = outboundToTrojanShare(outbound, {
                name,
                strict: options.strict ?? true,
            });

            return formatTrojanShareLink(share, {
                strict: options.strict ?? true,
                omitDefaults: options.omitDefaults ?? false,
            });
        });
}

export function exportTrojanLinksFromXrayConfigJson(
    configJson: string,
    options: ExportOptions = {},
): string[] {
    return exportTrojanLinksFromXrayConfig(JSON.parse(configJson), options);
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

function validateShare(share: TrojanShare, strict: boolean): void {
    assertNonEmpty(share.password, "password");
    assertNonEmpty(share.address, "remote-host");
    assertValidPort(share.port);

    const p = share.params;

    assertNonEmpty(p.type, "type");

    if (strict && !TRANSPORTS.has(p.type)) {
        throw new Error(`不支持的 type: ${p.type}`);
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
}

function applyTransportToStreamSettings(p: TrojanShareParams, stream: Dict): void {
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
            stream.xhttpSettings = xhttp;
            break;
        }

        case "tcp":
        default:
            break;
    }
}

function applyTlsToStreamSettings(p: TrojanShareParams, stream: Dict): void {
    const tls: Dict = {};
    if (p.sni !== undefined) tls.serverName = p.sni;
    if (p.fp !== undefined) tls.fingerprint = p.fp;
    if (p.alpn !== undefined) tls.alpn = p.alpn;

    if (Object.keys(tls).length > 0) stream.tlsSettings = tls;
}

function readTransportFromStreamSettings(
    type: TrojanTransport,
    params: TrojanShareParams,
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
    }
}

function readTlsFromStreamSettings(params: TrojanShareParams, stream: Dict): void {
    const tls = asDict(stream.tlsSettings);
    params.sni = stringOrUndefined(tls.serverName);
    params.fp = stringOrUndefined(tls.fingerprint);
    params.alpn = Array.isArray(tls.alpn) ? tls.alpn.map(String) : undefined;
}

function readTrojanEndpoint(outbound: Dict): {
    address: string;
    port: number;
    password: string;
} {
    const settings = asDict(outbound.settings);
    const servers = Array.isArray(settings.servers) ? settings.servers : [];
    const server = asDict(servers[0]);

    if (server) {
        const address = stringOrUndefined(server.address);
        const port = Number(server.port);
        const password = stringOrUndefined(server.password);

        assertNonEmpty(address, "settings.servers[0].address");
        assertValidPort(port);
        assertNonEmpty(password, "settings.servers[0].password");

        return { address, port, password };
    }

    // 兼容某些简化结构：settings.address / settings.port / settings.password
    const address = stringOrUndefined(settings.address);
    const port = Number(settings.port);
    const password = stringOrUndefined(settings.password);

    assertNonEmpty(address, "settings.address");
    assertValidPort(port);
    assertNonEmpty(password, "settings.password");

    return { address, port, password };
}

function shareTypeToXrayNetwork(type: TrojanTransport, preferRaw: boolean): string {
    if (type === "tcp") return preferRaw ? "raw" : "tcp";
    return type;
}

function xrayNetworkToShareType(network: string): TrojanTransport {
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

function assignString<K extends keyof TrojanShareParams>(
    target: TrojanShareParams,
    key: K,
    value: string | undefined,
    allowEmpty = false,
): void {
    if (value === undefined) return;
    if (!allowEmpty && value === "") return;
    (target[key] as unknown) = value;
}

function assignNumber<K extends keyof TrojanShareParams>(
    target: TrojanShareParams,
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

function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
