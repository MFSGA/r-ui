import { describe, it, expect } from 'vitest';
import {
  parseVlessShareLink,
  formatVlessShareLink,
  vlessShareToXrayOutbound,
  outboundToVlessShare,
  importVlessShareToXrayConfig,
  importVlessShareToXrayConfigJson,
  exportVlessLinksFromXrayConfig,
  exportVlessLinksFromXrayConfigJson,
  type VlessShare,
} from '../vless-share';

// ---------------------------------------------------------------------------
// Helpers & constants
// ---------------------------------------------------------------------------
const UUID = '550e8400-e29b-41d4-a716-446655440000';
const PBK = 'z66V3hZtNKqX5gQeyFN3JED7LwY5p4LxqThM5QjXvQQ';

const BASIC_REALITY_LINK =
  `vless://${UUID}@example.com:443?type=tcp&security=reality&pbk=${PBK}&sid=6ba85179e30d&fp=chrome&flow=xtls-rprx-vision&encryption=none#My%20Server`;

const BASIC_REALITY_SHARE: VlessShare = {
  id: UUID,
  address: 'example.com',
  port: 443,
  name: 'My Server',
  params: {
    type: 'tcp',
    encryption: 'none',
    security: 'reality',
    flow: 'xtls-rprx-vision',
    fp: 'chrome',
    pbk: PBK,
    sid: '6ba85179e30d',
  },
  extraParams: {},
};

function makeShare(overrides: Partial<VlessShare> = {}): VlessShare {
  return {
    ...BASIC_REALITY_SHARE,
    ...overrides,
    params: { ...BASIC_REALITY_SHARE.params, ...overrides.params },
  };
}

