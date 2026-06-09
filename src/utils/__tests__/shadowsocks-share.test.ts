import { describe, it, expect } from 'vitest';
import {
  parseShadowsocksShareLink,
  formatShadowsocksShareLink,
  shadowsocksShareToXrayOutbound,
  outboundToShadowsocksShare,
  importShadowsocksShareToXrayConfig,
  importShadowsocksShareToXrayConfigJson,
  exportShadowsocksLinksFromXrayConfig,
  exportShadowsocksLinksFromXrayConfigJson,
  type SsShare,
} from '../shadowsocks-share';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSsLink(opts: {
  method?: string;
  password?: string;
  address?: string;
  port?: number;
  name?: string;
  plugin?: string;
  pluginOpts?: string;
}): string {
  const method = opts.method ?? 'aes-256-gcm';
  const password = opts.password ?? 'password';
  const address = opts.address ?? 'example.com';
  const port = opts.port ?? 443;
  const name = opts.name;

  // SS format: base64(method:password@host:port)?query#name
  const raw = `${method}:${password}@${address}:${port}`;
  const b64 = btoa(raw);

  const parts: string[] = [];
  if (opts.plugin) parts.push(`plugin=${encodeURIComponent(opts.plugin)}`);
  if (opts.pluginOpts)
    parts.push(`pluginOpts=${encodeURIComponent(opts.pluginOpts)}`);

  const query = parts.length > 0 ? `?${parts.join('&')}` : '';
  const fragment = name ? `#${encodeURIComponent(name)}` : '';

  return `ss://${b64}${query}${fragment}`;
}

const BASIC_LINK = makeSsLink({ name: 'My%20Server' });

const BASIC_SHARE: SsShare = {
  password: 'password',
  method: 'aes-256-gcm',
  address: 'example.com',
  port: 443,
  name: 'My%20Server',
  params: {},
  extraParams: {},
};

function makeShare(overrides: Partial<SsShare> = {}): SsShare {
  return {
    ...BASIC_SHARE,
    ...overrides,
    params: { ...BASIC_SHARE.params, ...overrides.params },
  };
}

