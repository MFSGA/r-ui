/* shadowsocks-share.ts */

import { type Dict, assertNonEmpty, assertValidPort, asDict, stringOrUndefined, deepClone, decodeUriPart, stripIpv6Brackets, formatHostForUri } from './share-utils';

export type SsMethod = string;

export interface SsShareParams {
    plugin?: string;
    pluginOpts?: string;
    protocol?: string;
    obfs?: string;
    obfsHost?: string;
}

export interface SsShare {
    password: string;
    method: string;
    address: string;
    port: number;
    name?: string;
    params: SsShareParams;
    extraParams?: Record<string, string>;
}

export interface XrayOutbound {
    protocol: "shadowsocks";
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
    mode?: "append" | "replaceByTag" | "replaceFirstShadowsocks";
}

export interface ExportOptions extends FormatOptions {
    tag?: string | string[];
    useTagAsName?: boolean;
}

const KNOWN_METHODS = new Set([
    "aes-128-gcm",
    "aes-192-gcm",
    "aes-256-gcm",
    "chacha20-ietf-poly1305",
    "xchacha20-ietf-poly1305",
    "aes-128-cfb",
    "aes-192-cfb",
    "aes-256-cfb",
    "aes-128-ctr",
    "aes-192-ctr",
    "aes-256-ctr",
    "rc4-md5",
    "chacha20-ietf",
    "chacha20",
    "salsa20",
    "bf-cfb",
    "camellia-128-cfb",
    "camellia-192-cfb",
    "camellia-256-cfb",
    "none",
    "plain",
]);

const KNOWN_QUERY_KEYS = new Set([
    "plugin",
    "pluginOpts",
    "protocol",
    "obfs",
    "obfsHost",
]);

export function parseShadowsocksShareLink(
    rawLink: string,
    options: ParseOptions = {},
): SsShare {
    const strict = options.strict ?? true;

    if (!rawLink.startsWith("ss://")) {
        const detected = rawLink.includes("://")
            ? rawLink.slice(0, rawLink.indexOf("://") + 3)
            : rawLink.slice(0, Math.min(rawLink.indexOf(":"), 10));
        throw new Error(`协议必须是 ss，实际为 ${detected}`);
    }

    const rest = rawLink.slice(5); // strip "ss://"

    // split at # for fragment (name)
    const hashIdx = rest.indexOf("#");
    const name = hashIdx >= 0 ? decodeUriPart(rest.slice(hashIdx + 1)) : undefined;
    const beforeHash = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest;

    // split at ? for query
    const qIdx = beforeHash.indexOf("?");
    const queryStr = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : "";
    const b64Part = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;

    // decode base64 -> "method:password@host:port"
    const decoded = decodeSsBase64(b64Part);

    const atIdx = decoded.lastIndexOf("@");
    if (atIdx < 0) throw new Error("SS 链接格式无效：缺少 @");

    const userInfo = decoded.slice(0, atIdx);
    const hostPort = decoded.slice(atIdx + 1);

    const colonIdx = userInfo.indexOf(":");
    if (colonIdx < 0) throw new Error("SS 链接格式无效：缺少 method:password 分隔");

    const method = userInfo.slice(0, colonIdx);
    const password = userInfo.slice(colonIdx + 1);

    // host:port – split at last colon to handle IPv6 brackets
    const lastColon = hostPort.lastIndexOf(":");
    if (lastColon < 0) throw new Error("SS 链接格式无效：缺少 port");

    let address = hostPort.slice(0, lastColon);
    const portStr = hostPort.slice(lastColon + 1);
    const port = Number(portStr);

    address = stripIpv6Brackets(address);

    assertNonEmpty(method, "method");
    assertNonEmpty(password, "password");
    assertNonEmpty(address, "remote-host");
    assertValidPort(port);

    const rawParams = parseRawQuery(queryStr);

    const params: SsShareParams = {};

    assignString(params, "plugin", rawParams.plugin);
    assignString(params, "pluginOpts", rawParams.pluginOpts);
    assignString(params, "protocol", rawParams.protocol);
    assignString(params, "obfs", rawParams.obfs);
    assignString(params, "obfsHost", rawParams.obfsHost);

    const extraParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawParams)) {
        if (!KNOWN_QUERY_KEYS.has(key)) extraParams[key] = value;
    }

    const share: SsShare = { password, method, address, port, name, params, extraParams };
    validateShare(share, strict);

    return share;
}