// ---------------------------------------------------------------------------
// parseVlessShareLink
// ---------------------------------------------------------------------------
describe('parseVlessShareLink', () => {
  it('parses a basic vless:// link with REALITY', () => {
    const result = parseVlessShareLink(BASIC_REALITY_LINK);
    expect(result.id).toBe(UUID);
    expect(result.address).toBe('example.com');
    expect(result.port).toBe(443);
    expect(result.name).toBe('My Server');
    expect(result.params.type).toBe('tcp');
    expect(result.params.security).toBe('reality');
    expect(result.params.pbk).toBe(PBK);
    expect(result.params.sid).toBe('6ba85179e30d');
    expect(result.params.fp).toBe('chrome');
    expect(result.params.flow).toBe('xtls-rprx-vision');
    expect(result.params.encryption).toBe('none');
  });

  it('parses TCP transport with TLS security', () => {
    const link =
      `vless://${UUID}@example.com:443?type=tcp&security=tls&fp=chrome&sni=real.example.com&alpn=h2%2Chttp%2F1.1`;
    const result = parseVlessShareLink(link);
    expect(result.params.type).toBe('tcp');
    expect(result.params.security).toBe('tls');
    expect(result.params.sni).toBe('real.example.com');
    expect(result.params.alpn).toEqual(['h2', 'http/1.1']);
    expect(result.params.fp).toBe('chrome');
  });

  it('parses WebSocket transport', () => {
    const link =
      `vless://${UUID}@example.com:443?type=ws&security=none&path=%2Fws&host=ws.example.com`;
    const result = parseVlessShareLink(link);
    expect(result.params.type).toBe('ws');
    expect(result.params.path).toBe('/ws');
    expect(result.params.host).toBe('ws.example.com');
  });

  it('parses gRPC transport', () => {
    const link =
      `vless://${UUID}@example.com:443?type=grpc&security=tls&serviceName=mygrpc&authority=grpc.example.com&mode=multi`;
    const result = parseVlessShareLink(link);
    expect(result.params.type).toBe('grpc');
    expect(result.params.serviceName).toBe('mygrpc');
    expect(result.params.authority).toBe('grpc.example.com');
    expect(result.params.mode).toBe('multi');
  });

  it('parses XHTTP transport', () => {
    const link =
      `vless://${UUID}@example.com:443?type=xhttp&security=reality&pbk=${PBK}&fp=chrome&path=%2Fxhttp&mode=auto`;
    const result = parseVlessShareLink(link);
    expect(result.params.type).toBe('xhttp');
    expect(result.params.path).toBe('/xhttp');
    expect(result.params.mode).toBe('auto');
  });

  it('parses KCP transport', () => {
    const link =
      `vless://${UUID}@example.com:443?type=kcp&security=none&mtu=1400&tti=20&seed=myseed&headerType=none&encryption=none`;
    const result = parseVlessShareLink(link);
    expect(result.params.type).toBe('kcp');
    expect(result.params.mtu).toBe(1400);
    expect(result.params.tti).toBe(20);
    expect(result.params.seed).toBe('myseed');
    expect(result.params.headerType).toBe('none');
  });

  it('parses IPv6 address in brackets', () => {
    const link = `vless://${UUID}@[::1]:443?security=none`;
    const result = parseVlessShareLink(link);
    expect(result.address).toBe('::1');
    expect(result.port).toBe(443);
  });

  it('defaults type to tcp and security to none when omitted', () => {
    const link = `vless://${UUID}@example.com:443`;
    const result = parseVlessShareLink(link);
    expect(result.params.type).toBe('tcp');
    expect(result.params.security).toBe('none');
  });

  it('collects extra params not in KNOWN_QUERY_KEYS', () => {
    const link =
      `vless://${UUID}@example.com:443?security=none&customKey=customVal`;
    const result = parseVlessShareLink(link);
    expect(result.extraParams?.customKey).toBe('customVal');
  });

  it('parses alpn as comma-separated array', () => {
    const link =
      `vless://${UUID}@example.com:443?security=tls&alpn=h2%2Chttp%2F1.1%2Chttp%2F1.0`;
    const result = parseVlessShareLink(link);
    expect(result.params.alpn).toEqual(['h2', 'http/1.1', 'http/1.0']);
  });

  it('throws for invalid URL', () => {
    expect(() => parseVlessShareLink('not-a-url')).toThrow('不是合法 URL');
  });

  it('throws for wrong protocol', () => {
    expect(() => parseVlessShareLink('https://example.com')).toThrow(
      '协议必须是 vless',
    );
  });

  it('throws for missing uuid', () => {
    const link = 'vless://@example.com:443';
    expect(() => parseVlessShareLink(link)).toThrow('uuid/id 不可省略或为空');
  });

  it('throws for empty hostname (URL constructor rejects it)', () => {
    const link = 'vless://uuid@:443';
    expect(() => parseVlessShareLink(link)).toThrow('不是合法 URL');
  });

  it('throws for invalid port (0)', () => {
    const link = 'vless://uuid@example.com:0';
    expect(() => parseVlessShareLink(link)).toThrow(
      'remote-port 必须是 1 到 65535 的整数',
    );
  });

  it('throws for invalid port (>65535)', () => {
    const link = 'vless://uuid@example.com:99999';
    expect(() => parseVlessShareLink(link)).toThrow('不是合法 URL');
  });

  it('throws for unsupported type in strict mode', () => {
    const link = `vless://${UUID}@example.com:443?type=unknown`;
    expect(() => parseVlessShareLink(link)).toThrow('不支持的 type: unknown');
  });

  it('allows unsupported type in non-strict mode', () => {
    const link = `vless://${UUID}@example.com:443?type=unknown`;
    const result = parseVlessShareLink(link, { strict: false });
    expect(result.params.type).toBe('unknown');
  });

  it('ignores empty fp string (assignString skips empty values)', () => {
    // Empty query params are skipped by assignString, so fp remains undefined
    const link = `vless://${UUID}@example.com:443?security=tls&fp=`;
    const result = parseVlessShareLink(link);
    expect(result.params.fp).toBeUndefined();
  });

  it('throws for empty alpn items', () => {
    const link = `vless://${UUID}@example.com:443?security=tls&alpn=h2,,http/1.1`;
    expect(() => parseVlessShareLink(link)).toThrow('alpn 中不可包含空字符串');
  });

  it('ignores empty ws path (assignString skips empty values)', () => {
    // Empty query params are skipped by assignString, so path remains undefined
    const link = `vless://${UUID}@example.com:443?type=ws&security=none&path=`;
    const result = parseVlessShareLink(link);
    expect(result.params.path).toBeUndefined();
  });

  it('ignores empty grpc serviceName (assignString skips empty values)', () => {
    const link = `vless://${UUID}@example.com:443?type=grpc&security=none&serviceName=`;
    const result = parseVlessShareLink(link);
    expect(result.params.serviceName).toBeUndefined();
  });

  it('throws for REALITY without pbk', () => {
    const link = `vless://${UUID}@example.com:443?type=tcp&security=reality`;
    expect(() => parseVlessShareLink(link)).toThrow('REALITY pbk 不可省略或为空');
  });

  it('allows REALITY without fp in non-strict mode', () => {
    const link = `vless://${UUID}@example.com:443?type=tcp&security=reality&pbk=${PBK}`;
    const result = parseVlessShareLink(link, { strict: false });
    expect(result.params.security).toBe('reality');
    expect(result.params.pbk).toBe(PBK);
  });

  it('parses fragment as name', () => {
    const link = `vless://${UUID}@example.com:443?security=none#My%20Node`;
    const result = parseVlessShareLink(link);
    expect(result.name).toBe('My Node');
  });

  it('leaves name undefined when no fragment', () => {
    const link = `vless://${UUID}@example.com:443?security=none`;
    const result = parseVlessShareLink(link);
    expect(result.name).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatVlessShareLink
// ---------------------------------------------------------------------------
describe('formatVlessShareLink', () => {
  it('formats a basic REALITY share', () => {
    const result = formatVlessShareLink(BASIC_REALITY_SHARE);
    expect(result).toContain('vless://');
    expect(result).toContain(encodeURIComponent(UUID) + '@');
    expect(result).toContain('example.com');
    expect(result).toContain(':443');
    expect(result).toContain('type=tcp');
    expect(result).toContain('security=reality');
    expect(result).toContain('pbk=' + encodeURIComponent(PBK));
    expect(result).toContain('flow=xtls-rprx-vision');
    expect(result).toContain('#My%20Server');
  });

  it('includes fragment as name', () => {
    const share = makeShare({ name: 'My Node' });
    const result = formatVlessShareLink(share);
    expect(result).toContain('#My%20Node');
  });

  it('omits fragment when name is undefined', () => {
    const share = makeShare({ name: undefined });
    const result = formatVlessShareLink(share);
    expect(result).not.toContain('#');
  });

  it('wraps IPv6 address in brackets', () => {
    const share = makeShare({ address: '::1' });
    const result = formatVlessShareLink(share);
    expect(result).toContain('@[::1]');
  });

  it('includes extra params', () => {
    const share = makeShare({ extraParams: { customKey: 'customVal' } });
    const result = formatVlessShareLink(share);
    expect(result).toContain('customKey=customVal');
  });

  it('encodes special characters in query values', () => {
    const share = makeShare({
      params: { ...BASIC_REALITY_SHARE.params, path: '/my path' },
    });
    const result = formatVlessShareLink(share);
    expect(result).toContain('path=%2Fmy%20path');
  });

  it('throws for missing id', () => {
    const share = makeShare({ id: '' });
    expect(() => formatVlessShareLink(share)).toThrow('uuid/id 不可省略或为空');
  });

  it('throws for missing address', () => {
    const share = makeShare({ address: '' });
    expect(() => formatVlessShareLink(share)).toThrow(
      'remote-host 不可省略或为空',
    );
  });
});

// ---------------------------------------------------------------------------
// vlessShareToXrayOutbound
// ---------------------------------------------------------------------------
describe('vlessShareToXrayOutbound', () => {
  it('produces protocol "vless"', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE);
    expect(outbound.protocol).toBe('vless');
  });

  it('sets vnext address, port, and user fields', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE);
    const vnext = (outbound.settings?.vnext as any[])[0];
    expect(vnext.address).toBe('example.com');
    expect(vnext.port).toBe(443);
    expect(vnext.users[0].id).toBe(UUID);
    expect(vnext.users[0].encryption).toBe('none');
    expect(vnext.users[0].flow).toBe('xtls-rprx-vision');
  });

  it('sets streamSettings.network to "raw" for TCP (preferRawNetwork=true)', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE);
    expect(outbound.streamSettings?.network).toBe('raw');
  });

  it('sets streamSettings.network to "tcp" when preferRawNetwork=false', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE, {
      preferRawNetwork: false,
    });
    expect(outbound.streamSettings?.network).toBe('tcp');
  });

  it('sets REALITY stream settings', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE);
    const ss = outbound.streamSettings as any;
    expect(ss.security).toBe('reality');
    expect(ss.realitySettings.fingerprint).toBe('chrome');
    expect(ss.realitySettings.password).toBe(PBK);
    expect(ss.realitySettings.shortId).toBe('6ba85179e30d');
  });

  it('sets TLS stream settings', () => {
    const share = makeShare({
      params: {
        ...BASIC_REALITY_SHARE.params,
        security: 'tls',
        pbk: undefined,
        sid: undefined,
        fp: 'chrome',
        sni: 'sni.example.com',
        alpn: ['h2', 'http/1.1'],
      },
    });
    const outbound = vlessShareToXrayOutbound(share);
    const ss = outbound.streamSettings as any;
    expect(ss.security).toBe('tls');
    expect(ss.tlsSettings.serverName).toBe('sni.example.com');
    expect(ss.tlsSettings.fingerprint).toBe('chrome');
    expect(ss.tlsSettings.alpn).toEqual(['h2', 'http/1.1']);
  });

  it('sets wsSettings for WebSocket transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_REALITY_SHARE.params,
        type: 'ws',
        security: 'none',
        pbk: undefined,
        sid: undefined,
        path: '/ws',
        host: 'ws.example.com',
      },
    });
    const outbound = vlessShareToXrayOutbound(share);
    const ws = (outbound.streamSettings as any).wsSettings;
    expect(ws.path).toBe('/ws');
    expect(ws.host).toBe('ws.example.com');
  });

  it('sets grpcSettings for gRPC transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_REALITY_SHARE.params,
        type: 'grpc',
        security: 'tls',
        pbk: undefined,
        sid: undefined,
        serviceName: 'mygrpc',
        authority: 'grpc.example.com',
        mode: 'multi',
      },
    });
    const outbound = vlessShareToXrayOutbound(share);
    const grpc = (outbound.streamSettings as any).grpcSettings;
    expect(grpc.serviceName).toBe('mygrpc');
    expect(grpc.authority).toBe('grpc.example.com');
    expect(grpc.multiMode).toBe(true);
  });

  it('sets xhttpSettings for XHTTP transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_REALITY_SHARE.params,
        type: 'xhttp',
        security: 'reality',
        path: '/xhttp',
        mode: 'auto',
      },
    });
    const outbound = vlessShareToXrayOutbound(share);
    const xhttp = (outbound.streamSettings as any).xhttpSettings;
    expect(xhttp.path).toBe('/xhttp');
    expect(xhttp.mode).toBe('auto');
  });

  it('sets kcpSettings for KCP transport', () => {
    const share = makeShare({
      params: {
        ...BASIC_REALITY_SHARE.params,
        type: 'kcp',
        security: 'none',
        pbk: undefined,
        sid: undefined,
        mtu: 1400,
        tti: 20,
        seed: 'myseed',
        headerType: 'none',
      },
    });
    const outbound = vlessShareToXrayOutbound(share);
    const kcp = (outbound.streamSettings as any).kcpSettings;
    expect(kcp.mtu).toBe(1400);
    expect(kcp.tti).toBe(20);
    expect(kcp.seed).toBe('myseed');
    expect(kcp.header.type).toBe('none');
  });

  it('sets tag from options.tag', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE, {
      tag: 'my-tag',
    });
    expect(outbound.tag).toBe('my-tag');
  });

  it('falls back tag to share.name', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE);
    expect(outbound.tag).toBe('My Server');
  });

  it('accepts a string link as input', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_LINK);
    expect(outbound.protocol).toBe('vless');
  });

  it('sets finalmask from fm param', () => {
    const share = makeShare({
      params: {
        ...BASIC_REALITY_SHARE.params,
        fm: '{"ips":["1.2.3.4"]}',
      },
    });
    const outbound = vlessShareToXrayOutbound(share);
    expect((outbound.streamSettings as any).finalmask).toEqual({
      ips: ['1.2.3.4'],
    });
  });

  it('sets realityPasswordField to publicKey when option is set', () => {
    const outbound = vlessShareToXrayOutbound(BASIC_REALITY_SHARE, {
      realityPasswordField: 'publicKey',
    });
    expect(
      (outbound.streamSettings as any).realitySettings.password,
    ).toBeUndefined();
    expect(
      (outbound.streamSettings as any).realitySettings.publicKey,
    ).toBe(PBK);
  });
});

