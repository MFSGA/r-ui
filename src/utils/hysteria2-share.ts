/* hysteria2-share.ts */

type Dict<T = unknown> = Record<string, T>;

export type Hy2ObfsType = "salamander" | "gecko";

export interface Hy2ShareParams {
    obfs?: Hy2ObfsType;
    obfsPassword?: string;
    sni?: string;
    insecure?: boolean;
    pinSHA256?: string;
    // bandwidth
    up?: string;   // e.g. "100mbps"
    down?: string; // e.g. "100mbps"
    // port hopping
    portHopping?: string; // e.g. "443,5000-6000"
    hopInterval?: number; // seconds
    // quic tuning
    initStreamReceiveWindow?: number;
    maxStreamReceiveWindow?: number;
    initConnReceiveWindow?: number;
    maxConnReceiveWindow?: number;
    maxIdleTimeout?: number;
    keepAlivePeriod?: number;
    // congestion control
    congestion?: "bbr" | "cubic" | "reno" | "brutal";
    // advanced
    disablePathMTUDiscovery?: boolean;
    // extra
    fm?: string;
}

export interface Hy2Share {
    auth: string;     // password in userinfo
    address: string;
    port: number;
    name?: string;
    params: Hy2ShareParams;
    extraParams?: Record<string, string>;
}

export interface XrayOutbound {
    protocol: "hysteria";
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
     * Maintain interface compatibility (hysteria does not use preferRawNetwork).
     */
    preferRawNetwork?: boolean;
}

export interface ImportOptions extends ToXrayOptions {
    mode?: "append" | "replaceByTag" | "replaceFirstHysteria2";
}

export interface ExportOptions extends FormatOptions {
    tag?: string | string[];
    useTagAsName?: boolean;
}

const KNOWN_QUERY_KEYS = new Set([
    "obfs",
    "obfs-password",
    "sni",
    "insecure",
    "pinSHA256",
    "up",
    "down",
    "portHopping",
    "hopInterval",
    "congestion",
    "initStreamReceiveWindow",
    "maxStreamReceiveWindow",
    "initConnReceiveWindow",
    "maxConnReceiveWindow",
    "maxIdleTimeout",
    "keepAlivePeriod",
    "disablePathMTUDiscovery",
    "fm",
]);

const CONGESTIONS = new Set(["bbr", "cubic", "reno", "brutal"]);
const OBFS_TYPES = new Set(["salamander", "gecko"]);

export function parseHy2ShareLink(
    rawLink: string,
    options: ParseOptions = {},
): Hy2Share {
    const strict = options.strict ?? true;

    let url: URL;
    try {
        url = new URL(rawLink);
    } catch {
        throw new Error("不是合法 URL");
    }

    if (url.protocol !== "hysteria2:" && url.protocol !== "hy2:") {
        throw new Error(`协议必须是 hysteria2 或 hy2，实际为 ${url.protocol}`);
    }

    const auth = decodeUriPart(url.username || url.password);
    const address = stripIpv6Brackets(url.hostname);
    const port = url.port ? Number(url.port) : 443;
    const name = url.hash ? decodeUriPart(url.hash.slice(1)) : undefined;

    assertNonEmpty(auth, "auth");
    assertNonEmpty(address, "remote-host");
    assertValidPort(port);

    const rawParams = parseRawQuery(url.search.startsWith("?") ? url.search.slice(1) : "");

    const params: Hy2ShareParams = {};

    // obfs
    if (rawParams.obfs !== undefined) {
        params.obfs = rawParams.obfs as Hy2ObfsType;
    }
    if (rawParams["obfs-password"] !== undefined) {
        params.obfsPassword = rawParams["obfs-password"];
    }

    // tls / general
    assignString(params, "sni", rawParams.sni);
    if (rawParams.insecure !== undefined) {
        params.insecure = rawParams.insecure === "1";
    }
    assignString(params, "pinSHA256", rawParams.pinSHA256);

    // bandwidth
    assignString(params, "up", rawParams.up);
    assignString(params, "down", rawParams.down);

    // port hopping
    assignString(params, "portHopping", rawParams.portHopping);
    assignNumber(params, "hopInterval", rawParams.hopInterval);

    // quic tuning
    assignNumber(params, "initStreamReceiveWindow", rawParams.initStreamReceiveWindow);
    assignNumber(params, "maxStreamReceiveWindow", rawParams.maxStreamReceiveWindow);
    assignNumber(params, "initConnReceiveWindow", rawParams.initConnReceiveWindow);
    assignNumber(params, "maxConnReceiveWindow", rawParams.maxConnReceiveWindow);
    assignNumber(params, "maxIdleTimeout", rawParams.maxIdleTimeout);
    assignNumber(params, "keepAlivePeriod", rawParams.keepAlivePeriod);

    // congestion
    assignString(params, "congestion", rawParams.congestion);

    // advanced
    if (rawParams.disablePathMTUDiscovery !== undefined) {
        params.disablePathMTUDiscovery = rawParams.disablePathMTUDiscovery === "1";
    }

    // extra
    assignString(params, "fm", rawParams.fm);

    const extraParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawParams)) {
        if (!KNOWN_QUERY_KEYS.has(key)) extraParams[key] = value;
    }

    const share: Hy2Share = { auth, address, port, name, params, extraParams };
    validateShare(share, strict);

    return share;
}

