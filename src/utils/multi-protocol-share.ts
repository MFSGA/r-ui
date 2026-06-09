/* multi-protocol-share.ts - Unified dispatch layer for VMess/Trojan/Shadowsocks/Hysteria2/VLESS share links */

import {
  parseVmessShareLink,
  formatVmessShareLink,
  vmessShareToXrayOutbound,
  outboundToVmessShare,
  importVmessShareToXrayConfig,
} from './vmess-share';
import type { VmessShare, XrayOutbound as VmessOutbound } from './vmess-share';

import {
  parseTrojanShareLink,
  formatTrojanShareLink,
  trojanShareToXrayOutbound,
  outboundToTrojanShare,
  importTrojanShareToXrayConfig,
} from './trojan-share';
import type { TrojanShare, XrayOutbound as TrojanOutbound } from './trojan-share';

import {
  parseShadowsocksShareLink,
  formatShadowsocksShareLink,
  shadowsocksShareToXrayOutbound,
  outboundToShadowsocksShare,
  importShadowsocksShareToXrayConfig,
} from './shadowsocks-share';
import type { SsShare, XrayOutbound as SsOutbound } from './shadowsocks-share';

import {
  parseHy2ShareLink,
  formatHy2ShareLink,
  hy2ShareToXrayOutbound,
  outboundToHy2Share,
  importHy2ShareToXrayConfig,
} from './hysteria2-share';
import type { Hy2Share, XrayOutbound as Hy2Outbound } from './hysteria2-share';

import {
  parseVlessShareLink,
  formatVlessShareLink,
  vlessShareToXrayOutbound,
  outboundToVlessShare,
  importVlessShareToXrayConfig,
} from './vless-share';
import type { VlessShare, XrayOutbound as VlessOutbound } from './vless-share';

/* ---------- shared types ---------- */

export type ShareProtocol = 'vmess' | 'trojan' | 'shadowsocks' | 'hysteria2' | 'vless';

export type ParsedShare =
  | { protocol: 'vmess'; data: VmessShare }
  | { protocol: 'trojan'; data: TrojanShare }
  | { protocol: 'shadowsocks'; data: SsShare }
  | { protocol: 'hysteria2'; data: Hy2Share }
  | { protocol: 'vless'; data: VlessShare };

export type AnyXrayOutbound = VmessOutbound | TrojanOutbound | SsOutbound | Hy2Outbound | VlessOutbound;

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
  preferRawNetwork?: boolean;
}

export interface ImportOptions extends ToXrayOptions {
  mode?: 'append' | 'replaceByTag' | 'replaceFirstVmess' | 'replaceFirstTrojan' | 'replaceFirstShadowsocks' | 'replaceFirstHysteria2' | 'replaceFirst';
}

export interface ExportOptions extends FormatOptions {
  tag?: string | string[];
  useTagAsName?: boolean;
}

/* ---------- protocol detection ---------- */

export function detectProtocol(link: string): ShareProtocol | 'vless' | 'unknown' {
  const trimmed = link.trim();

  if (trimmed.startsWith('vmess://')) return 'vmess';
  if (trimmed.startsWith('trojan://')) return 'trojan';
  if (trimmed.startsWith('ss://')) return 'shadowsocks';
  if (trimmed.startsWith('hysteria2://')) return 'hysteria2';
  if (trimmed.startsWith('hy2://')) return 'hysteria2';
  if (trimmed.startsWith('vless://')) return 'vless';

  return 'unknown';
}

/* ---------- unified parse ---------- */