// ---------------------------------------------------------------------------
// parseShadowsocksShareLink
// ---------------------------------------------------------------------------
describe('parseShadowsocksShareLink', () => {
  it('parses a basic ss:// link', () => {
    const result = parseShadowsocksShareLink(BASIC_LINK);
    expect(result.method).toBe('aes-256-gcm');
    expect(result.password).toBe('password');
    expect(result.address).toBe('example.com');
    expect(result.port).toBe(443);
    expect(result.name).toBe('My%20Server');
  });

  it('parses chacha20-ietf-poly1305 cipher', () => {
    const link = makeSsLink({ method: 'chacha20-ietf-poly1305' });
    const result = parseShadowsocksShareLink(link);
    expect(result.method).toBe('chacha20-ietf-poly1305');
  });

  it('parses aes-128-gcm cipher', () => {
    const link = makeSsLink({ method: 'aes-128-gcm' });
    const result = parseShadowsocksShareLink(link);
    expect(result.method).toBe('aes-128-gcm');
  });

  it('parses 2022-blake3 cipher in non-strict mode', () => {
    const link = makeSsLink({ method: '2022-blake3-aes-128-gcm' });
    const result = parseShadowsocksShareLink(link, { strict: false });
    expect(result.method).toBe('2022-blake3-aes-128-gcm');
  });

  it('parses SIP002 plugin params', () => {
    const link = makeSsLink({
      plugin: 'obfs-local',
      pluginOpts: 'obfs=http;obfs-host=bing.com',
    });
    const result = parseShadowsocksShareLink(link);
    expect(result.params.plugin).toBe('obfs-local');
    expect(result.params.pluginOpts).toBe('obfs=http;obfs-host=bing.com');
  });

  it('parses protocol and obfs params', () => {
    const link = makeSsLink({}) + '?protocol=auth_aes128_sha1&obfs=http&obfsHost=cloudfront.net';
    const result = parseShadowsocksShareLink(link);
    expect(result.params.protocol).toBe('auth_aes128_sha1');
    expect(result.params.obfs).toBe('http');
    expect(result.params.obfsHost).toBe('cloudfront.net');
  });

  it('collects extra query params', () => {
    const link = makeSsLink({}) + '?customKey=customVal';
    const result = parseShadowsocksShareLink(link);
    expect(result.extraParams?.customKey).toBe('customVal');
  });

  it('parses IPv6 address', () => {
    const link = makeSsLink({ address: '::1' });
    const result = parseShadowsocksShareLink(link);
    expect(result.address).toBe('::1');
  });

  it('handles URL-safe base64 (with - and _)', () => {
    // Create a link with URL-safe base64 encoding
    const raw = 'aes-256-gcm:password@example.com:443';
    const stdB64 = btoa(raw);
    const urlSafe = stdB64.replace(/\+/g, '-').replace(/\//g, '_');
    // Remove trailing padding as well (some clients do this)
    const noPad = urlSafe.replace(/=+$/, '');
    const link = `ss://${noPad}`;
    const result = parseShadowsocksShareLink(link);
    expect(result.method).toBe('aes-256-gcm');
    expect(result.password).toBe('password');
    expect(result.address).toBe('example.com');
    expect(result.port).toBe(443);
  });

  it('parses fragment as name', () => {
    const link = makeSsLink({ name: 'My Node' });
    const result = parseShadowsocksShareLink(link);
    expect(result.name).toBe('My Node');
  });

  it('leaves name undefined when no fragment', () => {
    const link = makeSsLink({});
    const result = parseShadowsocksShareLink(link);
    expect(result.name).toBeUndefined();
  });

  it('throws for wrong protocol', () => {
    expect(() => parseShadowsocksShareLink('vmess://...')).toThrow(
      '协议必须是 ss',
    );
  });

  it('throws for missing @ in decoded content', () => {
    const link = `ss://${btoa('aes-256-gcm:password')}`;
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      'SS 链接格式无效：缺少 @',
    );
  });

  it('throws for missing method:password separator', () => {
    const link = `ss://${btoa('justpassword@example.com:443')}`;
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      'SS 链接格式无效：缺少 method:password 分隔',
    );
  });

  it('throws for missing port', () => {
    const link = `ss://${btoa('aes-256-gcm:password@example.com')}`;
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      'SS 链接格式无效：缺少 port',
    );
  });

  it('throws for empty method', () => {
    const link = `ss://${btoa(':password@example.com:443')}`;
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      'method 不可省略或为空',
    );
  });

  it('throws for empty password', () => {
    const link = `ss://${btoa('aes-256-gcm:@example.com:443')}`;
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      'password 不可省略或为空',
    );
  });

  it('throws for invalid port (0)', () => {
    const link = `ss://${btoa('aes-256-gcm:password@example.com:0')}`;
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      'remote-port 必须是 1 到 65535 的整数',
    );
  });

  it('throws for unsupported method in strict mode', () => {
    const link = makeSsLink({ method: 'unknown-cipher' });
    expect(() => parseShadowsocksShareLink(link)).toThrow(
      '不支持的加密方法: unknown-cipher',
    );
  });

  it('allows unsupported method in non-strict mode', () => {
    const link = makeSsLink({ method: 'unknown-cipher' });
    const result = parseShadowsocksShareLink(link, { strict: false });
    expect(result.method).toBe('unknown-cipher');
  });
});

// ---------------------------------------------------------------------------
// formatShadowsocksShareLink
// ---------------------------------------------------------------------------
describe('formatShadowsocksShareLink', () => {
  it('formats a basic share', () => {
    const result = formatShadowsocksShareLink(BASIC_SHARE);
    expect(result).toContain('ss://');

    // Re-parse to verify
    const reparsed = parseShadowsocksShareLink(result);
    expect(reparsed.method).toBe('aes-256-gcm');
    expect(reparsed.password).toBe('password');
    expect(reparsed.address).toBe('example.com');
    expect(reparsed.port).toBe(443);
  });

  it('includes plugin params', () => {
    const share = makeShare({
      params: {
        plugin: 'obfs-local',
        pluginOpts: 'obfs=http;obfs-host=bing.com',
      },
    });
    const result = formatShadowsocksShareLink(share);
    expect(result).toContain('plugin=obfs-local');
    expect(result).toContain('pluginOpts=obfs%3Dhttp%3Bobfs-host%3Dbing.com');
  });

  it('includes protocol and obfs params', () => {
    const share = makeShare({
      params: {
        protocol: 'auth_aes128_sha1',
        obfs: 'http',
        obfsHost: 'cloudfront.net',
      },
    });
    const result = formatShadowsocksShareLink(share);
    expect(result).toContain('protocol=auth_aes128_sha1');
    expect(result).toContain('obfs=http');
    expect(result).toContain('obfsHost=cloudfront.net');
  });

  it('includes extra params', () => {
    const share = makeShare({ extraParams: { customKey: 'customVal' } });
    const result = formatShadowsocksShareLink(share);
    expect(result).toContain('customKey=customVal');
  });

  it('includes fragment as name', () => {
    const share = makeShare({ name: 'My Node' });
    const result = formatShadowsocksShareLink(share);
    expect(result).toContain('#My%20Node');
  });

  it('omits fragment when name is undefined', () => {
    const share = makeShare({ name: undefined });
    const result = formatShadowsocksShareLink(share);
    expect(result).not.toContain('#');
  });

  it('wraps IPv6 address in brackets inside base64', () => {
    const share = makeShare({ address: '::1' });
    const result = formatShadowsocksShareLink(share);
    // IPv6 should be [::1] inside the base64-decoded content
    expect(result).toContain(btoa('aes-256-gcm:password@[::1]:443'));
  });

  it('throws for missing password', () => {
    const share = makeShare({ password: '' });
    expect(() => formatShadowsocksShareLink(share)).toThrow(
      'password 不可省略或为空',
    );
  });

  it('throws for missing method', () => {
    const share = makeShare({ method: '' });
    expect(() => formatShadowsocksShareLink(share)).toThrow(
      'method 不可省略或为空',
    );
  });

  it('throws for missing address', () => {
    const share = makeShare({ address: '' });
    expect(() => formatShadowsocksShareLink(share)).toThrow(
      'remote-host 不可省略或为空',
    );
  });
});