export function formatHy2ShareLink(
    share: Hy2Share,
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

    add("obfs", p.obfs);
    add("obfs-password", p.obfsPassword);
    add("sni", p.sni);

    if (p.insecure !== undefined) {
        add("insecure", p.insecure ? "1" : "0", "0");
    }

    add("pinSHA256", p.pinSHA256);
    add("up", p.up);
    add("down", p.down);
    add("portHopping", p.portHopping);
    add("hopInterval", p.hopInterval);
    add("congestion", p.congestion);
    add("initStreamReceiveWindow", p.initStreamReceiveWindow);
    add("maxStreamReceiveWindow", p.maxStreamReceiveWindow);
    add("initConnReceiveWindow", p.initConnReceiveWindow);
    add("maxConnReceiveWindow", p.maxConnReceiveWindow);
    add("maxIdleTimeout", p.maxIdleTimeout);
    add("keepAlivePeriod", p.keepAlivePeriod);

    if (p.disablePathMTUDiscovery !== undefined) {
        add("disablePathMTUDiscovery", p.disablePathMTUDiscovery ? "1" : "0", "0");
    }

    add("fm", p.fm);

    for (const [key, value] of Object.entries(share.extraParams ?? {})) {
        if (!KNOWN_QUERY_KEYS.has(key)) add(key, value);
    }

    const query = pairs
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    const host = formatHostForUri(share.address);
    const fragment = share.name ? `#${encodeURIComponent(share.name)}` : "";

    const defaultPort = 443;
    const portStr = omitDefaults && share.port === defaultPort ? "" : `:${share.port}`;

    return `hysteria2://${encodeURIComponent(share.auth)}@${host}${portStr}${query ? `?${query}` : ""}${fragment}`;
}

export function hy2ShareToXrayOutbound(
    input: string | Hy2Share,
    options: ToXrayOptions = {},
): XrayOutbound {
    const strict = options.strict ?? true;
    const share = typeof input === "string" ? parseHy2ShareLink(input, { strict }) : input;

    validateShare(share, strict);

    const p = share.params;

    const settings: Dict = {
        version: 2,
        address: share.address,
        port: share.port,
    };

    const streamSettings: Dict = {
        network: "hysteria",
    };

    // Build tlsSettings and determine security
    let tlsSettings: Dict | undefined;
    const useTls = true;

    if (useTls) {
        tlsSettings = {};

        if (p.sni) {
            tlsSettings.serverName = p.sni;
        } else {
            tlsSettings.serverName = share.address;
        }

        tlsSettings.alpn = ["h3"];

        tlsSettings.allowInsecure = Boolean(p.insecure);

        if (p.pinSHA256) {
            tlsSettings.pinnedPeerCertSha256 = p.pinSHA256;
        }
    }

    streamSettings.security = useTls ? "tls" : "none";
    if (tlsSettings) {
        streamSettings.tlsSettings = tlsSettings;
    }

    // Build hysteriaSettings
    const hysteriaSettings: Dict = {
        version: 2,
        auth: share.auth,
    };

    if (p.congestion) hysteriaSettings.congestion = p.congestion;
    if (p.up) hysteriaSettings.up = p.up;
    if (p.down) hysteriaSettings.down = p.down;

    if (p.portHopping) {
        hysteriaSettings.udphop = {
            port: p.portHopping,
            interval: p.hopInterval ?? 30,
        };
    }

    if (p.initStreamReceiveWindow !== undefined) hysteriaSettings.initStreamReceiveWindow = p.initStreamReceiveWindow;
    if (p.maxStreamReceiveWindow !== undefined) hysteriaSettings.maxStreamReceiveWindow = p.maxStreamReceiveWindow;
    if (p.initConnReceiveWindow !== undefined) hysteriaSettings.initConnReceiveWindow = p.initConnReceiveWindow;
    if (p.maxConnReceiveWindow !== undefined) hysteriaSettings.maxConnReceiveWindow = p.maxConnReceiveWindow;
    if (p.maxIdleTimeout !== undefined) hysteriaSettings.maxIdleTimeout = p.maxIdleTimeout;
    if (p.keepAlivePeriod !== undefined) hysteriaSettings.keepAlivePeriod = p.keepAlivePeriod;
    if (p.disablePathMTUDiscovery) hysteriaSettings.disablePathMTUDiscovery = true;

    streamSettings.hysteriaSettings = hysteriaSettings;

    // Obfs via udpmasks
    if (p.obfs === "salamander" || p.obfs === "gecko") {
        const maskSettings: Dict = {};
        if (p.obfsPassword !== undefined) maskSettings.password = p.obfsPassword;

        streamSettings.udpmasks = [
            {
                type: p.obfs,
                settings: maskSettings,
            },
        ];
    }

    if (p.fm !== undefined) {
        streamSettings.finalmask = parseJsonMaybe(p.fm);
    }

    const outbound: XrayOutbound = {
        protocol: "hysteria",
        settings,
        streamSettings,
    };

    const tag = options.tag ?? share.name;
    if (tag) outbound.tag = tag;

    return outbound;
}