// ---------------------------------------------------------------------------
// outboundToVlessShare
// ---------------------------------------------------------------------------
describe('outboundToVlessShare', () => {
  const MINIMAL_OUTBOUND: Record<string, any> = {
    protocol: 'vless',
    settings: {
      vnext: [
        {
          address: 'example.com',
          port: 443,
          users: [{ id: UUID, encryption: 'none', flow: 'xtls-rprx-vision' }],
        },
      ],
    },
    streamSettings: {
      network: 'raw',
      security: 'reality',
      realitySettings: {
        fingerprint: 'chrome',
        password: PBK,
        shortId: '6ba85179e30d',
      },
    },
    tag: 'My Server',
  };

  it('converts a minimal outbound back to share', () => {
    const share = outboundToVlessShare(MINIMAL_OUTBOUND);
    expect(share.id).toBe(UUID);
    expect(share.address).toBe('example.com');
    expect(share.port).toBe(443);
    expect(share.params.encryption).toBe('none');
    expect(share.params.flow).toBe('xtls-rprx-vision');
  });

  it('throws for non-vless protocol', () => {
    const outbound = { protocol: 'vmess', settings: {} };
    expect(() => outboundToVlessShare(outbound)).toThrow(
      'outbound.protocol 必须是 vless',
    );
  });

  it('preserves name from options', () => {
    const share = outboundToVlessShare(MINIMAL_OUTBOUND, { name: 'My Node' });
    expect(share.name).toBe('My Node');
  });

  it('falls back name to outbound.tag', () => {
    const share = outboundToVlessShare(MINIMAL_OUTBOUND);
    expect(share.name).toBe('My Server');
  });

  it('reads REALITY fields', () => {
    const share = outboundToVlessShare(MINIMAL_OUTBOUND);
    expect(share.params.security).toBe('reality');
    expect(share.params.pbk).toBe(PBK);
    expect(share.params.fp).toBe('chrome');
    expect(share.params.sid).toBe('6ba85179e30d');
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
    const share = outboundToVlessShare(outbound);
    expect(share.params.security).toBe('tls');
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
    const share = outboundToVlessShare(outbound);
    expect(share.params.type).toBe('ws');
    expect(share.params.path).toBe('/ws');
    expect(share.params.host).toBe('ws.example.com');
  });

  it('reads grpcSettings for gRPC', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        network: 'grpc',
        security: 'none',
        grpcSettings: {
          serviceName: 'mygrpc',
          authority: 'grpc.example.com',
          multiMode: true,
        },
      },
    };
    const share = outboundToVlessShare(outbound);
    expect(share.params.type).toBe('grpc');
    expect(share.params.serviceName).toBe('mygrpc');
    expect(share.params.authority).toBe('grpc.example.com');
    expect(share.params.mode).toBe('multi');
  });

  it('reads finalmask from streamSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        finalmask: { ips: ['1.2.3.4'] },
      },
    };
    const share = outboundToVlessShare(outbound);
    expect(share.params.fm).toBe('{"ips":["1.2.3.4"]}');
  });

  it('handles simplified settings structure (settings.address/port/id)', () => {
    const outbound: Record<string, any> = {
      protocol: 'vless',
      settings: {
        address: 'simple.com',
        port: 8080,
        id: UUID,
        encryption: 'none',
      },
      streamSettings: {
        network: 'tcp',
        security: 'none',
      },
    };
    const share = outboundToVlessShare(outbound);
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
      name: 'REALITY TCP',
      link: BASIC_REALITY_LINK,
    },
    {
      name: 'TLS TCP',
      link:
        `vless://${UUID}@example.com:443?type=tcp&security=tls&sni=sni.example.com&fp=chrome&alpn=h2%2Chttp%2F1.1#tls-node`,
    },
    {
      name: 'WebSocket no security',
      link:
        `vless://${UUID}@ws.example.com:8080?type=ws&security=none&path=%2Fws&host=ws.example.com#ws-node`,
    },
    {
      name: 'gRPC multi',
      link:
        `vless://${UUID}@grpc.example.com:443?type=grpc&security=tls&serviceName=mygrpc&mode=multi&sni=grpc.example.com&fp=chrome#grpc-node`,
    },
    {
      name: 'XHTTP REALITY',
      link:
        `vless://${UUID}@xhttp.example.com:443?type=xhttp&security=reality&pbk=${PBK}&fp=chrome&path=%2Fxhttp&mode=auto&sid=abc123#xhttp-node`,
    },
    {
      name: 'KCP',
      link:
        `vless://${UUID}@kcp.example.com:443?type=kcp&security=none&mtu=1400&tti=20&seed=myseed&headerType=none#kcp-node`,
    },
    {
      name: 'IPv6',
      link: `vless://${UUID}@[::1]:443?security=none#ipv6`,
    },
  ];

  for (const { name, link } of roundTripCases) {
    it(`preserves fields through round-trip: ${name}`, () => {
      const parsed = parseVlessShareLink(link);
      const outbound = vlessShareToXrayOutbound(parsed);
      const backToShare = outboundToVlessShare(outbound, {
        name: parsed.name,
      });
      const formatted = formatVlessShareLink(backToShare);

      const reparsed = parseVlessShareLink(formatted);

      expect(reparsed.id).toBe(parsed.id);
      expect(reparsed.address).toBe(parsed.address);
      expect(reparsed.port).toBe(parsed.port);
      expect(reparsed.name).toBe(parsed.name);
      expect(reparsed.params.type).toBe(parsed.params.type);
      expect(reparsed.params.security).toBe(parsed.params.security);

      if (parsed.params.flow !== undefined)
        expect(reparsed.params.flow).toBe(parsed.params.flow);
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
// importVlessShareToXrayConfig
// ---------------------------------------------------------------------------
describe('importVlessShareToXrayConfig', () => {
  function ob(result: Record<string, unknown>): any[] {
    return (result as any).outbounds ?? [];
  }

  it('append mode adds outbound to empty config', () => {
    const result = importVlessShareToXrayConfig({}, BASIC_REALITY_LINK);
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].protocol).toBe('vless');
  });

  it('append mode adds to existing outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importVlessShareToXrayConfig(config, BASIC_REALITY_LINK);
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('vless');
  });

  it('does not mutate original config', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importVlessShareToXrayConfig(config, BASIC_REALITY_LINK);
    expect(config.outbounds).toHaveLength(1);
    expect(ob(result)).toHaveLength(2);
  });

  it('replaceByTag replaces matching tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'vless',
          tag: 'my-node',
          settings: {
            vnext: [{ address: 'old.com', port: 443, users: [{ id: UUID }] }],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const share = makeShare({ name: 'my-node' });
    const result = importVlessShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].tag).toBe('my-node');
  });

  it('replaceByTag appends when tag not found', () => {
    const config = { outbounds: [{ protocol: 'vmess', tag: 'other' }] };
    const share = makeShare({ name: 'new-node' });
    const result = importVlessShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].tag).toBe('new-node');
  });

  it('replaceByTag throws when outbound has no tag', () => {
    const share = makeShare({ name: undefined });
    expect(() =>
      importVlessShareToXrayConfig({}, share, { mode: 'replaceByTag' }),
    ).toThrow('replaceByTag 需要提供 tag 或链接 name');
  });

  it('replaceFirstVless replaces existing vless outbound', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        {
          protocol: 'vless',
          settings: {
            vnext: [
              {
                address: 'old.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
        { protocol: 'trojan', settings: {} },
      ],
    };
    const result = importVlessShareToXrayConfig(
      config,
      BASIC_REALITY_SHARE,
      { mode: 'replaceFirstVless' },
    );
    expect(ob(result)).toHaveLength(3);
    expect(ob(result)[0].protocol).toBe('vmess');
    expect(ob(result)[1].protocol).toBe('vless');
    expect(ob(result)[1].settings.vnext[0].address).toBe('example.com');
    expect(ob(result)[2].protocol).toBe('trojan');
  });

  it('replaceFirstVless appends when no vless outbound exists', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importVlessShareToXrayConfig(
      config,
      BASIC_REALITY_SHARE,
      { mode: 'replaceFirstVless' },
    );
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('vless');
  });

  it('throws for unknown mode', () => {
    expect(() =>
      importVlessShareToXrayConfig({}, BASIC_REALITY_SHARE, {
        mode: 'unknown' as never,
      }),
    ).toThrow('未知导入模式: unknown');
  });
});

