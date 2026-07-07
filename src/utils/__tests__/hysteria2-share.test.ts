import { describe, it, expect } from 'vitest';
import {
  parseHy2ShareLink,
  formatHy2ShareLink,
  hy2ShareToXrayOutbound,
  outboundToHy2Share,
  importHy2ShareToXrayConfig,
  importHy2ShareToXrayConfigJson,
  exportHy2LinksFromXrayConfig,
  exportHy2LinksFromXrayConfigJson,
  type Hy2Share,
} from '../hysteria2-share';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASIC_LINK = 'hysteria2://password@example.com:443?up=100mbps&down=200mbps#My%20Server';

const BASIC_SHARE: Hy2Share = {
  auth: 'password',
  address: 'example.com',
  port: 443,
  name: 'My Server',
  params: {
    up: '100mbps',
    down: '200mbps',
  },
  extraParams: {},
};

function makeShare(overrides: Partial<Hy2Share> = {}): Hy2Share {
  return { ...BASIC_SHARE, ...overrides, params: { ...BASIC_SHARE.params, ...overrides.params } };
}

// ---------------------------------------------------------------------------
// parseHy2ShareLink
// ---------------------------------------------------------------------------
describe('parseHy2ShareLink', () => {
  it('parses a basic hysteria2:// link', () => {
    const result = parseHy2ShareLink(BASIC_LINK);
    expect(result.auth).toBe('password');
    expect(result.address).toBe('example.com');
    expect(result.port).toBe(443);
    expect(result.name).toBe('My Server');
    expect(result.params.up).toBe('100mbps');
    expect(result.params.down).toBe('200mbps');
  });

  it('defaults port to 443 when omitted', () => {
    const link = 'hysteria2://user@example.com';
    const result = parseHy2ShareLink(link);
    expect(result.port).toBe(443);
  });

  it('accepts hy2:// scheme', () => {
    const link = 'hy2://pass@host.com:8080';
    const result = parseHy2ShareLink(link);
    expect(result.auth).toBe('pass');
    expect(result.address).toBe('host.com');
    expect(result.port).toBe(8080);
  });

  it('parses obfs params', () => {
    const link = 'hysteria2://user@host.com:443?obfs=salamander&obfs-password=opass';
    const result = parseHy2ShareLink(link);
    expect(result.params.obfs).toBe('salamander');
    expect(result.params.obfsPassword).toBe('opass');
  });

  it('parses insecure=1 as boolean true', () => {
    const link = 'hysteria2://user@host.com:443?insecure=1';
    const result = parseHy2ShareLink(link);
    expect(result.params.insecure).toBe(true);
  });

  it('parses insecure=0 as boolean false', () => {
    const link = 'hysteria2://user@host.com:443?insecure=0';
    const result = parseHy2ShareLink(link);
    expect(result.params.insecure).toBe(false);
  });

  it('parses congestion param', () => {
    const link = 'hysteria2://user@host.com:443?congestion=bbr';
    const result = parseHy2ShareLink(link);
    expect(result.params.congestion).toBe('bbr');
  });

  it('parses portHopping param', () => {
    const link = 'hysteria2://user@host.com:443?portHopping=443,5000-6000&hopInterval=15';
    const result = parseHy2ShareLink(link);
    expect(result.params.portHopping).toBe('443,5000-6000');
    expect(result.params.hopInterval).toBe(15);
  });

  it('parses fm (finalmask) param', () => {
    const link = 'hysteria2://user@host.com:443?fm={"ips":["1.2.3.4"]}';
    const result = parseHy2ShareLink(link);
    expect(result.params.fm).toBe('{"ips":["1.2.3.4"]}');
  });

  it('parses sni and pinSHA256', () => {
    const link = 'hysteria2://user@host.com:443?sni=real.example.com&pinSHA256=abc123';
    const result = parseHy2ShareLink(link);
    expect(result.params.sni).toBe('real.example.com');
    expect(result.params.pinSHA256).toBe('abc123');
  });

  it('parses QUIC tuning params', () => {
    const link =
      'hysteria2://user@host.com:443?initStreamReceiveWindow=1048576&maxStreamReceiveWindow=4194304&initConnReceiveWindow=2097152&maxConnReceiveWindow=8388608&maxIdleTimeout=30000&keepAlivePeriod=10000';
    const result = parseHy2ShareLink(link);
    expect(result.params.initStreamReceiveWindow).toBe(1048576);
    expect(result.params.maxStreamReceiveWindow).toBe(4194304);
    expect(result.params.initConnReceiveWindow).toBe(2097152);
    expect(result.params.maxConnReceiveWindow).toBe(8388608);
    expect(result.params.maxIdleTimeout).toBe(30000);
    expect(result.params.keepAlivePeriod).toBe(10000);
  });

  it('parses disablePathMTUDiscovery', () => {
    const link = 'hysteria2://user@host.com:443?disablePathMTUDiscovery=1';
    const result = parseHy2ShareLink(link);
    expect(result.params.disablePathMTUDiscovery).toBe(true);
  });

  it('collects extra params not in KNOWN_QUERY_KEYS', () => {
    const link = 'hysteria2://user@host.com:443?customKey=customVal';
    const result = parseHy2ShareLink(link);
    expect(result.extraParams?.customKey).toBe('customVal');
  });

  it('parses IPv6 address in brackets', () => {
    const link = 'hysteria2://user@[::1]:443';
    const result = parseHy2ShareLink(link);
    expect(result.address).toBe('::1');
  });

  it('throws for invalid URL', () => {
    expect(() => parseHy2ShareLink('not-a-url')).toThrow('不是合法 URL');
  });

  it('throws for wrong protocol', () => {
    expect(() => parseHy2ShareLink('https://example.com')).toThrow('协议必须是 hysteria2 或 hy2');
  });

  it('throws for missing auth (empty password)', () => {
    const link = 'hysteria2://@example.com:443';
    expect(() => parseHy2ShareLink(link)).toThrow('auth 不可省略或为空');
  });

  it('throws for invalid port (0 is rejected by assertValidPort)', () => {
    // Port 0 is valid URL syntax but rejected by assertValidPort
    const link = 'hysteria2://user@example.com:0';
    expect(() => parseHy2ShareLink(link)).toThrow('remote-port 必须是 1 到 65535 的整数');
  });

  it('throws for invalid port (outside URL range)', () => {
    // Port > 65535 is rejected by the URL constructor
    const link = 'hysteria2://user@example.com:99999';
    expect(() => parseHy2ShareLink(link)).toThrow('不是合法 URL');
  });

  it('throws for empty hostname (rejected by URL constructor)', () => {
    const link = 'hysteria2://user@:443';
    expect(() => parseHy2ShareLink(link)).toThrow('不是合法 URL');
  });

  it('throws for unsupported obfs in strict mode', () => {
    const link = 'hysteria2://user@host.com:443?obfs=unknown';
    expect(() => parseHy2ShareLink(link)).toThrow('不支持的 obfs 类型: unknown');
  });

  it('allows unsupported obfs in non-strict mode', () => {
    const link = 'hysteria2://user@host.com:443?obfs=unknown';
    const result = parseHy2ShareLink(link, { strict: false });
    expect(result.params.obfs).toBe('unknown');
  });

  it('throws for invalid congestion in strict mode', () => {
    const link = 'hysteria2://user@host.com:443?congestion=invalid';
    expect(() => parseHy2ShareLink(link)).toThrow('不支持的 congestion: invalid');
  });

  it('allows invalid congestion in non-strict mode', () => {
    const link = 'hysteria2://user@host.com:443?congestion=invalid';
    const result = parseHy2ShareLink(link, { strict: false });
    expect(result.params.congestion).toBe('invalid');
  });

  it('ignores empty string params (assignString skips empty values)', () => {
    const link = 'hysteria2://user@host.com:443?sni=';
    const result = parseHy2ShareLink(link);
    expect(result.params.sni).toBeUndefined();
  });

  it('parses auth from username field (user@host)', () => {
    const link = 'hysteria2://secret@host.com:443';
    const result = parseHy2ShareLink(link);
    expect(result.auth).toBe('secret');
  });

  it('parses auth from password field (user:pass@host format not typical for hy2)', () => {
    // hy2 uses username as auth, so user:pass is unusual but grab username
    const link = 'hysteria2://user:pass@host.com:443';
    const result = parseHy2ShareLink(link);
    // url.username = "user", url.password = "pass", but the code uses url.username || url.password
    expect(result.auth).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// formatHy2ShareLink
// ---------------------------------------------------------------------------
describe('formatHy2ShareLink', () => {
  it('formats a basic share', () => {
    const result = formatHy2ShareLink(BASIC_SHARE);
    expect(result).toContain('hysteria2://');
    expect(result).toContain('password@');
    expect(result).toContain('example.com');
    expect(result).toContain(':443');
    expect(result).toContain('up=100mbps');
    expect(result).toContain('down=200mbps');
    expect(result).toContain('#My%20Server');
  });

  it('omits port 443 with omitDefaults', () => {
    const share = makeShare({ port: 443 });
    const result = formatHy2ShareLink(share, { omitDefaults: true });
    expect(result).not.toContain(':443');
    expect(result).toContain('password@example.com?');
  });

  it('includes non-default port even with omitDefaults', () => {
    const share = makeShare({ port: 8443 });
    const result = formatHy2ShareLink(share, { omitDefaults: true });
    expect(result).toContain(':8443');
  });

  it('omits insecure=0 with omitDefaults', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, insecure: false } });
    const result = formatHy2ShareLink(share, { omitDefaults: true });
    expect(result).not.toContain('insecure');
  });

  it('includes insecure=1 even with omitDefaults', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, insecure: true } });
    const result = formatHy2ShareLink(share, { omitDefaults: true });
    expect(result).toContain('insecure=1');
  });

  it('omits disablePathMTUDiscovery=0 with omitDefaults', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, disablePathMTUDiscovery: false } });
    const result = formatHy2ShareLink(share, { omitDefaults: true });
    expect(result).not.toContain('disablePathMTUDiscovery');
  });

  it('includes disablePathMTUDiscovery=1 even with omitDefaults', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, disablePathMTUDiscovery: true } });
    const result = formatHy2ShareLink(share, { omitDefaults: true });
    expect(result).toContain('disablePathMTUDiscovery=1');
  });

  it('includes obfs params', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, obfs: 'gecko', obfsPassword: 'opass' },
    });
    const result = formatHy2ShareLink(share);
    expect(result).toContain('obfs=gecko');
    expect(result).toContain('obfs-password=opass');
  });

  it('includes fragment as name', () => {
    const share = makeShare({ name: 'My Node' });
    const result = formatHy2ShareLink(share);
    expect(result).toContain('#My%20Node');
  });

  it('omits fragment when name is undefined', () => {
    const share = makeShare({ name: undefined });
    const result = formatHy2ShareLink(share);
    expect(result).not.toContain('#');
  });

  it('wraps IPv6 address in brackets', () => {
    const share = makeShare({ address: '::1' });
    const result = formatHy2ShareLink(share);
    expect(result).toContain('@[::1]');
  });

  it('includes extra params', () => {
    const share = makeShare({ extraParams: { customKey: 'customVal' } });
    const result = formatHy2ShareLink(share);
    expect(result).toContain('customKey=customVal');
  });

  it('encodes special characters in query values', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, up: '100 mbps' },
    });
    const result = formatHy2ShareLink(share);
    expect(result).toContain('up=100%20mbps');
  });

  it('throws for missing auth', () => {
    const share = makeShare({ auth: '' });
    expect(() => formatHy2ShareLink(share)).toThrow('auth 不可省略或为空');
  });
});