export function outboundToHy2Share(
    outbound: Dict,
    options: { name?: string; strict?: boolean } = {},
): Hy2Share {
    if ((outbound.protocol as string) !== "hysteria") {
        throw new Error("outbound.protocol 必须是 hysteria");
    }

    const settings = asDict(outbound.settings);
    const streamSettings = asDict(outbound.streamSettings);

    const address = stringOrUndefined(settings.address);
    const port = Number(settings.port);

    assertNonEmpty(address, "settings.address");
    assertValidPort(port);

    const hys = asDict(streamSettings.hysteriaSettings);
    const auth = stringOrUndefined(hys.auth);
    assertNonEmpty(auth, "streamSettings.hysteriaSettings.auth");

    const security = stringOrUndefined(streamSettings.security) ?? "none";
    const tls = security === "tls" ? asDict(streamSettings.tlsSettings) : {};
    const udpmasks = streamSettings.udpmasks;
    const udpmask = Array.isArray(udpmasks) ? asDict(udpmasks[0]) : undefined;

    const params: Hy2ShareParams = {};

    // Read from tlsSettings
    params.sni = stringOrUndefined(tls.serverName);
    if (tls.allowInsecure === true) params.insecure = true;
    params.pinSHA256 = stringOrUndefined(tls.pinnedPeerCertSha256);

    // Read from hysteriaSettings
    params.congestion = stringOrUndefined(hys.congestion) as Hy2ShareParams["congestion"];
    params.up = stringOrUndefined(hys.up);
    params.down = stringOrUndefined(hys.down);

    const udphop = asDict(hys.udphop);
    if (udphop.port !== undefined) {
        params.portHopping = String(udphop.port);
    }
    if (udphop.interval !== undefined) {
        const n = Number(udphop.interval);
        if (Number.isFinite(n)) params.hopInterval = n;
    }

    params.initStreamReceiveWindow = numberOrUndefined(hys.initStreamReceiveWindow);
    params.maxStreamReceiveWindow = numberOrUndefined(hys.maxStreamReceiveWindow);
    params.initConnReceiveWindow = numberOrUndefined(hys.initConnReceiveWindow);
    params.maxConnReceiveWindow = numberOrUndefined(hys.maxConnReceiveWindow);
    params.maxIdleTimeout = numberOrUndefined(hys.maxIdleTimeout);
    params.keepAlivePeriod = numberOrUndefined(hys.keepAlivePeriod);

    if (hys.disablePathMTUDiscovery === true) {
        params.disablePathMTUDiscovery = true;
    }

    // Read obfs from udpmasks
    if (udpmask) {
        const maskType = stringOrUndefined(udpmask.type);
        if (maskType === "salamander" || maskType === "gecko") {
            params.obfs = maskType as Hy2ObfsType;
            const maskSettings = asDict(udpmask.settings);
            params.obfsPassword = stringOrUndefined(maskSettings.password);
        }
    }

    const finalmask = streamSettings.finalmask;
    if (finalmask !== undefined) {
        params.fm = stringifyMaybe(finalmask);
    }

    const share: Hy2Share = {
        auth,
        address,
        port,
        name: options.name ?? stringOrUndefined(outbound.tag),
        params,
    };

    validateShare(share, options.strict ?? true);
    return share;
}