export function formatShadowsocksShareLink(
    share: SsShare,
    options: FormatOptions = {},
): string {
    const strict = options.strict ?? true;
    const omitDefaults = options.omitDefaults ?? false;

    validateShare(share, strict);

    // method:password@host:port → base64
    const host = formatHostForUri(share.address);
    const raw = `${share.method}:${share.password}@${host}:${share.port}`;
    const b64 = encodeSsBase64(raw);

    const p = share.params;
    const pairs: Array<[string, string]> = [];

    const add = (key: string, value: unknown, defaultValue?: string) => {
        if (value === undefined || value === null) return;

        const stringValue = String(value);

        if (omitDefaults && defaultValue !== undefined && stringValue === defaultValue) {
            return;
        }

        pairs.push([key, stringValue]);
    };

    add("plugin", p.plugin);
    add("pluginOpts", p.pluginOpts);
    add("protocol", p.protocol);
    add("obfs", p.obfs);
    add("obfsHost", p.obfsHost);

    for (const [key, value] of Object.entries(share.extraParams ?? {})) {
        if (!KNOWN_QUERY_KEYS.has(key)) add(key, value);
    }

    const query = pairs
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    const fragment = share.name ? `#${encodeURIComponent(share.name)}` : "";

    return `ss://${b64}${query ? `?${query}` : ""}${fragment}`;
}

export function shadowsocksShareToXrayOutbound(
    input: string | SsShare,
    options: ToXrayOptions = {},
): XrayOutbound {
    const strict = options.strict ?? true;
    const share = typeof input === "string" ? parseShadowsocksShareLink(input, { strict }) : input;

    validateShare(share, strict);

    const outbound: XrayOutbound = {
        protocol: "shadowsocks",
        settings: {
            servers: [
                {
                    address: share.address,
                    port: share.port,
                    method: share.method,
                    password: share.password,
                    level: 0,
                },
            ],
        },
    };

    const tag = options.tag ?? share.name;
    if (tag) outbound.tag = tag;

    return outbound;
}

export function outboundToShadowsocksShare(
    outbound: Dict,
    options: { name?: string; strict?: boolean } = {},
): SsShare {
    if (outbound.protocol !== "shadowsocks") {
        throw new Error("outbound.protocol 必须是 shadowsocks");
    }

    const endpoint = readSsEndpoint(outbound);

    const share: SsShare = {
        password: endpoint.password,
        method: endpoint.method,
        address: endpoint.address,
        port: endpoint.port,
        name: options.name ?? stringOrUndefined(outbound.tag),
        params: {},
    };

    validateShare(share, options.strict ?? true);
    return share;
}