// ---------------------------------------------------------------------------
// exportVlessLinksFromXrayConfig
// ---------------------------------------------------------------------------
describe('exportVlessLinksFromXrayConfig', () => {
  it('returns vless:// links from outbounds', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        {
          protocol: 'vless',
          settings: {
            vnext: [
              {
                address: 'example.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
          tag: 'my-node',
        },
      ],
    };
    const links = exportVlessLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('vless://');
    expect(links[0]).toContain(UUID + '@');
    expect(links[0]).toContain('example.com');
  });

  it('filters by tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'vless',
          tag: 'node-a',
          settings: {
            vnext: [
              {
                address: 'a.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
        {
          protocol: 'vless',
          tag: 'node-b',
          settings: {
            vnext: [
              {
                address: 'b.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const links = exportVlessLinksFromXrayConfig(config, { tag: 'node-a' });
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('a.com');
  });

  it('filters by multiple tags', () => {
    const config = {
      outbounds: [
        {
          protocol: 'vless',
          tag: 'node-a',
          settings: {
            vnext: [
              {
                address: 'a.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
        {
          protocol: 'vless',
          tag: 'node-b',
          settings: {
            vnext: [
              {
                address: 'b.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const links = exportVlessLinksFromXrayConfig(config, {
      tag: ['node-a', 'node-b'],
    });
    expect(links).toHaveLength(2);
  });

  it('returns empty array when no vless outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess' }] };
    const links = exportVlessLinksFromXrayConfig(config);
    expect(links).toEqual([]);
  });

  it('returns empty array when config has no outbounds', () => {
    const links = exportVlessLinksFromXrayConfig({});
    expect(links).toEqual([]);
  });

  it('filters out null outbounds before processing', () => {
    const config = {
      outbounds: [
        null,
        {
          protocol: 'vless',
          tag: 'valid-node',
          settings: {
            vnext: [
              {
                address: 'valid.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
        },
      ],
    };
    const links = exportVlessLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// exportVlessLinksFromXrayConfigJson
// ---------------------------------------------------------------------------
describe('exportVlessLinksFromXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({
      outbounds: [
        {
          protocol: 'vless',
          settings: {
            vnext: [
              {
                address: 'example.com',
                port: 443,
                users: [{ id: UUID, encryption: 'none' }],
              },
            ],
          },
          streamSettings: { network: 'raw', security: 'none' },
          tag: 'my-node',
        },
      ],
    });
    const links = exportVlessLinksFromXrayConfigJson(configJson);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('vless://');
  });
});

// ---------------------------------------------------------------------------
// importVlessShareToXrayConfigJson
// ---------------------------------------------------------------------------
describe('importVlessShareToXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({ outbounds: [] });
    const result = importVlessShareToXrayConfigJson(
      configJson,
      BASIC_REALITY_SHARE,
    );
    const parsed = JSON.parse(result);
    expect(parsed.outbounds).toHaveLength(1);
    expect(parsed.outbounds[0].protocol).toBe('vless');
  });
});