// ---------------------------------------------------------------------------
// shadowsocksShareToXrayOutbound
// ---------------------------------------------------------------------------
describe('shadowsocksShareToXrayOutbound', () => {
  it('produces protocol "shadowsocks"', () => {
    const outbound = shadowsocksShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.protocol).toBe('shadowsocks');
  });

  it('sets servers array with address, port, method, password, level', () => {
    const outbound = shadowsocksShareToXrayOutbound(BASIC_SHARE);
    const servers = outbound.settings?.servers as any[];
    expect(servers).toHaveLength(1);
    expect(servers[0].address).toBe('example.com');
    expect(servers[0].port).toBe(443);
    expect(servers[0].method).toBe('aes-256-gcm');
    expect(servers[0].password).toBe('password');
    expect(servers[0].level).toBe(0);
  });

  it('sets tag from options.tag', () => {
    const outbound = shadowsocksShareToXrayOutbound(BASIC_SHARE, {
      tag: 'my-tag',
    });
    expect(outbound.tag).toBe('my-tag');
  });

  it('falls back tag to share.name', () => {
    const outbound = shadowsocksShareToXrayOutbound(BASIC_SHARE);
    expect(outbound.tag).toBe('My%20Server');
  });

  it('accepts a string link as input', () => {
    const outbound = shadowsocksShareToXrayOutbound(BASIC_LINK);
    expect(outbound.protocol).toBe('shadowsocks');
  });
});

// ---------------------------------------------------------------------------
// outboundToShadowsocksShare
// ---------------------------------------------------------------------------
describe('outboundToShadowsocksShare', () => {
  const MINIMAL_OUTBOUND: Record<string, any> = {
    protocol: 'shadowsocks',
    settings: {
      servers: [
        {
          address: 'example.com',
          port: 443,
          method: 'aes-256-gcm',
          password: 'password',
        },
      ],
    },
    tag: 'My%20Server',
  };

  it('converts a minimal outbound back to share', () => {
    const share = outboundToShadowsocksShare(MINIMAL_OUTBOUND);
    expect(share.password).toBe('password');
    expect(share.method).toBe('aes-256-gcm');
    expect(share.address).toBe('example.com');
    expect(share.port).toBe(443);
  });

  it('throws for non-shadowsocks protocol', () => {
    const outbound = { protocol: 'vless', settings: {} };
    expect(() => outboundToShadowsocksShare(outbound)).toThrow(
      'outbound.protocol 必须是 shadowsocks',
    );
  });

  it('preserves name from options', () => {
    const share = outboundToShadowsocksShare(MINIMAL_OUTBOUND, {
      name: 'My Node',
    });
    expect(share.name).toBe('My Node');
  });

  it('falls back name to outbound.tag', () => {
    const share = outboundToShadowsocksShare(MINIMAL_OUTBOUND);
    expect(share.name).toBe('My%20Server');
  });

  it('handles settings.servers structure', () => {
    const outbound: Record<string, any> = {
      protocol: 'shadowsocks',
      settings: {
        servers: [{
          address: 'simple.com',
          port: 8080,
          method: 'aes-128-gcm',
          password: 'simple-pass',
        }],
      },
    };
    const share = outboundToShadowsocksShare(outbound);
    expect(share.method).toBe('aes-128-gcm');
    expect(share.password).toBe('simple-pass');
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
      name: 'basic AES-256-GCM',
      link: BASIC_LINK,
    },
    {
      name: 'chacha20-ietf-poly1305',
      link: makeSsLink({ method: 'chacha20-ietf-poly1305', name: 'chacha-node' }),
    },
    {
      name: 'aes-128-gcm',
      link: makeSsLink({ method: 'aes-128-gcm', name: 'aes128' }),
    },
    {
      name: 'non-default port',
      link: makeSsLink({ port: 8443, name: 'custom-port' }),
    },
    {
      name: 'with plugin',
      link: makeSsLink({
        plugin: 'obfs-local',
        pluginOpts: 'obfs=http;obfs-host=bing.com',
        name: 'plugin-node',
      }),
    },
    {
      name: 'with obfs params',
      link: makeSsLink({}) + '?protocol=auth_aes128_sha1&obfs=http&obfsHost=cloudfront.net#obfs-node',
    },
    {
      name: 'IPv6',
      link: makeSsLink({ address: '::1', name: 'ipv6' }),
    },
  ];

  for (const { name, link } of roundTripCases) {
    it(`preserves fields through round-trip: ${name}`, () => {
      const parsed = parseShadowsocksShareLink(link);
      const outbound = shadowsocksShareToXrayOutbound(parsed);
      const backToShare = outboundToShadowsocksShare(outbound, {
        name: parsed.name,
      });
      const formatted = formatShadowsocksShareLink(backToShare);

      const reparsed = parseShadowsocksShareLink(formatted);

      expect(reparsed.password).toBe(parsed.password);
      expect(reparsed.method).toBe(parsed.method);
      expect(reparsed.address).toBe(parsed.address);
      expect(reparsed.port).toBe(parsed.port);
      expect(reparsed.name).toBe(parsed.name);
    });
  }
});