export function importShadowsocksShareToXrayConfig(
    config: Dict,
    link: string | SsShare,
    options: ImportOptions = {},
): Dict {
    const next = deepClone(config ?? {});
    const outbound = shadowsocksShareToXrayOutbound(link, options);

    const outbounds = Array.isArray(next.outbounds) ? [...next.outbounds] : [];
    const mode = options.mode ?? "append";

    if (mode === "append") {
        outbounds.push(outbound);
    } else if (mode === "replaceByTag") {
        if (!outbound.tag) throw new Error("replaceByTag 需要提供 tag 或链接 name");
        const index = outbounds.findIndex((item) => item?.tag === outbound.tag);
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else if (mode === "replaceFirstShadowsocks") {
        const index = outbounds.findIndex((item) => item?.protocol === "shadowsocks");
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else {
        throw new Error(`未知导入模式: ${mode}`);
    }

    next.outbounds = outbounds;
    return next;
}

export function importShadowsocksShareToXrayConfigJson(
    configJson: string,
    link: string | SsShare,
    options: ImportOptions = {},
): string {
    const config = configJson.trim() ? JSON.parse(configJson) : {};
    const next = importShadowsocksShareToXrayConfig(config, link, options);
    return JSON.stringify(next, null, 2);
}

export function exportShadowsocksLinksFromXrayConfig(
    config: Dict,
    options: ExportOptions = {},
): string[] {
    const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
    const tagFilter =
        options.tag === undefined
            ? undefined
            : new Set(Array.isArray(options.tag) ? options.tag : [options.tag]);

    return outbounds
        .filter((outbound) => outbound?.protocol === "shadowsocks")
        .filter((outbound) => !tagFilter || tagFilter.has(String(outbound.tag)))
        .map((outbound) => {
            const name = options.useTagAsName === false ? undefined : stringOrUndefined(outbound.tag);
            const share = outboundToShadowsocksShare(outbound, {
                name,
                strict: options.strict ?? true,
            });

            return formatShadowsocksShareLink(share, {
                strict: options.strict ?? true,
                omitDefaults: options.omitDefaults ?? false,
            });
        });
}

export function exportShadowsocksLinksFromXrayConfigJson(
    configJson: string,
    options: ExportOptions = {},
): string[] {
    return exportShadowsocksLinksFromXrayConfig(JSON.parse(configJson), options);
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

function validateShare(share: SsShare, strict: boolean): void {
    assertNonEmpty(share.password, "password");
    assertNonEmpty(share.method, "method");
    assertNonEmpty(share.address, "remote-host");
    assertValidPort(share.port);

    if (strict && !KNOWN_METHODS.has(share.method)) {
        throw new Error(`不支持的加密方法: ${share.method}`);
    }
}

/* Shadowsocks 链接格式中不包含传输层 / TLS 参数，以下四个函数保留为空以保持模式一致 */
function _applyTransportToStreamSettings(_p: SsShareParams, _stream: Dict): void {}

function _applySecurityToStreamSettings(_p: SsShareParams, _stream: Dict): void {}

function _readTransportFromStreamSettings(_params: SsShareParams, _stream: Dict): void {}

function _readSecurityFromStreamSettings(_params: SsShareParams, _stream: Dict): void {}

function readSsEndpoint(outbound: Dict): {
    address: string;
    port: number;
    method: string;
    password: string;
} {
    const settings = asDict(outbound.settings);
    const servers = Array.isArray(settings.servers) ? settings.servers : [];
    const server = asDict(servers[0]);

    if (server) {
        const address = stringOrUndefined(server.address);
        const port = Number(server.port);
        const method = stringOrUndefined(server.method);
        const password = stringOrUndefined(server.password);

        assertNonEmpty(address, "settings.servers[0].address");
        assertValidPort(port);
        assertNonEmpty(method, "settings.servers[0].method");
        assertNonEmpty(password, "settings.servers[0].password");

        return { address, port, method, password };
    }

    // 兼容某些简化结构：settings.address / settings.port / settings.method / settings.password
    const address = stringOrUndefined(settings.address);
    const port = Number(settings.port);
    const method = stringOrUndefined(settings.method);
    const password = stringOrUndefined(settings.password);

    assertNonEmpty(address, "settings.address");
    assertValidPort(port);
    assertNonEmpty(method, "settings.method");
    assertNonEmpty(password, "settings.password");

    return { address, port, method, password };
}

function decodeSsBase64(b64: string): string {
    // 兼容 URL-safe base64
    let normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
    // 补全 padding
    const remainder = normalized.length % 4;
    if (remainder) {
        normalized += "=".repeat(4 - remainder);
    }
    try {
        return atob(normalized);
    } catch {
        throw new Error("base64 解码失败");
    }
}

function encodeSsBase64(str: string): string {
    return btoa(str);
}

function _shareTypeToXrayNetwork(_type: string, _preferRaw: boolean): string {
  return _preferRaw ? "raw" : "tcp";
}

function _xrayNetworkToShareType(_network: string): string {
  return "tcp";
}

function assignString<K extends keyof SsShareParams>(
    target: SsShareParams,
    key: K,
    value: string | undefined,
    allowEmpty = false,
): void {
    if (value === undefined) return;
    if (!allowEmpty && value === "") return;
    (target[key] as unknown) = value;
}

function _assignNumber<K extends keyof SsShareParams>(
    target: SsShareParams,
    key: K,
    value: string | undefined,
): void {
    if (value === undefined || value === "") return;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${String(key)} 必须是数字`);
    (target[key] as unknown) = n;
}
