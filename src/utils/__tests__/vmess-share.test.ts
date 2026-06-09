import { describe, it, expect } from 'vitest';
import {
  parseVmessShareLink,
  formatVmessShareLink,
  vmessShareToXrayOutbound,
  outboundToVmessShare,
  importVmessShareToXrayConfig,
  importVmessShareToXrayConfigJson,
  exportVmessLinksFromXrayConfig,
  exportVmessLinksFromXrayConfigJson,
  type VmessShare,
} from '../vmess-share';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeVmessLink(overrides: Record<string, string> = {}): string {
  const json: Record<string, string> = {
    v: '2',
    ps: 'vmess-node',
    add: 'example.com',
    port: '443',
    id: UUID,
    aid: '0',
    scy: 'auto',
    net: 'tcp',
    type: 'none',
    tls: 'none',
    ...overrides,
  };
  const stdB64 = btoa(JSON.stringify(json));
  // VMess format: no padding, URL-safe base64
  const urlSafe = stdB64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `vmess://${urlSafe}`;
}

const BASIC_VMESS_LINK = makeVmessLink();

const BASIC_VMESS_SHARE: VmessShare = {
  id: UUID,
  address: 'example.com',
  port: 443,
  name: 'vmess-node',
  params: {
    v: '2',
    aid: 0,
    scy: 'auto',
    net: 'tcp',
    type: 'none',
    tls: 'none',
  },
  extraParams: {},
};

function makeShare(overrides: Partial<VmessShare> = {}): VmessShare {
  return {
    ...BASIC_VMESS_SHARE,
    ...overrides,
    params: { ...BASIC_VMESS_SHARE.params, ...overrides.params },
  };
}

