import { describe, it, expect } from 'vitest';
import {
  parseTrojanShareLink,
  formatTrojanShareLink,
  trojanShareToXrayOutbound,
  outboundToTrojanShare,
  importTrojanShareToXrayConfig,
  importTrojanShareToXrayConfigJson,
  exportTrojanLinksFromXrayConfig,
  exportTrojanLinksFromXrayConfigJson,
  type TrojanShare,
} from '../trojan-share';

// ---------------------------------------------------------------------------
// Helpers & constants
// ---------------------------------------------------------------------------
const PASSWORD = 'my-secret-pass';

const BASIC_LINK =
  `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?security=tls&sni=example.com&type=tcp#My%20Server`;

const BASIC_SHARE: TrojanShare = {
  password: PASSWORD,
  address: 'example.com',
  port: 443,
  name: 'My Server',
  params: {
    type: 'tcp',
    sni: 'example.com',
  },
  extraParams: {},
};

function makeShare(overrides: Partial<TrojanShare> = {}): TrojanShare {
  return {
    ...BASIC_SHARE,
    ...overrides,
    params: { ...BASIC_SHARE.params, ...overrides.params },
  };
}

// ---------------------------------------------------------------------------
// parseTrojanShareLink
// ---------------------------------------------------------------------------
describe('parseTrojanShareLink', () => {
  it('parses a basic trojan:// link', () => {
    const result = parseTrojanShareLink(BASIC_LINK);
    expect(result.password).toBe(PASSWORD);
    expect(result.address).toBe('example.com');
    expect(result.port).toBe(443);
    expect(result.name).toBe('My Server');
    expect(result.params.type).toBe('tcp');
    expect(result.params.sni).toBe('example.com');
  });

  it('parses TLS with ALPN', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=tcp&sni=example.com&fp=chrome&alpn=h2%2Chttp%2F1.1`;
    const result = parseTrojanShareLink(link);
    expect(result.params.sni).toBe('example.com');
    expect(result.params.fp).toBe('chrome');
    expect(result.params.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('parses XHTTP transport', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@xhttp.example.com:443?type=xhttp&path=%2Fxhttp&host=xhttp.example.com&mode=auto`;
    const result = parseTrojanShareLink(link);
    expect(result.params.type).toBe('xhttp');
    expect(result.params.path).toBe('/xhttp');
    expect(result.params.host).toBe('xhttp.example.com');
    expect(result.params.mode).toBe('auto');
  });

  it('parses gRPC transport', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@grpc.example.com:443?type=grpc&serviceName=mygrpc&authority=grpc.example.com&mode=multi`;
    const result = parseTrojanShareLink(link);
    expect(result.params.type).toBe('grpc');
    expect(result.params.serviceName).toBe('mygrpc');
    expect(result.params.authority).toBe('grpc.example.com');
    expect(result.params.mode).toBe('multi');
  });

  it('parses WebSocket transport', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@ws.example.com:443?type=ws&path=%2Fws&host=ws.example.com`;
    const result = parseTrojanShareLink(link);
    expect(result.params.type).toBe('ws');
    expect(result.params.path).toBe('/ws');
    expect(result.params.host).toBe('ws.example.com');
  });

  it('parses IPv6 address in brackets', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@[::1]:443?type=tcp`;
    const result = parseTrojanShareLink(link);
    expect(result.address).toBe('::1');
    expect(result.port).toBe(443);
  });

  it('defaults type to tcp when omitted', () => {
    const link = `trojan://${encodeURIComponent(PASSWORD)}@example.com:443`;
    const result = parseTrojanShareLink(link);
    expect(result.params.type).toBe('tcp');
  });

  it('collects extra params', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=tcp&customKey=customVal`;
    const result = parseTrojanShareLink(link);
    expect(result.extraParams?.customKey).toBe('customVal');
  });

  it('parses fragment as name', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=tcp#My%20Node`;
    const result = parseTrojanShareLink(link);
    expect(result.name).toBe('My Node');
  });

  it('leaves name undefined when no fragment', () => {
    const link = `trojan://${encodeURIComponent(PASSWORD)}@example.com:443`;
    const result = parseTrojanShareLink(link);
    expect(result.name).toBeUndefined();
  });

  it('throws for invalid URL', () => {
    expect(() => parseTrojanShareLink('not-a-url')).toThrow('不是合法 URL');
  });

  it('throws for wrong protocol', () => {
    expect(() => parseTrojanShareLink('https://example.com')).toThrow(
      '协议必须是 trojan',
    );
  });

  it('throws for missing password', () => {
    const link = 'trojan://@example.com:443';
    expect(() => parseTrojanShareLink(link)).toThrow(
      'password 不可省略或为空',
    );
  });

  it('throws for empty hostname (URL constructor rejects it)', () => {
    const link = 'trojan://pass@:443';
    expect(() => parseTrojanShareLink(link)).toThrow('不是合法 URL');
  });

  it('throws for invalid port (0)', () => {
    const link = 'trojan://pass@example.com:0';
    expect(() => parseTrojanShareLink(link)).toThrow(
      'remote-port 必须是 1 到 65535 的整数',
    );
  });

  it('throws for invalid port (>65535)', () => {
    const link = 'trojan://pass@example.com:99999';
    expect(() => parseTrojanShareLink(link)).toThrow('不是合法 URL');
  });

  it('throws for unsupported type in strict mode', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=unknown`;
    expect(() => parseTrojanShareLink(link)).toThrow('不支持的 type: unknown');
  });

  it('allows unsupported type in non-strict mode', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=unknown`;
    const result = parseTrojanShareLink(link, { strict: false });
    expect(result.params.type).toBe('unknown');
  });

  it('ignores empty ws path (assignString skips empty values)', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=ws&path=`;
    const result = parseTrojanShareLink(link);
    expect(result.params.path).toBeUndefined();
  });

  it('ignores empty grpc serviceName (assignString skips empty values)', () => {
    const link =
      `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=grpc&serviceName=`;
    const result = parseTrojanShareLink(link);
    expect(result.params.serviceName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatTrojanShareLink
// ---------------------------------------------------------------------------
describe('formatTrojanShareLink', () => {
  it('formats a basic share', () => {
    const result = formatTrojanShareLink(BASIC_SHARE);
    expect(result).toContain('trojan://');
    expect(result).toContain(encodeURIComponent(PASSWORD) + '@');
    expect(result).toContain('example.com');
    expect(result).toContain(':443');
    expect(result).toContain('#My%20Server');
  });

  it('includes ALPN field', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, alpn: ['h2', 'http/1.1'] },
    });
    const result = formatTrojanShareLink(share);
    expect(result).toContain('alpn=h2%2Chttp%2F1.1');
  });

  it('includes XHTTP params', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, type: 'xhttp', path: '/xhttp', mode: 'auto' },
    });
    const result = formatTrojanShareLink(share);
    expect(result).toContain('type=xhttp');
    expect(result).toContain('path=%2Fxhttp');
    expect(result).toContain('mode=auto');
  });

  it('includes fragment as name', () => {
    const share = makeShare({ name: 'My Node' });
    const result = formatTrojanShareLink(share);
    expect(result).toContain('#My%20Node');
  });

  it('omits fragment when name is undefined', () => {
    const share = makeShare({ name: undefined });
    const result = formatTrojanShareLink(share);
    expect(result).not.toContain('#');
  });

  it('wraps IPv6 address in brackets', () => {
    const share = makeShare({ address: '::1' });
    const result = formatTrojanShareLink(share);
    expect(result).toContain('@[::1]');
  });

  it('includes extra params', () => {
    const share = makeShare({ extraParams: { customKey: 'customVal' } });
    const result = formatTrojanShareLink(share);
    expect(result).toContain('customKey=customVal');
  });

  it('encodes special characters in query values', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, path: '/my path' },
    });
    const result = formatTrojanShareLink(share);
    expect(result).toContain('path=%2Fmy%20path');
  });

  it('throws for missing password', () => {
    const share = makeShare({ password: '' });
    expect(() => formatTrojanShareLink(share)).toThrow(
      'password 不可省略或为空',
    );
  });

  it('throws for missing address', () => {
    const share = makeShare({ address: '' });
    expect(() => formatTrojanShareLink(share)).toThrow(
      'remote-host 不可省略或为空',
    );
  });
});

// ---------------------------------------------------------------------------
// trojanShareToXrayOutbound
// ---------------------------------------------------------------------------
describe('trojanShareToXrayOutbound', () => {
  it('produces protocol "trojan"', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.protocol).toBe('trojan');
  });

  it('sets servers array with address, port, and password', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_SHARE);
    const servers = outbound.settings?.servers as any[];
    expect(servers).toHaveLength(1);
    expect(servers[0].address).toBe('example.com');
    expect(servers[0].port).toBe(443);
    expect(servers[0].password).toBe(PASSWORD);
  });

  it('sets streamSettings with network and security "tls"', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.streamSettings?.network).toBe('raw');
    expect(outbound.streamSettings?.security).toBe('tls');
  });

  it('sets TLS settings with sni, fp, alpn', () => {
    const share = makeShare({
      params: {
        ...BASIC_SHARE.params,
        fp: 'chrome',
        alpn: ['h2', 'http/1.1'],
        sni: 'sni.example.com',
      },
    });
    const outbound = trojanShareToXrayOutbound(share);
    const tls = (outbound.streamSettings as any).tlsSettings;
    expect(tls.serverName).toBe('sni.example.com');
    expect(tls.fingerprint).toBe('chrome');
    expect(tls.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('sets wsSettings for WebSocket transport', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, type: 'ws', path: '/ws', host: 'ws.example.com' },
    });
    const outbound = trojanShareToXrayOutbound(share);
    const ws = (outbound.streamSettings as any).wsSettings;
    expect(ws.path).toBe('/ws');
    expect(ws.host).toBe('ws.example.com');
  });

  it('sets xhttpSettings for XHTTP transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_SHARE.params,
        type: 'xhttp',
        path: '/xhttp',
        mode: 'auto',
      },
    });
    const outbound = trojanShareToXrayOutbound(share);
    const xhttp = (outbound.streamSettings as any).xhttpSettings;
    expect(xhttp.path).toBe('/xhttp');
    expect(xhttp.mode).toBe('auto');
  });

  it('sets grpcSettings for gRPC transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_SHARE.params,
        type: 'grpc',
        serviceName: 'mygrpc',
        mode: 'multi',
      },
    });
    const outbound = trojanShareToXrayOutbound(share);
    const grpc = (outbound.streamSettings as any).grpcSettings;
    expect(grpc.serviceName).toBe('mygrpc');
    expect(grpc.multiMode).toBe(true);
  });

  it('sets kcpSettings for KCP transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_SHARE.params,
        type: 'kcp',
        mtu: 1400,
        tti: 20,
        seed: 'myseed',
        headerType: 'none',
      },
    });
    const outbound = trojanShareToXrayOutbound(share);
    const kcp = (outbound.streamSettings as any).kcpSettings;
    expect(kcp.mtu).toBe(1400);
    expect(kcp.tti).toBe(20);
    expect(kcp.seed).toBe('myseed');
    expect(kcp.header.type).toBe('none');
  });

  it('sets tag from options.tag', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_SHARE, {
      tag: 'my-tag',
    });
    expect(outbound.tag).toBe('my-tag');
  });

  it('falls back tag to share.name', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.tag).toBe('My Server');
  });

  it('accepts a string link as input', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_LINK);
    expect(outbound.protocol).toBe('trojan');
  });

  it('sets network to "tcp" when preferRawNetwork=false', () => {
    const outbound = trojanShareToXrayOutbound(BASIC_SHARE, {
      preferRawNetwork: false,
    });
    expect(outbound.streamSettings?.network).toBe('tcp');
  });
});

// ---------------------------------------------------------------------------
// outboundToTrojanShare
// ---------------------------------------------------------------------------
describe('outboundToTrojanShare', () => {
  const MINIMAL_OUTBOUND: Record<string, any> = {
    protocol: 'trojan',
    settings: {
      servers: [
        { address: 'example.com', port: 443, password: PASSWORD },
      ],
    },
    streamSettings: {
      network: 'raw',
      security: 'tls',
    },
    tag: 'My Server',
  };

  it('converts a minimal outbound back to share', () => {
    const share = outboundToTrojanShare(MINIMAL_OUTBOUND);
    expect(share.password).toBe(PASSWORD);
    expect(share.address).toBe('example.com');
    expect(share.port).toBe(443);
    expect(share.params.type).toBe('tcp');
  });

  it('throws for non-trojan protocol', () => {
    const outbound = { protocol: 'vless', settings: {} };
    expect(() => outboundToTrojanShare(outbound)).toThrow(
      'outbound.protocol 必须是 trojan',
    );
  });

  it('preserves name from options', () => {
    const share = outboundToTrojanShare(MINIMAL_OUTBOUND, {
      name: 'My Node',
    });
    expect(share.name).toBe('My Node');
  });

  it('falls back name to outbound.tag', () => {
    const share = outboundToTrojanShare(MINIMAL_OUTBOUND);
    expect(share.name).toBe('My Server');
  });

  it('reads TLS settings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        network: 'raw',
        security: 'tls',
        tlsSettings: {
          serverName: 'sni.example.com',
          fingerprint: 'chrome',
          alpn: ['h2', 'http/1.1'],
        },
      },
    };
    const share = outboundToTrojanShare(outbound);
    expect(share.params.sni).toBe('sni.example.com');
    expect(share.params.fp).toBe('chrome');
    expect(share.params.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('reads wsSettings for WebSocket', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        network: 'ws',
        security: 'tls',
        wsSettings: { path: '/ws', host: 'ws.example.com' },
      },
    };
    const share = outboundToTrojanShare(outbound);
    expect(share.params.type).toBe('ws');
    expect(share.params.path).toBe('/ws');
    expect(share.params.host).toBe('ws.example.com');
  });

  it('reads grpcSettings for gRPC', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        network: 'grpc',
        security: 'tls',
        grpcSettings: {
          serviceName: 'mygrpc',
          authority: 'grpc.example.com',
          multiMode: true,
        },
      },
    };
    const share = outboundToTrojanShare(outbound);
    expect(share.params.type).toBe('grpc');
    expect(share.params.serviceName).toBe('mygrpc');
    expect(share.params.authority).toBe('grpc.example.com');
    expect(share.params.mode).toBe('multi');
  });

  it('handles settings.servers structure', () => {
    const outbound: Record<string, any> = {
      protocol: 'trojan',
      settings: {
        servers: [{ address: 'simple.com', port: 8080, password: PASSWORD }],
      },
      streamSettings: {
        network: 'tcp',
        security: 'tls',
      },
    };
    const share = outboundToTrojanShare(outbound);
    expect(share.password).toBe(PASSWORD);
    expect(share.address).toBe('simple.com');
    expect(share.port).toBe(8080);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip
// ---------------------------------------------------------------------------
describe('round-trip (parse → outbound → share → format)', () => {
  const roundTripCases = [
    {
      name: 'basic TCP',
      link: BASIC_LINK,
    },
    {
      name: 'TLS with ALPN',
      link:
        `trojan://${encodeURIComponent(PASSWORD)}@example.com:443?type=tcp&sni=example.com&fp=chrome&alpn=h2%2Chttp%2F1.1#alpn-node`,
    },
    {
      name: 'WebSocket',
      link:
        `trojan://${encodeURIComponent(PASSWORD)}@ws.example.com:8080?type=ws&path=%2Fws&host=ws.example.com&sni=ws.example.com#ws-node`,
    },
    {
      name: 'gRPC multi',
      link:
        `trojan://${encodeURIComponent(PASSWORD)}@grpc.example.com:443?type=grpc&serviceName=mygrpc&mode=multi&sni=grpc.example.com#grpc-node`,
    },
    {
      name: 'XHTTP',
      link:
        `trojan://${encodeURIComponent(PASSWORD)}@xhttp.example.com:443?type=xhttp&path=%2Fxhttp&host=xhttp.example.com&mode=auto#xhttp-node`,
    },
    {
      name: 'IPv6',
      link: `trojan://${encodeURIComponent(PASSWORD)}@[::1]:443?type=tcp#ipv6`,
    },
  ];

  for (const { name, link } of roundTripCases) {
    it(`preserves fields through round-trip: ${name}`, () => {
      const parsed = parseTrojanShareLink(link);
      const outbound = trojanShareToXrayOutbound(parsed);
      const backToShare = outboundToTrojanShare(outbound, {
        name: parsed.name,
      });
      const formatted = formatTrojanShareLink(backToShare);

      const reparsed = parseTrojanShareLink(formatted);

      expect(reparsed.password).toBe(parsed.password);
      expect(reparsed.address).toBe(parsed.address);
      expect(reparsed.port).toBe(parsed.port);
      expect(reparsed.name).toBe(parsed.name);
      expect(reparsed.params.type).toBe(parsed.params.type);

      if (parsed.params.sni !== undefined)
        expect(reparsed.params.sni).toBe(parsed.params.sni);
      if (parsed.params.fp !== undefined)
        expect(reparsed.params.fp).toBe(parsed.params.fp);
      if (parsed.params.path !== undefined)
        expect(reparsed.params.path).toBe(parsed.params.path);
      if (parsed.params.host !== undefined)
        expect(reparsed.params.host).toBe(parsed.params.host);
      if (parsed.params.serviceName !== undefined)
        expect(reparsed.params.serviceName).toBe(parsed.params.serviceName);
      if (parsed.params.mode !== undefined)
        expect(reparsed.params.mode).toBe(parsed.params.mode);
    });
  }
});