export function importHy2ShareToXrayConfig(
    config: Dict,
    link: string | Hy2Share,
    options: ImportOptions = {},
): Dict {
    const next = deepClone(config ?? {});
    const outbound = hy2ShareToXrayOutbound(link, options);

    const outbounds = Array.isArray(next.outbounds) ? [...next.outbounds] : [];
    const mode = options.mode ?? "append";

    if (mode === "append") {
        outbounds.push(outbound);
    } else if (mode === "replaceByTag") {
        if (!outbound.tag) throw new Error("replaceByTag 需要提供 tag 或链接 name");
        const index = outbounds.findIndex((item) => item?.tag === outbound.tag);
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else if (mode === "replaceFirstHysteria2") {
        const index = outbounds.findIndex((item) => item?.protocol === "hysteria");
        if (index >= 0) outbounds[index] = outbound;
        else outbounds.push(outbound);
    } else {
        throw new Error(`未知导入模式: ${mode}`);
    }

    next.outbounds = outbounds;
    return next;
}

export function importHy2ShareToXrayConfigJson(
    configJson: string,
    link: string | Hy2Share,
    options: ImportOptions = {},
): string {
    const config = configJson.trim() ? JSON.parse(configJson) : {};
    const next = importHy2ShareToXrayConfig(config, link, options);
    return JSON.stringify(next, null, 2);
}

export function exportHy2LinksFromXrayConfig(
    config: Dict,
    options: ExportOptions = {},
): string[] {
    const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
    const tagFilter =
        options.tag === undefined
            ? undefined
            : new Set(Array.isArray(options.tag) ? options.tag : [options.tag]);

    return outbounds
        .filter((outbound) => outbound?.protocol === "hysteria")
        .filter((outbound) => !tagFilter || tagFilter.has(String(outbound.tag)))
        .map((outbound) => {
            const name = options.useTagAsName === false ? undefined : stringOrUndefined(outbound.tag);
            const share = outboundToHy2Share(outbound, {
                name,
                strict: options.strict ?? true,
            });

            return formatHy2ShareLink(share, {
                strict: options.strict ?? true,
                omitDefaults: options.omitDefaults ?? false,
            });
        });
}

export function exportHy2LinksFromXrayConfigJson(
    configJson: string,
    options: ExportOptions = {},
): string[] {
    return exportHy2LinksFromXrayConfig(JSON.parse(configJson), options);
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

function validateShare(share: Hy2Share, strict: boolean): void {
    assertNonEmpty(share.auth, "auth");
    assertNonEmpty(share.address, "remote-host");
    assertValidPort(share.port);

    const p = share.params;

    if (p.obfs !== undefined) {
        if (strict && !OBFS_TYPES.has(p.obfs)) {
            throw new Error(`不支持的 obfs 类型: ${p.obfs}`);
        }
    }

    if (p.congestion !== undefined) {
        if (strict && !CONGESTIONS.has(p.congestion)) {
            throw new Error(`不支持的 congestion: ${p.congestion}`);
        }
    }

    if (p.sni === "") throw new Error("sni 不可为空字符串");
    if (p.obfsPassword === "") throw new Error("obfs-password 不可为空字符串");
    if (p.pinSHA256 === "") throw new Error("pinSHA256 不可为空字符串");
    if (p.up === "") throw new Error("up 不可为空字符串");
    if (p.down === "") throw new Error("down 不可为空字符串");
    if (p.portHopping === "") throw new Error("portHopping 不可为空字符串");
}

function assignString<K extends keyof Hy2ShareParams>(
    target: Hy2ShareParams,
    key: K,
    value: string | undefined,
    allowEmpty = false,
): void {
    if (value === undefined) return;
    if (!allowEmpty && value === "") return;
    (target[key] as unknown) = value;
}

function assignNumber<K extends keyof Hy2ShareParams>(
    target: Hy2ShareParams,
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
