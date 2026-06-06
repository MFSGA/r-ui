/* share-utils.ts - Shared helper functions for share link utilities */

export type Dict<T = unknown> = Record<string, T>;

export function assertNonEmpty(value: unknown, name: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${name} 不可省略或为空`);
    }
}

export function assertValidPort(port: unknown): asserts port is number {
    if (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error("remote-port 必须是 1 到 65535 的整数");
    }
}

export function asDict(value: unknown): Dict {
    return value && typeof value === "object" ? (value as Dict) : {};
}

export function stringOrUndefined(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numberOrUndefined(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseJsonMaybe(value: string): unknown {
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

export function stringifyMaybe(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}

export function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

export function decodeUriPart(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        throw new Error(`URL 编码非法: ${value}`);
    }
}

export function stripIpv6Brackets(host: string): string {
    if (host.startsWith("[") && host.endsWith("]")) {
        return host.slice(1, -1);
    }
    return host;
}

export function formatHostForUri(host: string): string {
    const ascii = toAsciiHost(stripIpv6Brackets(host.trim()));
    return ascii.includes(":") && !ascii.startsWith("[") ? `[${ascii}]` : ascii;
}

export function toAsciiHost(host: string): string {
    if (host.includes(":")) return host; // IPv6
    try {
        return new URL(`http://${host}`).hostname;
    } catch {
        return host;
    }
}