export function parseShareLink(rawLink: string, options: ParseOptions = {}): ParsedShare {
  const trimmed = rawLink.trim();

  if (trimmed.startsWith('vmess://')) {
    const data = parseVmessShareLink(rawLink, options);
    return { protocol: 'vmess', data };
  }

  if (trimmed.startsWith('trojan://')) {
    const data = parseTrojanShareLink(rawLink, options);
    return { protocol: 'trojan', data };
  }

  if (trimmed.startsWith('ss://')) {
    const data = parseShadowsocksShareLink(rawLink, options);
    return { protocol: 'shadowsocks', data };
  }

  if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) {
    const data = parseHy2ShareLink(rawLink, options);
    return { protocol: 'hysteria2', data };
  }

  if (trimmed.startsWith('vless://')) {
    const data = parseVlessShareLink(rawLink, options);
    return { protocol: 'vless', data };
  }

  throw new Error('不支持的分享链接协议，仅支持 vmess://、trojan://、ss://、hysteria2://、hy2://、vless://');
}

/* ---------- unified format ---------- */

export function formatShareLink(
  share: ParsedShare,
  options: FormatOptions = {},
): string {
  switch (share.protocol) {
    case 'vmess':
      return formatVmessShareLink(share.data, options);
    case 'trojan':
      return formatTrojanShareLink(share.data, options);
    case 'shadowsocks':
      return formatShadowsocksShareLink(share.data, options);
    case 'hysteria2':
      return formatHy2ShareLink(share.data, options);
    case 'vless':
      return formatVlessShareLink(share.data, options);
  }
}

/* ---------- unified to Xray outbound ---------- */

export function shareToXrayOutbound(
  input: string | ParsedShare,
  options: ToXrayOptions = {},
): AnyXrayOutbound {
  if (typeof input === 'string') {
    const parsed = parseShareLink(input, options);
    return shareToXrayOutbound(parsed, options);
  }

  switch (input.protocol) {
    case 'vmess':
      return vmessShareToXrayOutbound(input.data, options);
    case 'trojan':
      return trojanShareToXrayOutbound(input.data, options);
    case 'shadowsocks':
      return shadowsocksShareToXrayOutbound(input.data, options);
    case 'hysteria2':
      return hy2ShareToXrayOutbound(input.data, options);
    case 'vless':
      return vlessShareToXrayOutbound(input.data, options);
  }
}

/* ---------- unified outbound to share ---------- */

export function outboundToShare(
  outbound: Record<string, unknown>,
  options: { name?: string; strict?: boolean } = {},
): ParsedShare {
  const protocol = String(outbound.protocol ?? '');

  if (protocol === 'vmess') {
    const data = outboundToVmessShare(outbound, options);
    return { protocol: 'vmess', data };
  }

  if (protocol === 'trojan') {
    const data = outboundToTrojanShare(outbound, options);
    return { protocol: 'trojan', data };
  }

  if (protocol === 'shadowsocks') {
    const data = outboundToShadowsocksShare(outbound, options);
    return { protocol: 'shadowsocks', data };
  }

  if (protocol === 'hysteria') {
    const data = outboundToHy2Share(outbound, options);
    return { protocol: 'hysteria2', data };
  }

  if (protocol === 'vless') {
    const data = outboundToVlessShare(outbound, options);
    return { protocol: 'vless', data };
  }

  throw new Error(`不支持的协议: ${protocol}`);
}

/* ---------- unified import ---------- */

function narrowVmessMode(mode: ImportOptions['mode']): import('./vmess-share').ImportOptions['mode'] {
  if (mode === 'replaceFirst') return 'replaceFirstVmess';
  if (mode === 'append' || mode === 'replaceByTag') return mode;
  return undefined;
}

function narrowTrojanMode(mode: ImportOptions['mode']): import('./trojan-share').ImportOptions['mode'] {
  if (mode === 'replaceFirst') return 'replaceFirstTrojan';
  if (mode === 'append' || mode === 'replaceByTag') return mode;
  return undefined;
}

function narrowShadowsocksMode(mode: ImportOptions['mode']): import('./shadowsocks-share').ImportOptions['mode'] {
  if (mode === 'replaceFirst') return 'replaceFirstShadowsocks';
  if (mode === 'append' || mode === 'replaceByTag') return mode;
  return undefined;
}

function narrowHysteria2Mode(mode: ImportOptions['mode']): import('./hysteria2-share').ImportOptions['mode'] {
  if (mode === 'replaceFirst') return 'replaceFirstHysteria2';
  if (mode === 'append' || mode === 'replaceByTag') return mode;
  return undefined;
}