// ---------------------------------------------------------------------------
// hy2ShareToXrayOutbound
// ---------------------------------------------------------------------------
describe('hy2ShareToXrayOutbound', () => {
  it('produces protocol "hysteria"', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.protocol).toBe('hysteria');
  });

  it('sets security to "tls" with ALPN ["h3"]', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    const ss = outbound.streamSettings as any;
    expect(ss.security).toBe('tls');
    expect(ss.tlsSettings?.alpn).toEqual(['h3']);
  });

  it('sets serverName from sni', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, sni: 'sni.example.com' } });
    const outbound = hy2ShareToXrayOutbound(share);
    expect((outbound.streamSettings as any).tlsSettings?.serverName).toBe('sni.example.com');
  });

  it('falls back serverName to address when sni is not set', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    expect((outbound.streamSettings as any).tlsSettings?.serverName).toBe('example.com');
  });

  it('sets allowInsecure from insecure param', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, insecure: true } });
    const outbound = hy2ShareToXrayOutbound(share);
    expect((outbound.streamSettings as any).tlsSettings?.allowInsecure).toBe(true);
  });

  it('sets pinnedPeerCertSha256 from pinSHA256', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, pinSHA256: 'abc123' } });
    const outbound = hy2ShareToXrayOutbound(share);
    expect((outbound.streamSettings as any).tlsSettings?.pinnedPeerCertSha256).toBe('abc123');
  });

  it('sets hysteriaSettings auth and version', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect(hys.auth).toBe('password');
    expect(hys.version).toBe(2);
  });

  it('sets congestion in hysteriaSettings', () => {
    const share = makeShare({ params: { ...BASIC_SHARE.params, congestion: 'bbr' } });
    const outbound = hy2ShareToXrayOutbound(share);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect(hys.congestion).toBe('bbr');
  });

  it('sets up/down in hysteriaSettings', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect(hys.up).toBe('100mbps');
    expect(hys.down).toBe('200mbps');
  });

  it('sets udphop from portHopping', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, portHopping: '443,5000-6000', hopInterval: 15 },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect((hys.udphop as Record<string, unknown>).port).toBe('443,5000-6000');
    expect((hys.udphop as Record<string, unknown>).interval).toBe(15);
  });

  it('defaults hopInterval to 30 when not specified', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, portHopping: '443' },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect((hys.udphop as Record<string, unknown>).interval).toBe(30);
  });

  it('sets QUIC tuning params', () => {
    const share = makeShare({
      params: {
        ...BASIC_SHARE.params,
        initStreamReceiveWindow: 1048576,
        maxStreamReceiveWindow: 4194304,
      },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect(hys.initStreamReceiveWindow).toBe(1048576);
    expect(hys.maxStreamReceiveWindow).toBe(4194304);
  });

  it('sets disablePathMTUDiscovery', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, disablePathMTUDiscovery: true },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    const hys = outbound.streamSettings?.hysteriaSettings as Record<string, unknown>;
    expect(hys.disablePathMTUDiscovery).toBe(true);
  });

  it('sets gecko obfs as udpmasks', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, obfs: 'gecko', obfsPassword: 'gpass' },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    const ss = outbound.streamSettings as any;
    expect(ss.udpmasks).toBeDefined();
    expect(ss.udpmasks[0].type).toBe('gecko');
    expect(ss.udpmasks[0].settings?.password).toBe('gpass');
  });

  it('sets salamander obfs as udpmasks', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, obfs: 'salamander', obfsPassword: 'spass' },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    const ss = outbound.streamSettings as any;
    expect(ss.udpmasks[0].type).toBe('salamander');
    expect(ss.udpmasks[0].settings?.password).toBe('spass');
  });

  it('sets fm as finalmask in streamSettings', () => {
    const share = makeShare({
      params: { ...BASIC_SHARE.params, fm: '{"ips":["1.2.3.4"]}' },
    });
    const outbound = hy2ShareToXrayOutbound(share);
    expect((outbound.streamSettings as any).finalmask).toEqual({ ips: ['1.2.3.4'] });
  });

  it('sets tag from options.tag', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE, { tag: 'my-tag' });
    expect(outbound.tag).toBe('my-tag');
  });

  it('falls back tag to share.name', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.tag).toBe('My Server');
  });

  it('accepts a string link as input', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_LINK);
    expect(outbound.protocol).toBe('hysteria');
    expect(outbound.settings?.address).toBe('example.com');
  });

  it('sets network to "hysteria"', () => {
    const outbound = hy2ShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.streamSettings?.network).toBe('hysteria');
  });
});