// ---------------------------------------------------------------------------
// importTrojanShareToXrayConfig
// ---------------------------------------------------------------------------
describe('importTrojanShareToXrayConfig', () => {
  function ob(result: Record<string, unknown>): any[] {
    return (result as any).outbounds ?? [];
  }

  it('append mode adds outbound to empty config', () => {
    const result = importTrojanShareToXrayConfig({}, BASIC_LINK);
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].protocol).toBe('trojan');
  });

  it('append mode adds to existing outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importTrojanShareToXrayConfig(config, BASIC_LINK);
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('trojan');
  });

  it('does not mutate original config', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importTrojanShareToXrayConfig(config, BASIC_LINK);
    expect(config.outbounds).toHaveLength(1);
    expect(ob(result)).toHaveLength(2);
  });

  it('replaceByTag replaces matching tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'trojan',
          tag: 'my-node',
          settings: {
            servers: [{ address: 'old.com', port: 443, password: 'old' }],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
      ],
    };
    const share = makeShare({ name: 'my-node' });
    const result = importTrojanShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].tag).toBe('my-node');
  });

  it('replaceByTag appends when tag not found', () => {
    const config = { outbounds: [{ protocol: 'vmess', tag: 'other' }] };
    const share = makeShare({ name: 'new-node' });
    const result = importTrojanShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].tag).toBe('new-node');
  });

  it('replaceByTag throws when outbound has no tag', () => {
    const share = makeShare({ name: undefined });
    expect(() =>
      importTrojanShareToXrayConfig({}, share, { mode: 'replaceByTag' }),
    ).toThrow('replaceByTag 需要提供 tag 或链接 name');
  });

  it('replaceFirstTrojan replaces existing trojan outbound', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        {
          protocol: 'trojan',
          settings: {
            servers: [{ address: 'old.com', port: 443, password: 'old' }],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
        { protocol: 'vless', settings: {} },
      ],
    };
    const result = importTrojanShareToXrayConfig(config, BASIC_SHARE, {
      mode: 'replaceFirstTrojan',
    });
    expect(ob(result)).toHaveLength(3);
    expect(ob(result)[0].protocol).toBe('vmess');
    expect(ob(result)[1].settings.servers[0].password).toBe(PASSWORD);
    expect(ob(result)[2].protocol).toBe('vless');
  });

  it('replaceFirstTrojan appends when no trojan outbound exists', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importTrojanShareToXrayConfig(config, BASIC_SHARE, {
      mode: 'replaceFirstTrojan',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('trojan');
  });

  it('throws for unknown mode', () => {
    expect(() =>
      importTrojanShareToXrayConfig({}, BASIC_SHARE, {
        mode: 'unknown' as never,
      }),
    ).toThrow('未知导入模式: unknown');
  });
});