// ---------------------------------------------------------------------------
// importShadowsocksShareToXrayConfig
// ---------------------------------------------------------------------------
describe('importShadowsocksShareToXrayConfig', () => {
  function ob(result: Record<string, unknown>): any[] {
    return (result as any).outbounds ?? [];
  }

  it('append mode adds outbound to empty config', () => {
    const result = importShadowsocksShareToXrayConfig({}, BASIC_LINK);
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].protocol).toBe('shadowsocks');
  });

  it('append mode adds to existing outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importShadowsocksShareToXrayConfig(config, BASIC_LINK);
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('shadowsocks');
  });

  it('does not mutate original config', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importShadowsocksShareToXrayConfig(config, BASIC_LINK);
    expect(config.outbounds).toHaveLength(1);
    expect(ob(result)).toHaveLength(2);
  });

  it('replaceByTag replaces matching tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'shadowsocks',
          tag: 'my-node',
          settings: {
            servers: [
              {
                address: 'old.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'old',
              },
            ],
          },
        },
      ],
    };
    const share = makeShare({ name: 'my-node' });
    const result = importShadowsocksShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(1);
    expect(ob(result)[0].tag).toBe('my-node');
  });

  it('replaceByTag appends when tag not found', () => {
    const config = { outbounds: [{ protocol: 'vmess', tag: 'other' }] };
    const share = makeShare({ name: 'new-node' });
    const result = importShadowsocksShareToXrayConfig(config, share, {
      mode: 'replaceByTag',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].tag).toBe('new-node');
  });

  it('replaceByTag throws when outbound has no tag', () => {
    const share = makeShare({ name: undefined });
    expect(() =>
      importShadowsocksShareToXrayConfig({}, share, { mode: 'replaceByTag' }),
    ).toThrow('replaceByTag 需要提供 tag 或链接 name');
  });

  it('replaceFirstShadowsocks replaces existing shadowsocks outbound', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        {
          protocol: 'shadowsocks',
          settings: {
            servers: [
              {
                address: 'old.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'old',
              },
            ],
          },
        },
        { protocol: 'trojan', settings: {} },
      ],
    };
    const result = importShadowsocksShareToXrayConfig(config, BASIC_SHARE, {
      mode: 'replaceFirstShadowsocks',
    });
    expect(ob(result)).toHaveLength(3);
    expect(ob(result)[0].protocol).toBe('vmess');
    expect(ob(result)[1].settings.servers[0].password).toBe('password');
    expect(ob(result)[2].protocol).toBe('trojan');
  });

  it('replaceFirstShadowsocks appends when no shadowsocks outbound exists', () => {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const result = importShadowsocksShareToXrayConfig(config, BASIC_SHARE, {
      mode: 'replaceFirstShadowsocks',
    });
    expect(ob(result)).toHaveLength(2);
    expect(ob(result)[1].protocol).toBe('shadowsocks');
  });

  it('throws for unknown mode', () => {
    expect(() =>
      importShadowsocksShareToXrayConfig({}, BASIC_SHARE, {
        mode: 'unknown' as never,
      }),
    ).toThrow('未知导入模式: unknown');
  });
});