// ---------------------------------------------------------------------------
// outboundToHy2Share
// ---------------------------------------------------------------------------
describe('outboundToHy2Share', () => {
  const MINIMAL_OUTBOUND: Record<string, any> = {
    protocol: 'hysteria',
    settings: {
      address: 'example.com',
      port: 443,
    },
    streamSettings: {
      security: 'tls',
      tlsSettings: {
        serverName: 'example.com',
        alpn: ['h3'],
        allowInsecure: false,
      },
      hysteriaSettings: {
        version: 2,
        auth: 'password',
      },
    },
  };

  it('converts a minimal outbound back to share', () => {
    const share = outboundToHy2Share(MINIMAL_OUTBOUND);
    expect(share.auth).toBe('password');
    expect(share.address).toBe('example.com');
    expect(share.port).toBe(443);
  });

  it('throws for non-hysteria protocol', () => {
    const outbound = { protocol: 'vmess', settings: {} };
    expect(() => outboundToHy2Share(outbound)).toThrow('outbound.protocol 必须是 hysteria');
  });

  it('preserves name from options', () => {
    const share = outboundToHy2Share(MINIMAL_OUTBOUND, { name: 'My Node' });
    expect(share.name).toBe('My Node');
  });

  it('falls back name to outbound.tag', () => {
    const outbound = { ...MINIMAL_OUTBOUND, tag: 'tag-name' };
    const share = outboundToHy2Share(outbound);
    expect(share.name).toBe('tag-name');
  });

  it('reads congestion, up, down from hysteriaSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        hysteriaSettings: {
          ...MINIMAL_OUTBOUND.streamSettings.hysteriaSettings,
          congestion: 'bbr',
          up: '50mbps',
          down: '100mbps',
        },
      },
    };
    const share = outboundToHy2Share(outbound);
    expect(share.params.congestion).toBe('bbr');
    expect(share.params.up).toBe('50mbps');
    expect(share.params.down).toBe('100mbps');
  });

  it('reads udpmask obfs settings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        udpmasks: [{ type: 'salamander', settings: { password: 'opass' } }],
      },
    };
    const share = outboundToHy2Share(outbound);
    expect(share.params.obfs).toBe('salamander');
    expect(share.params.obfsPassword).toBe('opass');
  });

  it('reads finalmask from streamSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        finalmask: { ips: ['1.2.3.4'] },
      },
    };
    const share = outboundToHy2Share(outbound);
    expect(share.params.fm).toBe('{"ips":["1.2.3.4"]}');
  });

  it('reads insecure from tlsSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        tlsSettings: {
          ...MINIMAL_OUTBOUND.streamSettings.tlsSettings,
          allowInsecure: true,
        },
      },
    };
    const share = outboundToHy2Share(outbound);
    expect(share.params.insecure).toBe(true);
  });

  it('reads sni from tlsSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        tlsSettings: {
          ...MINIMAL_OUTBOUND.streamSettings.tlsSettings,
          serverName: 'my-sni.com',
        },
      },
    };
    const share = outboundToHy2Share(outbound);
    expect(share.params.sni).toBe('my-sni.com');
  });

  it('reads udphop from hysteriaSettings', () => {
    const outbound: Record<string, any> = {
      ...MINIMAL_OUTBOUND,
      streamSettings: {
        ...MINIMAL_OUTBOUND.streamSettings,
        hysteriaSettings: {
          ...MINIMAL_OUTBOUND.streamSettings.hysteriaSettings,
          udphop: { port: '443,5000-6000', interval: 15 },
        },
      },
    };
    const share = outboundToHy2Share(outbound);
    expect(share.params.portHopping).toBe('443,5000-6000');
    expect(share.params.hopInterval).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip
// ---------------------------------------------------------------------------
describe('round-trip (parse → outbound → share → format)', () => {
  const roundTripCases = [
    {
      name: 'basic',
      link: 'hysteria2://password@example.com:443?up=100mbps&down=200mbps#My%20Server',
    },
    {
      name: 'non-default port',
      link: 'hysteria2://user@host.com:8443?sni=real.example.com&insecure=1#node',
    },
    {
      name: 'with obfs',
      link: 'hysteria2://user@host.com:443?obfs=gecko&obfs-password=gpass&up=50mbps#geo',
    },
    {
      name: 'with portHopping',
      link: 'hysteria2://user@host.com:443?portHopping=443%2C5000-6000&hopInterval=10',
    },
    {
      name: 'with congestion',
      link: 'hysteria2://user@host.com:443?congestion=brutal&up=500mbps&down=1gbps',
    },
    {
      name: 'IPv6',
      link: 'hysteria2://user@[::1]:443#ipv6',
    },
    {
      name: 'with all QUIC tuning',
      link: 'hysteria2://user@host.com:443?initStreamReceiveWindow=1048576&maxStreamReceiveWindow=4194304&initConnReceiveWindow=2097152&maxConnReceiveWindow=8388608&maxIdleTimeout=30000&keepAlivePeriod=10000',
    },
    {
      name: 'with fm (finalmask)',
      link: 'hysteria2://user@host.com:443?fm=%7B%22ips%22%3A%5B%221.2.3.4%22%5D%7D',
    },
  ];

  for (const { name, link } of roundTripCases) {
    it(`preserves fields through round-trip: ${name}`, () => {
      const parsed = parseHy2ShareLink(link);
      const outbound = hy2ShareToXrayOutbound(parsed);
      const backToShare = outboundToHy2Share(outbound, { name: parsed.name });
      const formatted = formatHy2ShareLink(backToShare);

      // Re-parse the formatted link and compare to original parsed
      const reparsed = parseHy2ShareLink(formatted);

      expect(reparsed.auth).toBe(parsed.auth);
      expect(reparsed.address).toBe(parsed.address);
      expect(reparsed.port).toBe(parsed.port);
      expect(reparsed.name).toBe(parsed.name);
      // Check the main params
      if (parsed.params.sni !== undefined) expect(reparsed.params.sni).toBe(parsed.params.sni);
      if (parsed.params.insecure !== undefined)
        expect(reparsed.params.insecure).toBe(parsed.params.insecure);
      if (parsed.params.up !== undefined) expect(reparsed.params.up).toBe(parsed.params.up);
      if (parsed.params.down !== undefined) expect(reparsed.params.down).toBe(parsed.params.down);
      if (parsed.params.congestion !== undefined)
        expect(reparsed.params.congestion).toBe(parsed.params.congestion);
      if (parsed.params.obfs !== undefined) expect(reparsed.params.obfs).toBe(parsed.params.obfs);
      if (parsed.params.portHopping !== undefined)
        expect(reparsed.params.portHopping).toBe(parsed.params.portHopping);
    });
  }
});

// ---------------------------------------------------------------------------
// importHy2ShareToXrayConfig
// ---------------------------------------------------------------------------
describe('importHy2ShareToXrayConfig', () => {
  function ob(result: Record<string, unknown>): any[] {
    return (result as any).outbounds ?? [];
  }

  it('append mode adds outbound to empty config', () => {
    const result = importHy2ShareToXrayConfig({}, BASIC_LINK);
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].protocol).toBe('hysteria');
  });

  it('append mode adds to existing outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importHy2ShareToXrayConfig(config, BASIC_LINK);
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('hysteria');
  });

  it('does not mutate original config', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importHy2ShareToXrayConfig(config, BASIC_LINK);
    expect(config.outbounds).toHaveLength(1);
    expect(ob(result)).toHaveLength(2);
  });

  it('replaceByTag replaces matching tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'hysteria',
          tag: 'my-node',
          settings: { address: 'old.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'old.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'old-pass' },
          },
        },
      ],
    };
    // The share's name becomes the tag; it must match the existing outbound's tag
    const share = makeShare({ name: 'my-node' });
    const result = importHy2ShareToXrayConfig(config, share, { mode: 'replaceByTag' });
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].tag).toBe('my-node');
  });

  it('replaceByTag appends when tag not found', () => {
    const config = {
      outbounds: [{ protocol: 'vmess', tag: 'other' }],
    };
    const share = makeShare({ name: 'new-node' });
    const result = importHy2ShareToXrayConfig(config, share, { mode: 'replaceByTag' });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].tag).toBe('new-node');
  });

  it('replaceByTag throws when outbound has no tag', () => {
    const share = makeShare({ name: undefined });
    expect(() => importHy2ShareToXrayConfig({}, share, { mode: 'replaceByTag' })).toThrow(
      'replaceByTag 需要提供 tag 或链接 name',
    );
  });

  it('replaceFirstHysteria2 replaces existing hysteria outbound', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        { protocol: 'hysteria', settings: { address: 'old.com', port: 443 }, streamSettings: {} },
        { protocol: 'trojan', settings: {} },
      ],
    };
    const result = importHy2ShareToXrayConfig(config, BASIC_SHARE, {
      mode: 'replaceFirstHysteria2',
    });
    expect(ob(result)).toHaveLength(3);
    expect(ob(result)[0].protocol).toBe('vmess');
    expect(ob(result)[1].settings?.address).toBe('example.com');
    expect(ob(result)[2].protocol).toBe('trojan');
  });

  it('replaceFirstHysteria2 appends when no hysteria outbound exists', () => {
    const config = {
      outbounds: [{ protocol: 'vmess', settings: {} }],
    };
    const result = importHy2ShareToXrayConfig(config, BASIC_SHARE, {
      mode: 'replaceFirstHysteria2',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('hysteria');
  });

  it('throws for unknown mode', () => {
    expect(() => importHy2ShareToXrayConfig({}, BASIC_SHARE, { mode: 'unknown' as never })).toThrow(
      '未知导入模式: unknown',
    );
  });
});

