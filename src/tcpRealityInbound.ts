import { generateRealityKeyPair } from './realityKeys';

type Dict = Record<string, unknown>;

const DEFAULT_LISTEN = '0.0.0.0';
const DEFAULT_TARGET = 'www.microsoft.com';
const DEFAULT_START_PORT = 33300;

export function createTcpRealityInbound(existingInbounds: unknown[] = []) {
  const port = findNextAvailablePort(existingInbounds, DEFAULT_START_PORT);
  const keyPair = generateRealityKeyPair();

  return {
    listen: DEFAULT_LISTEN,
    port,
    protocol: 'vless',
    settings: {
      clients: [
        {
          email: createRandomHex(4),
          flow: 'xtls-rprx-vision',
          id: createUuid(),
        },
      ],
      decryption: 'none',
    },
    sniffing: {
      destOverride: ['http', 'tls', 'quic', 'fakedns'],
      enabled: false,
      metadataOnly: false,
      routeOnly: false,
    },
    streamSettings: {
      network: 'tcp',
      realitySettings: {
        maxClientVer: '',
        maxTimeDiff: 0,
        minClientVer: '',
        mldsa65Seed: '',
        privateKey: keyPair.privateKey,
        serverNames: [DEFAULT_TARGET],
        shortIds: [createRandomHex(8)],
        show: false,
        target: `${DEFAULT_TARGET}:443`,
        xver: 0,
      },
      security: 'reality',
      rawSettings: {
        acceptProxyProtocol: false,
        header: {
          type: 'none',
        },
      },
    },
    tag: createUniqueTag(existingInbounds, port),
  };
}

function findNextAvailablePort(existingInbounds: unknown[], startPort: number) {
  const usedPorts = new Set(
    existingInbounds
      .map((inbound) => (isDict(inbound) ? inbound.port : undefined))
      .filter((port): port is number => Number.isInteger(port)),
  );

  for (let port = startPort; port <= 65535; port += 1) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }

  throw new Error('没有可用端口');
}

function createUniqueTag(existingInbounds: unknown[], port: number) {
  const usedTags = new Set(
    existingInbounds
      .map((inbound) =>
        isDict(inbound) && typeof inbound.tag === 'string' ? inbound.tag : undefined,
      )
      .filter((tag): tag is string => Boolean(tag)),
  );
  const baseTag = `inbound-${port}`;

  if (!usedTags.has(baseTag)) {
    return baseTag;
  }

  for (let index = 2; index < Number.MAX_SAFE_INTEGER; index += 1) {
    const tag = `${baseTag}-${index}`;
    if (!usedTags.has(tag)) {
      return tag;
    }
  }

  throw new Error('无法生成唯一 tag');
}

function createUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = createRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createRandomHex(byteLength: number) {
  return Array.from(createRandomBytes(byteLength), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function createRandomBytes(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytes;
}

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