// ---------------------------------------------------------------------------
// exportShadowsocksLinksFromXrayConfig
// ---------------------------------------------------------------------------
describe('exportShadowsocksLinksFromXrayConfig', () => {
  it('returns ss:// links from outbounds', () => {
    const config = {
      outbounds: [
        { protocol: 'vmess', settings: {} },
        {
          protocol: 'shadowsocks',
          settings: {
            servers: [
              {
                address: 'example.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'password',
              },
            ],
          },
          tag: 'my-node',
        },
      ],
    };
    const links = exportShadowsocksLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('ss://');
    // Re-parse to verify address (inside base64)
    const reparsed = parseShadowsocksShareLink(links[0]);
    expect(reparsed.address).toBe('example.com');
    expect(reparsed.method).toBe('aes-256-gcm');
    expect(reparsed.password).toBe('password');
  });

  it('filters by tag', () => {
    const config = {
      outbounds: [
        {
          protocol: 'shadowsocks',
          tag: 'node-a',
          settings: {
            servers: [
              {
                address: 'a.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'pass1',
              },
            ],
          },
        },
        {
          protocol: 'shadowsocks',
          tag: 'node-b',
          settings: {
            servers: [
              {
                address: 'b.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'pass2',
              },
            ],
          },
        },
      ],
    };
    const links = exportShadowsocksLinksFromXrayConfig(config, {
      tag: 'node-a',
    });
    expect(links).toHaveLength(1);
    // Re-parse to verify address (inside base64)
    const reparsed = parseShadowsocksShareLink(links[0]);
    expect(reparsed.address).toBe('a.com');
    expect(reparsed.password).toBe('pass1');
  });

  it('filters by multiple tags', () => {
    const config = {
      outbounds: [
        {
          protocol: 'shadowsocks',
          tag: 'node-a',
          settings: {
            servers: [
              {
                address: 'a.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'pass1',
              },
            ],
          },
        },
        {
          protocol: 'shadowsocks',
          tag: 'node-b',
          settings: {
            servers: [
              {
                address: 'b.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'pass2',
              },
            ],
          },
        },
      ],
    };
    const links = exportShadowsocksLinksFromXrayConfig(config, {
      tag: ['node-a', 'node-b'],
    });
    expect(links).toHaveLength(2);
  });

  it('returns empty array when no shadowsocks outbounds', () => {
    const config = { outbounds: [{ protocol: 'vmess' }] };
    const links = exportShadowsocksLinksFromXrayConfig(config);
    expect(links).toEqual([]);
  });

  it('returns empty array when config has no outbounds', () => {
    const links = exportShadowsocksLinksFromXrayConfig({});
    expect(links).toEqual([]);
  });

  it('filters out null outbounds', () => {
    const config = {
      outbounds: [
        null,
        {
          protocol: 'shadowsocks',
          tag: 'valid-node',
          settings: {
            servers: [
              {
                address: 'valid.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'vpass',
              },
            ],
          },
        },
      ],
    };
    const links = exportShadowsocksLinksFromXrayConfig(config);
    expect(links).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// exportShadowsocksLinksFromXrayConfigJson
// ---------------------------------------------------------------------------
describe('exportShadowsocksLinksFromXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({
      outbounds: [
        {
          protocol: 'shadowsocks',
          settings: {
            servers: [
              {
                address: 'example.com',
                port: 443,
                method: 'aes-256-gcm',
                password: 'password',
              },
            ],
          },
          tag: 'my-node',
        },
      ],
    });
    const links = exportShadowsocksLinksFromXrayConfigJson(configJson);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('ss://');
  });
});

// ---------------------------------------------------------------------------
// importShadowsocksShareToXrayConfigJson
// ---------------------------------------------------------------------------
describe('importShadowsocksShareToXrayConfigJson', () => {
  it('works with JSON string input', () => {
    const configJson = JSON.stringify({ outbounds: [] });
    const result = importShadowsocksShareToXrayConfigJson(
      configJson,
      BASIC_SHARE,
    );
    const parsed = JSON.parse(result);
    expect(parsed.outbounds).toHaveLength(1);
    expect(parsed.outbounds[0].protocol).toBe('shadowsocks');
  });
});