// ---------------------------------------------------------------------------
// exportHy2LinksFromXrayConfig
// ---------------------------------------------------------------------------
describe('exportHy2LinksFromXrayConfig', () => {
  it('returns hysteria2:// links from outbounds', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {}, streamSettings: {} },
        {
          protocol: 'hysteria',
          settings: { address: 'example.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'example.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'password' },
          },
          tag: 'my-node',
        },
      ],
    };
    const links = exportHy2LinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('hysteria2://');
    expect(links[0]).toContain('password@');
    expect(links[0]).toContain('example.com');
  });

  it('filters by tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'hysteria',
          tag: 'node-a',
          settings: { address: 'a.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'a.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'pass1' },
          },
        },
        {
          protocol: 'hysteria',
          tag: 'node-b',
          settings: { address: 'b.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'b.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'pass2' },
          },
        },
      ],
    };
    const links = exportHy2LinksFromXrayConfig(config, { tag: 'node-a' });
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('pass1@');
  });

  it('filters by multiple tags', () => {
    const config = {
      outbounds: [
        {
          protocol: 'hysteria',
          tag: 'node-a',
          settings: { address: 'a.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'a.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'pass1' },
          },
        },
        {
          protocol: 'hysteria',
          tag: 'node-b',
          settings: { address: 'b.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'b.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'pass2' },
          },
        },
      ],
    };
    const links = exportHy2LinksFromXrayConfig(config, { tag: ['node-a', 'node-b'] });
    expect(links).toHaveLength(2);
  });

  it('returns empty array when no hysteria outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess' }] };
    const links = exportHy2LinksFromXrayConfig(config);
    expect(links).toEqual([]);
  });

  it('returns empty array when config has no outbounds', () => {
    const links = exportHy2LinksFromXrayConfig({});
    expect(links).toEqual([]);
  });

  it('filters out null outbounds before processing', () => {
    const config = {
      outbounds: [
        null,
        {
          protocol: 'hysteria',
          tag: 'valid-node',
          settings: { address: 'valid.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'valid.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'vpass' },
          },
        },
      ],
    };
    const links = exportHy2LinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('vpass@');
  });
});

// ---------------------------------------------------------------------------
// exportHy2LinksFromXrayConfigJson
// ---------------------------------------------------------------------------
describe('exportHy2LinksFromXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({
      outbounds: [
        {
          protocol: 'hysteria',
          settings: { address: 'example.com', port: 443 },
          streamSettings: {
            security: 'tls',
            tlsSettings: { serverName: 'example.com', alpn: ['h3'], allowInsecure: false },
            hysteriaSettings: { version: 2, auth: 'password' },
          },
          tag: 'my-node',
        },
      ],
    });
    const links = exportHy2LinksFromXrayConfigJson(configJson);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('hysteria2://');
  });
});

// ---------------------------------------------------------------------------
// importHy2ShareToXrayConfigJson
// ---------------------------------------------------------------------------
describe('importHy2ShareToXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({ outbounds: [] });
    const result = importHy2ShareToXrayConfigJson(configJson, BASIC_SHARE);
    const parsed = JSON.parse(result);
    expect(parsed.outbounds).toHaveLength(1);
    expect(parsed.outbounds[0].protocol).toBe('hysteria');
  });
});