function narrowVlessMode(mode: ImportOptions['mode']): import('./vless-share').ImportOptions['mode'] {
  if (mode === 'replaceFirst') return 'replaceFirstVless';
  if (mode === 'append' || mode === 'replaceByTag') return mode;
  return undefined;
}

export function importShareToXrayConfig(
  config: Record<string, unknown>,
  link: string | ParsedShare,
  options: ImportOptions = {},
): Record<string, unknown> {
  const parsed = typeof link === 'string' ? parseShareLink(link, options) : link;

  switch (parsed.protocol) {
    case 'vmess':
      return importVmessShareToXrayConfig(
        config,
        parsed.data,
        { ...options, mode: narrowVmessMode(options.mode) },
      );
    case 'trojan':
      return importTrojanShareToXrayConfig(
        config,
        parsed.data,
        { ...options, mode: narrowTrojanMode(options.mode) },
      );
    case 'shadowsocks':
      return importShadowsocksShareToXrayConfig(
        config,
        parsed.data,
        { ...options, mode: narrowShadowsocksMode(options.mode) },
      );
    case 'hysteria2':
      return importHy2ShareToXrayConfig(
        config,
        parsed.data,
        { ...options, mode: narrowHysteria2Mode(options.mode) },
      );
    case 'vless':
      return importVlessShareToXrayConfig(
        config,
        parsed.data,
        { ...options, mode: narrowVlessMode(options.mode) },
      );
  }
}

export function importShareToXrayConfigJson(
  configJson: string,
  link: string | ParsedShare,
  options: ImportOptions = {},
): string {
  const config = configJson.trim() ? JSON.parse(configJson) : {};
  const next = importShareToXrayConfig(config, link, options);
  return JSON.stringify(next, null, 2);
}

/* ---------- unified export ---------- */

export function exportLinksFromXrayConfig(
  config: Record<string, unknown>,
  options: ExportOptions = {},
): string[] {
  // maintain original outbound order by extracting indices
  const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
  const links: Array<{ index: number; link: string }> = [];

  outbounds.forEach((outbound, index) => {
    if (!outbound) return;
    const protocol = String(outbound.protocol ?? '');

    try {
      if (protocol === 'vmess') {
        const share = outboundToVmessShare(outbound, { strict: options.strict ?? true });
        const link = formatVmessShareLink(share, { strict: options.strict ?? true, omitDefaults: options.omitDefaults ?? false });
        links.push({ index, link });
      } else if (protocol === 'trojan') {
        const share = outboundToTrojanShare(outbound, { strict: options.strict ?? true });
        const link = formatTrojanShareLink(share, { strict: options.strict ?? true, omitDefaults: options.omitDefaults ?? false });
        links.push({ index, link });
      } else if (protocol === 'shadowsocks') {
        const share = outboundToShadowsocksShare(outbound, { strict: options.strict ?? true });
        const link = formatShadowsocksShareLink(share, { strict: options.strict ?? true, omitDefaults: options.omitDefaults ?? false });
        links.push({ index, link });
      } else if (protocol === 'hysteria') {
        const share = outboundToHy2Share(outbound, { strict: options.strict ?? true });
        const link = formatHy2ShareLink(share, { strict: options.strict ?? true, omitDefaults: options.omitDefaults ?? false });
        links.push({ index, link });
      } else if (protocol === 'vless') {
        const share = outboundToVlessShare(outbound, { strict: options.strict ?? true });
        const link = formatVlessShareLink(share, { strict: options.strict ?? true, omitDefaults: options.omitDefaults ?? false });
        links.push({ index, link });
      }
    } catch {
      // skip outbounds that fail conversion
    }
  });

  return links.sort((a, b) => a.index - b.index).map((l) => l.link);
}

export function exportLinksFromXrayConfigJson(
  configJson: string,
  options: ExportOptions = {},
): string[] {
  return exportLinksFromXrayConfig(JSON.parse(configJson), options);
}