// ---------------------------------------------------------------------------
// exportTrojanLinksFromXrayConfig
// ---------------------------------------------------------------------------
describe('exportTrojanLinksFromXrayConfig', () => {
  it('returns trojan:// links from outbounds', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        {
          protocol: 'trojan',
          settings: {
            servers: [
              { address: 'example.com', port: 443, password: PASSWORD },
            ],
          },
          streamSettings: { network: 'raw', security: 'tls' },
          tag: 'my-node',
        },
      ],
    };
    const links = exportTrojanLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('trojan://');
    expect(links[0]).toContain(encodeURIComponent(PASSWORD) + '@');
    expect(links[0]).toContain('example.com');
  });

  it('filters by tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'trojan',
          tag: 'node-a',
          settings: {
            servers: [{ address: 'a.com', port: 443, password: 'pass1' }],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
        {
          protocol: 'trojan',
          tag: 'node-b',
          settings: {
            servers: [{ address: 'b.com', port: 443, password: 'pass2' }],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
      ],
    };
    const links = exportTrojanLinksFromXrayConfig(config, { tag: 'node-a' });
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('pass1@');
  });

  it('filters by multiple tags', () => {
    const config = {
      outbounds: [
        {
          protocol: 'trojan',
          tag: 'node-a',
          settings: {
            servers: [{ address: 'a.com', port: 443, password: 'pass1' }],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
        {
          protocol: 'trojan',
          tag: 'node-b',
          settings: {
            servers: [{ address: 'b.com', port: 443, password: 'pass2' }],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
      ],
    };
    const links = exportTrojanLinksFromXrayConfig(config, {
      tag: ['node-a', 'node-b'],
    });
    expect(links).toHaveLength(2);
  });

  it('returns empty array when no trojan outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess' }] };
    const links = exportTrojanLinksFromXrayConfig(config);
    expect(links).toEqual([]);
  });

  it('returns empty array when config has no outbounds', () => {
    const links = exportTrojanLinksFromXrayConfig({});
    expect(links).toEqual([]);
  });

  it('filters out null outbounds', () => {
    const config = {
      outbounds: [
        null,
        {
          protocol: 'trojan',
          tag: 'valid-node',
          settings: {
            servers: [
              { address: 'valid.com', port: 443, password: PASSWORD },
            ],
          },
          streamSettings: { network: 'raw', security: 'tls' },
        },
      ],
    };
    const links = exportTrojanLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// exportTrojanLinksFromXrayConfigJson
// ---------------------------------------------------------------------------
describe('exportTrojanLinksFromXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({
      outbounds: [
        {
          protocol: 'trojan',
          settings: {
            servers: [
              { address: 'example.com', port: 443, password: PASSWORD },
            ],
          },
          streamSettings: { network: 'raw', security: 'tls' },
          tag: 'my-node',
        },
      ],
    });
    const links = exportTrojanLinksFromXrayConfigJson(configJson);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('trojan://');
  });
});

// ---------------------------------------------------------------------------
// importTrojanShareToXrayConfigJson
// ---------------------------------------------------------------------------
describe('importTrojanShareToXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({ outbounds: [] });
    const result = importTrojanShareToXrayConfigJson(configJson, BASIC_SHARE);
    const parsed = JSON.parse(result);
    expect(parsed.outbounds).toHaveLength(1);
    expect(parsed.outbounds[0].protocol).toBe('trojan');
  });
});