// ---------------------------------------------------------------------------
// parseVmessShareLink
// ---------------------------------------------------------------------------
describe('parseVmessShareLink', () => {
  it('parses a basic vmess:// link', () => {
    const result = parseVmessShareLink(BASIC_VMESS_LINK);
    expect(result.id).toBe(UUID);
    expect(result.address).toBe('example.com');
    expect(result.port).toBe(443);
    expect(result.name).toBe('vmess-node');
    expect(result.params.scy).toBe('auto');
    expect(result.params.net).toBe('tcp');
    expect(result.params.tls).toBe('none');
    expect(result.params.v).toBe('2');
    expect(result.params.aid).toBe(0);
  });

  it('parses TLS WebSocket transport', () => {
    const link = makeVmessLink({
      net: 'ws',
      tls: 'tls',
      path: '/websocket',
      host: 'ws.example.com',
      sni: 'sni.example.com',
      fp: 'chrome',
    });
    const result = parseVmessShareLink(link);
    expect(result.params.net).toBe('ws');
    expect(result.params.tls).toBe('tls');
    expect(result.params.path).toBe('/websocket');
    expect(result.params.host).toBe('ws.example.com');
    expect(result.params.sni).toBe('sni.example.com');
    expect(result.params.fp).toBe('chrome');
  });

  it('parses gRPC transport', () => {
    const link = makeVmessLink({
      net: 'grpc',
      serviceName: 'mygrpc',
      authority: 'grpc.example.com',
      mode: 'multi',
    });
    const result = parseVmessShareLink(link);
    expect(result.params.net).toBe('grpc');
    expect(result.params.serviceName).toBe('mygrpc');
    expect(result.params.authority).toBe('grpc.example.com');
    expect(result.params.mode).toBe('multi');
  });

  it('parses XHTTP transport with fm', () => {
    const link = makeVmessLink({
      net: 'xhttp',
      path: '/xhttp',
      mode: 'auto',
      fm: '{"ips":["1.2.3.4"]}',
    });
    const result = parseVmessShareLink(link);
    expect(result.params.net).toBe('xhttp');
    expect(result.params.path).toBe('/xhttp');
    expect(result.params.mode).toBe('auto');
    expect(result.params.fm).toBe('{"ips":["1.2.3.4"]}');
  });

  it('parses aid (alterId)', () => {
    const link = makeVmessLink({ aid: '64' });
    const result = parseVmessShareLink(link);
    expect(result.params.aid).toBe(64);
  });

  it('parses alpn as comma-separated list', () => {
    const link = makeVmessLink({
      tls: 'tls',
      alpn: 'h2,http/1.1',
    });
    const result = parseVmessShareLink(link);
    expect(result.params.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('collects extra params not in KNOWN_JSON_KEYS', () => {
    const link = makeVmessLink({ customKey: 'customVal' });
    const result = parseVmessShareLink(link);
    expect(result.extraParams?.customKey).toBe('customVal');
  });

  it('throws for missing vmess:// prefix', () => {
    expect(() => parseVmessShareLink('not-vmess')).toThrow(
      '链接必须以 vmess:// 开头',
    );
  });

  it('throws for empty base64 content', () => {
    expect(() => parseVmessShareLink('vmess://')).toThrow(
      'vmess:// 后缺少 Base64 内容',
    );
  });

  it('throws for non-JSON content in base64', () => {
    // Valid base64 that decodes to non-JSON text
    const validB64 = btoa('hello').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(() => parseVmessShareLink(`vmess://${validB64}`)).toThrow(
      'Base64 解码后的内容不是合法 JSON',
    );
  });

  it('throws for missing id', () => {
    const link = makeVmessLink({ id: '' });
    expect(() => parseVmessShareLink(link)).toThrow('uuid/id 不可省略或为空');
  });

  it('throws for missing address', () => {
    const link = makeVmessLink({ add: '' });
    expect(() => parseVmessShareLink(link)).toThrow(
      'remote-host 不可省略或为空',
    );
  });

  it('throws for invalid port (0)', () => {
    const link = makeVmessLink({ port: '0' });
    expect(() => parseVmessShareLink(link)).toThrow(
      'remote-port 必须是 1 到 65535 的整数',
    );
  });

  it('throws for unsupported net in strict mode', () => {
    const link = makeVmessLink({ net: 'unknown' });
    expect(() => parseVmessShareLink(link)).toThrow('不支持的 net: unknown');
  });

  it('allows unsupported net in non-strict mode', () => {
    const link = makeVmessLink({ net: 'unknown' });
    const result = parseVmessShareLink(link, { strict: false });
    expect(result.params.net).toBe('unknown');
  });

  it('ignores empty ws path (stringOrUndefined skips empty strings)', () => {
    const link = makeVmessLink({ net: 'ws', path: '' });
    const result = parseVmessShareLink(link);
    expect(result.params.path).toBeUndefined();
  });

  it('ignores empty grpc serviceName (stringOrUndefined skips empty strings)', () => {
    const link = makeVmessLink({ net: 'grpc', serviceName: '' });
    const result = parseVmessShareLink(link);
    expect(result.params.serviceName).toBeUndefined();
  });

  it('parses fragment-less link', () => {
    const link = makeVmessLink({ ps: '' });
    const result = parseVmessShareLink(link);
    expect(result.name).toBeUndefined();
  });

  it('handles different scy (cipher) values', () => {
    for (const scy of ['auto', 'none', 'aes-128-gcm', 'chacha20-poly1305', 'zero'] as const) {
      const link = makeVmessLink({ scy });
      const result = parseVmessShareLink(link);
      expect(result.params.scy).toBe(scy);
    }
  });
});

// ---------------------------------------------------------------------------
// formatVmessShareLink
// ---------------------------------------------------------------------------
describe('formatVmessShareLink', () => {
  it('formats a basic share', () => {
    const result = formatVmessShareLink(BASIC_VMESS_SHARE);
    expect(result).toContain('vmess://');

    // Re-parse to verify
    const reparsed = parseVmessShareLink(result);
    expect(reparsed.id).toBe(UUID);
    expect(reparsed.address).toBe('example.com');
    expect(reparsed.port).toBe(443);
    expect(reparsed.name).toBe('vmess-node');
  });

  it('includes TLS fields', () => {
    const share = makeShare({
      params: {
        ...BASIC_VMESS_SHARE.params,
        tls: 'tls',
        sni: 'sni.example.com',
        fp: 'chrome',
        alpn: ['h2', 'http/1.1'],
      },
    });
    const result = formatVmessShareLink(share);
    const reparsed = parseVmessShareLink(result);
    expect(reparsed.params.tls).toBe('tls');
    expect(reparsed.params.sni).toBe('sni.example.com');
    expect(reparsed.params.fp).toBe('chrome');
    expect(reparsed.params.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('includes fm (FinalMask) field', () => {
    const share = makeShare({
      params: { ...BASIC_VMESS_SHARE.params, fm: '{"ips":["1.2.3.4"]}' },
    });
    const result = formatVmessShareLink(share);
    const reparsed = parseVmessShareLink(result);
    expect(reparsed.params.fm).toBe('{"ips":["1.2.3.4"]}');
  });

  it('includes extra params', () => {
    const share = makeShare({ extraParams: { customKey: 'customVal' } });
    const result = formatVmessShareLink(share);
    const reparsed = parseVmessShareLink(result);
    expect(reparsed.extraParams?.customKey).toBe('customVal');
  });

  it('includes ps (name) when defined', () => {
    const share = makeShare({ name: 'My Node' });
    const result = formatVmessShareLink(share);
    const reparsed = parseVmessShareLink(result);
    expect(reparsed.name).toBe('My Node');
  });

  it('omits ps when name is undefined', () => {
    const share = makeShare({ name: undefined });
    const result = formatVmessShareLink(share);
    // The JSON still has all fields; ps just won't be set
    const reparsed = parseVmessShareLink(result);
    expect(reparsed.name).toBeUndefined();
  });

  it('throws for missing id', () => {
    const share = makeShare({ id: '' });
    expect(() => formatVmessShareLink(share)).toThrow('uuid/id 不可省略或为空');
  });
});

// ---------------------------------------------------------------------------
// vmessShareToXrayOutbound
// ---------------------------------------------------------------------------
describe('vmessShareToXrayOutbound', () => {
  it('produces protocol "vmess"', () => {
    const outbound = vmessShareToXrayOutbound(BASIC_VMESS_SHARE);
    expect(outbound.protocol).toBe('vmess');
  });

  it('sets vnext address, port, and user fields', () => {
    const outbound = vmessShareToXrayOutbound(BASIC_VMESS_SHARE);
    const vnext = (outbound.settings?.vnext as any[])[0];
    expect(vnext.address).toBe('example.com');
    expect(vnext.port).toBe(443);
    expect(vnext.users[0].id).toBe(UUID);
    expect(vnext.users[0].alterId).toBe(0);
    expect(vnext.users[0].security).toBe('auto');
  });

  it('sets streamSettings network and security', () => {
    const outbound = vmessShareToXrayOutbound(BASIC_VMESS_SHARE);
    expect(outbound.streamSettings?.network).toBe('raw');
    expect(outbound.streamSettings?.security).toBe('none');
  });

  it('sets wsSettings for WebSocket transport', () => {
    const share = makeShare({
      params: { ...BASIC_VMESS_SHARE.params, net: 'ws', path: '/ws', host: 'ws.example.com' },
    });
    const outbound = vmessShareToXrayOutbound(share);
    const ws = (outbound.streamSettings as any).wsSettings;
    expect(ws.path).toBe('/ws');
    expect(ws.host).toBe('ws.example.com');
  });

  it('sets TLS settings', () => {
    const share = makeShare({
      params: {
        ...BASIC_VMESS_SHARE.params,
        tls: 'tls',
        sni: 'sni.example.com',
        fp: 'chrome',
        alpn: ['h2', 'http/1.1'],
      },
    });
    const outbound = vmessShareToXrayOutbound(share);
    const tls = (outbound.streamSettings as any).tlsSettings;
    expect(tls.serverName).toBe('sni.example.com');
    expect(tls.fingerprint).toBe('chrome');
    expect(tls.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('sets xhttpSettings for XHTTP transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_VMESS_SHARE.params,
        net: 'xhttp',
        path: '/xhttp',
        mode: 'auto',
      },
    });
    const outbound = vmessShareToXrayOutbound(share);
    const xhttp = (outbound.streamSettings as any).xhttpSettings;
    expect(xhttp.path).toBe('/xhttp');
    expect(xhttp.mode).toBe('auto');
  });

  it('sets finalmask from fm param', () => {
    const share = makeShare({
      params: { ...BASIC_VMESS_SHARE.params, fm: '{"ips":["1.2.3.4"]}' },
    });
    const outbound = vmessShareToXrayOutbound(share);
    expect((outbound.streamSettings as any).finalmask).toEqual({
      ips: ['1.2.3.4'],
    });
  });

  it('sets tag from options.tag', () => {
    const outbound = vmessShareToXrayOutbound(BASIC_VMESS_SHARE, {
      tag: 'my-tag',
    });
    expect(outbound.tag).toBe('my-tag');
  });

  it('falls back tag to share.name', () => {
    const outbound = vmessShareToXrayOutbound(BASIC_VMESS_SHARE);
    expect(outbound.tag).toBe('vmess-node');
  });

  it('accepts a string link as input', () => {
    const outbound = vmessShareToXrayOutbound(BASIC_VMESS_LINK);
    expect(outbound.protocol).toBe('vmess');
  });
});

// ---------------------------------------------------------------------------
// outboundToVmessShare
// ---------------------------------------------------------------------------
describe('outboundToVmessShare', () => {
  const MINIMAL_OUTBOUND: Record<string, any> = {
    protocol: 'vmess',
    settings: {
      vnext: [
        {
          address: 'example.com',
          port: 443,
          users: [{ id: UUID, alterId: 0, security: 'auto' }],
        },
      ],
    },
    streamSettings: {
      network: 'raw',
      security: 'none',
    },
    tag: 'vmess-node',
  };

  it('converts a minimal outbound back to share', () => {
    const share = outboundToVmessShare(MINIMAL_OUTBOUND);
    expect(share.id).toBe(UUID);
    expect(share.address).toBe('example.com');
    expect(share.port).toBe(443);
    expect(share.params.scy).toBe('auto');
    expect(share.params.aid).toBe(0);
  });

  it('throws for non-vmess protocol', () => {
    const outbound = { protocol: 'vless', settings: {} };
    expect(() => outboundToVmessShare(outbound)).toThrow(
      'outbound.protocol 必须是 vmess',
    );
  });

  it('preserves name from options', () => {
    const share = outboundToVmessShare(MINIMAL_OUTBOUND, { name: 'My Node' });
    expect(share.name).toBe('My Node');
  });

  it('falls back name to outbound.tag', () => {
    const share = outboundToVmessShare(MINIMAL_OUTBOUND);
    expect(share.name).toBe('vmess-node');
  });

  it('reads TLS fields', () => {
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
    const share = outboundToVmessShare(outbound);
    expect(share.params.tls).toBe('tls');
    expect(share.params.sni).toBe('sni.example.com');
    expect(share.params.fp).toBe('chrome');
    expect(share.params.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('reads wsSettings for WebSocket', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        network: 'ws',
        security: 'none',
        wsSettings: { path: '/ws', host: 'ws.example.com' },
      },
    };
    const share = outboundToVmessShare(outbound);
    expect(share.params.net).toBe('ws');
    expect(share.params.path).toBe('/ws');
    expect(share.params.host).toBe('ws.example.com');
  });

  it('reads finalmask from streamSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        finalmask: { ips: ['1.2.3.4'] },
      },
    };
    const share = outboundToVmessShare(outbound);
    expect(share.params.fm).toBe('{"ips":["1.2.3.4"]}');
  });

  it('handles simplified settings structure', () => {
    const outbound: Record<string, any> = {
      protocol: 'vmess',
      settings: {
        address: 'simple.com',
        port: 8080,
        id: UUID,
        security: 'none',
      },
      streamSettings: {
        network: 'tcp',
        security: 'none',
      },
    };
    const share = outboundToVmessShare(outbound);
    expect(share.id).toBe(UUID);
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
      link: BASIC_VMESS_LINK,
    },
    {
      name: 'TLS WebSocket',
      link: makeVmessLink({
        net: 'ws',
        tls: 'tls',
        path: '/websocket',
        host: 'ws.example.com',
        sni: 'sni.example.com',
        fp: 'chrome',
      }),
    },
    {
      name: 'gRPC multi',
      link: makeVmessLink({
        net: 'grpc',
        serviceName: 'mygrpc',
        mode: 'multi',
      }),
    },
    {
      name: 'XHTTP with fm',
      link: makeVmessLink({
        net: 'xhttp',
        path: '/xhttp',
        mode: 'auto',
        fm: '{"ips":["1.2.3.4"]}',
      }),
    },
    {
      name: 'chacha20 cipher',
      link: makeVmessLink({ scy: 'chacha20-poly1305' }),
    },
    {
      name: 'with custom extra params',
      link: makeVmessLink({ customKey: 'customVal' }),
    },
  ];

  for (const { name, link } of roundTripCases) {
    it(`preserves fields through round-trip: ${name}`, () => {
      const parsed = parseVmessShareLink(link);
      const outbound = vmessShareToXrayOutbound(parsed);
      const backToShare = outboundToVmessShare(outbound, {
        name: parsed.name,
      });
      const formatted = formatVmessShareLink(backToShare);

      const reparsed = parseVmessShareLink(formatted);

      expect(reparsed.id).toBe(parsed.id);
      expect(reparsed.address).toBe(parsed.address);
      expect(reparsed.port).toBe(parsed.port);
      expect(reparsed.params.scy).toBe(parsed.params.scy);
      expect(reparsed.params.net).toBe(parsed.params.net);
      expect(reparsed.params.tls).toBe(parsed.params.tls);
      expect(reparsed.params.aid).toBe(parsed.params.aid);

      if (parsed.name) expect(reparsed.name).toBe(parsed.name);
      if (parsed.params.path !== undefined)
        expect(reparsed.params.path).toBe(parsed.params.path);
      if (parsed.params.host !== undefined)
        expect(reparsed.params.host).toBe(parsed.params.host);
      if (parsed.params.serviceName !== undefined)
        expect(reparsed.params.serviceName).toBe(parsed.params.serviceName);
      if (parsed.params.mode !== undefined)
        expect(reparsed.params.mode).toBe(parsed.params.mode);
      if (parsed.params.fm !== undefined)
        expect(reparsed.params.fm).toBe(parsed.params.fm);
    });
  }
});

// ---------------------------------------------------------------------------
// importVmessShareToXrayConfig
// ---------------------------------------------------------------------------
describe('importVmessShareToXrayConfig', () => {
  function ob(result: Record<string, unknown>): any[] {
    return (result as any).outbounds ?? [];
  }

  it('append mode adds outbound to empty config', () => {
    const result = importVmessShareToXrayConfig({}, BASIC_VMESS_LINK);
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].protocol).toBe('vmess');
  });

  it('append mode adds to existing outbounds', () => {
    const config = { outbounds: [{ protocol: 'trojan', settings: {} }] };
    const result = importVmessShareToXrayConfig(config, BASIC_VMESS_LINK);
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('vmess');
  });

  it('does not mutate original config', () => {
    const config = { outbounds: [{ protocol: 'trojan', settings: {} }] };
    const result = importVmessShareToXrayConfig(config, BASIC_VMESS_LINK);
    expect(config.outbounds).toHaveLength(1);
    expect(ob(result)).toHaveLength(2);
  });

  it('replaceByTag replaces matching tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'vmess',
          tag: 'my-node',
          settings: {
            vnext: [{ address: 'old.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const share = makeShare({ name: 'my-node' });
    const result = importVmessShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].tag).toBe('my-node');
  });

  it('replaceByTag appends when tag not found', () => {
    const config = { outbounds: [{ protocol: 'trojan', tag: 'other' }] };
    const share = makeShare({ name: 'new-node' });
    const result = importVmessShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].tag).toBe('new-node');
  });

  it('replaceByTag throws when outbound has no tag', () => {
    const share = makeShare({ name: undefined });
    expect(() =>
      importVmessShareToXrayConfig({}, share, { mode: 'replaceByTag' }),
    ).toThrow('replaceByTag 需要提供 tag 或链接 name');
  });

  it('replaceFirstVmess replaces existing vmess outbound', () => {
    const config = {
      outbounds: [
        { protocol: 'trojan', settings: {} },
        {
          protocol: 'vmess',
          settings: {
            vnext: [{ address: 'old.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
        { protocol: 'vless', settings: {} },
      ],
    };
    const result = importVmessShareToXrayConfig(config, BASIC_VMESS_SHARE, {
      mode: 'replaceFirstVmess',
    });
    expect(ob(result)).toHaveLength(3);
    expect(ob(result)[0].protocol).toBe('trojan');
    expect(ob(result)[1].protocol).toBe('vmess');
    expect(ob(result)[1].settings.vnext[0].address).toBe('example.com');
    expect(ob(result)[2].protocol).toBe('vless');
  });

  it('replaceFirstVmess appends when no vmess outbound exists', () => {
    const config = { outbounds: [{ protocol: 'trojan', settings: {} }] };
    const result = importVmessShareToXrayConfig(config, BASIC_VMESS_SHARE, {
      mode: 'replaceFirstVmess',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('vmess');
  });

  it('throws for unknown mode', () => {
    expect(() =>
      importVmessShareToXrayConfig({}, BASIC_VMESS_SHARE, {
        mode: 'unknown' as never,
      }),
    ).toThrow('未知导入模式: unknown');
  });
});

// ---------------------------------------------------------------------------
// exportVmessLinksFromXrayConfig
// ---------------------------------------------------------------------------
describe('exportVmessLinksFromXrayConfig', () => {
  it('returns vmess:// links from outbounds', () => {
    const config = {
      outbounds: [
        { protocol: 'vless', settings: {} },
        {
          protocol: 'vmess',
          settings: {
            vnext: [
              { address: 'example.com', port: 443, users: [{ id: UUID }] },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
          tag: 'my-node',
        },
      ],
    };
    const links = exportVmessLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('vmess://');
    // Re-parse to verify content (values are inside base64)
    const reparsed = parseVmessShareLink(links[0]);
    expect(reparsed.id).toBe(UUID);
    expect(reparsed.address).toBe('example.com');
    expect(reparsed.port).toBe(443);
  });

  it('filters by tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'vmess',
          tag: 'node-a',
          settings: {
            vnext: [{ address: 'a.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
        {
          protocol: 'vmess',
          tag: 'node-b',
          settings: {
            vnext: [{ address: 'b.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const links = exportVmessLinksFromXrayConfig(config, { tag: 'node-a' });
    expect(links).toHaveLength(1);
    // Re-parse to verify content
    const reparsed = parseVmessShareLink(links[0]);
    expect(reparsed.address).toBe('a.com');
  });

  it('filters by multiple tags', () => {
    const config = {
      outbounds: [
        {
          protocol: 'vmess',
          tag: 'node-a',
          settings: {
            vnext: [{ address: 'a.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
        {
          protocol: 'vmess',
          tag: 'node-b',
          settings: {
            vnext: [{ address: 'b.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const links = exportVmessLinksFromXrayConfig(config, {
      tag: ['node-a', 'node-b'],
    });
    expect(links).toHaveLength(2);
  });

  it('returns empty array when no vmess outbounds', () => {
    const config = { outbounds: [{ protocol: 'vless' }] };
    const links = exportVmessLinksFromXrayConfig(config);
    expect(links).toEqual([]);
  });

  it('returns empty array when config has no outbounds', () => {
    const links = exportVmessLinksFromXrayConfig({});
    expect(links).toEqual([]);
  });

  it('filters out null outbounds', () => {
    const config = {
      outbounds: [
        null,
        {
          protocol: 'vmess',
          tag: 'valid-node',
          settings: {
            vnext: [
              { address: 'valid.com', port: 443, users: [{ id: UUID }] },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const links = exportVmessLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// exportVmessLinksFromXrayConfigJson
// ---------------------------------------------------------------------------
describe('exportVmessLinksFromXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({
      outbounds: [
        {
          protocol: 'vmess',
          settings: {
            vnext: [
              { address: 'example.com', port: 443, users: [{ id: UUID }] },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
          tag: 'my-node',
        },
      ],
    });
    const links = exportVmessLinksFromXrayConfigJson(configJson);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('vmess://');
  });
});

// ---------------------------------------------------------------------------
// importVmessShareToXrayConfigJson
// ---------------------------------------------------------------------------
describe('importVmessShareToXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({ outbounds: [] });
    const result = importVmessShareToXrayConfigJson(
      configJson,
      BASIC_VMESS_SHARE,
    );
    const parsed = JSON.parse(result);
    expect(parsed.outbounds).toHaveLength(1);
    expect(parsed.outbounds[0].protocol).toBe('vmess');
  });
});
