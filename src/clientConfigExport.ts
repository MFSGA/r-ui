import { x25519 } from '@noble/curves/ed25519.js';
import type { XrayConfig } from './schema';
import { formatShareLink, outboundToShare } from './utils/multi-protocol-share';

type Dict = Record<string, unknown>;

export function createClientConfigFromInbound(
  config: XrayConfig,
  inboundTag: string,
  serverAddress: string,
): XrayConfig {
  const inbound = findInbound(config, inboundTag);
  const client = readFirstClient(inbound);
  const reality = readRealitySettings(inbound);
  const port = readPort(inbound);
  const publicKey =
    readString(reality.publicKey) ??
    deriveRealityPublicKey(readRequiredString(reality.privateKey, 'privateKey'));
  const serverName =
    readFirstStringArrayItem(reality.serverNames) ?? readString(reality.serverName);
  const shortId = readFirstStringArrayItem(reality.shortIds) ?? readString(reality.shortId);

  if (!serverName) {
    throw new Error('Reality serverNames 不可为空');
  }

  if (!shortId) {
    throw new Error('Reality shortIds 不可为空');
  }

  return {
    log: config.log ?? {
      loglevel: 'warning',
    },
    dns: config.dns,
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        {
          type: 'field',
          ip: ['geoip:private'],
          outboundTag: 'direct',
        },
        {
          type: 'field',
          protocol: ['bittorrent'],
          outboundTag: 'blocked',
        },
      ],
    },
    inbounds: [
      {
        listen: '127.0.0.1',
        port: 10808,
        protocol: 'socks',
        tag: 'socks-in',
        settings: {
          auth: 'noauth',
          udp: true,
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls'],
        },
      },
      {
        listen: '127.0.0.1',
        port: 10809,
        protocol: 'http',
        tag: 'http-in',
        settings: {
          timeout: 300,
        },
      },
    ],
    outbounds: [
      {
        protocol: 'vless',
        tag: 'proxy',
        settings: {
          vnext: [
            {
              address: serverAddress,
              port,
              users: [
                {
                  id: readRequiredString(client.id, 'client id'),
                  encryption: 'none',
                  ...(readString(client.flow) ? { flow: readString(client.flow) } : {}),
                },
              ],
            },
          ],
        },
        streamSettings: {
          network: 'tcp',
          security: 'reality',
          realitySettings: {
            fingerprint: readString(reality.fingerprint) ?? 'chrome',
            publicKey,
            serverName,
            shortId,
            spiderX: readString(reality.spiderX) ?? '/',
          },
          rawSettings: {
            acceptProxyProtocol: false,
            header: {
              type: 'none',
            },
          },
        },
      },
      {
        protocol: 'freedom',
        tag: 'direct',
        settings: {},
      },
      {
        protocol: 'blackhole',
        tag: 'blocked',
        settings: {
          response: {
            type: 'http',
          },
        },
      },
    ],
  };
}

export function createClientShareLinkFromInbound(
  config: XrayConfig,
  inboundTag: string,
  serverAddress: string,
): string {
  const clientConfig = createClientConfigFromInbound(config, inboundTag, serverAddress);
  const outbounds = Array.isArray(clientConfig.outbounds) ? clientConfig.outbounds : [];
  const proxyOutbound = outbounds.find(
    (outbound): outbound is Dict => isDict(outbound) && outbound.protocol === 'vless',
  );

  if (!proxyOutbound) {
    throw new Error('未找到客户端 VLESS 出站配置');
  }

  return formatShareLink(outboundToShare(proxyOutbound, { name: inboundTag }));
}

export function createClientShareLinksFromInbounds(
  config: XrayConfig,
  serverAddress: string,
): string[] {
  const inbounds = Array.isArray(config.inbounds) ? config.inbounds : [];
  const tags = inbounds
    .filter(
      (inbound): inbound is Dict =>
        isDict(inbound) &&
        inbound.protocol === 'vless' &&
        readString(inbound.tag) !== undefined &&
        asDict(inbound.streamSettings).security === 'reality',
    )
    .map((inbound) => readRequiredString(inbound.tag, 'inbound tag'));

  if (!tags.length) {
    throw new Error('未找到可导出的 VLESS Reality 入站');
  }

  return tags.map((tag) => createClientShareLinkFromInbound(config, tag, serverAddress));
}

function findInbound(config: XrayConfig, inboundTag: string): Dict {
  const inbounds = Array.isArray(config.inbounds) ? config.inbounds : [];
  const inbound = inbounds.find(
    (item): item is Dict => isDict(item) && item.protocol === 'vless' && item.tag === inboundTag,
  );

  if (!inbound) {
    throw new Error(`未找到 ${inboundTag}`);
  }

  return inbound;
}

function readFirstClient(inbound: Dict): Dict {
  const settings = asDict(inbound.settings);
  const clients = Array.isArray(settings.clients) ? settings.clients : [];
  const client = clients.find(isDict);

  if (!client) {
    throw new Error('VLESS clients 不可为空');
  }

  return client;
}

function readRealitySettings(inbound: Dict): Dict {
  const streamSettings = asDict(inbound.streamSettings);

  if (streamSettings.security !== 'reality') {
    throw new Error('当前入站不是 Reality 配置');
  }

  const realitySettings = asDict(streamSettings.realitySettings);

  if (!Object.keys(realitySettings).length) {
    throw new Error('realitySettings 不可为空');
  }

  return realitySettings;
}

function readPort(inbound: Dict): number {
  const port = inbound.port;

  if (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('入站端口必须是 1 到 65535 的整数');
  }

  return Number(port);
}

function deriveRealityPublicKey(privateKey: string): string {
  return encodeBase64Url(x25519.getPublicKey(decodeBase64Url(privateKey)));
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function asDict(value: unknown): Dict {
  return isDict(value) ? value : {};
}

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readRequiredString(value: unknown, name: string): string {
  const result = readString(value);

  if (!result) {
    throw new Error(`${name} 不可为空`);
  }

  return result;
}

function readFirstStringArrayItem(value: unknown): string | undefined {
  return Array.isArray(value) ? value.find((item) => typeof item === 'string' && item) : undefined;
}
