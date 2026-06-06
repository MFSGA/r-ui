import { describe, it, expect } from 'vitest';
import {
  detectProtocol,
  parseShareLink,
  formatShareLink,
  shareToXrayOutbound,
  outboundToShare,
} from '../multi-protocol-share';

// Helper to build a minimal vmess:// link
function makeVmessLink(): string {
  const json = {
    v: '2',
    ps: 'vmess-node',
    add: 'vmess.example.com',
    port: '443',
    id: '550e8400-e29b-41d4-a716-446655440000',
    aid: '0',
    scy: 'none',
    net: 'tcp',
    type: 'none',
    tls: 'none',
  };
  const b64 = btoa(JSON.stringify(json));
  return `vmess://${b64}`;
}

// Helper to build a minimal ss:// link (URL-safe base64 as required by the SS parser)
function makeSsLink(): string {
  // Format: ss://<base64(method:password@host:port)>#fragment
  // The @host:port is INSIDE the base64, not outside
  const plain = 'aes-256-gcm:secret123@ss.example.com:8443';
  const stdB64 = btoa(plain);
  // Convert to URL-safe base64: replace + with -, / with _, strip padding =
  const urlSafe = stdB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `ss://${urlSafe}#ss-node`;
}

// ---------------------------------------------------------------------------
// detectProtocol
// ---------------------------------------------------------------------------
describe('detectProtocol', () => {
  it('detects hysteria2://', () => {
    expect(detectProtocol('hysteria2://example.com')).toBe('hysteria2');
  });

  it('detects hy2://', () => {
    expect(detectProtocol('hy2://example.com')).toBe('hysteria2');
  });

  it('detects vmess://', () => {
    expect(detectProtocol('vmess://...')).toBe('vmess');
  });

  it('detects trojan://', () => {
    expect(detectProtocol('trojan://example.com')).toBe('trojan');
  });

  it('detects ss://', () => {
    expect(detectProtocol('ss://...')).toBe('shadowsocks');
  });

  it('detects vless://', () => {
    expect(detectProtocol('vless://example.com')).toBe('vless');
  });

  it('returns unknown for http://', () => {
    expect(detectProtocol('http://example.com')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(detectProtocol('')).toBe('unknown');
  });

  it('returns unknown for unrecognized protocol', () => {
    expect(detectProtocol('unknown://something')).toBe('unknown');
  });

  it('trims whitespace', () => {
    expect(detectProtocol('  hysteria2://host.com  ')).toBe('hysteria2');
  });
});

// ---------------------------------------------------------------------------
// parseShareLink
// ---------------------------------------------------------------------------
describe('parseShareLink', () => {
  it('parses hysteria2:// link', () => {
    const result = parseShareLink('hysteria2://password@host.com:443');
    expect(result.protocol).toBe('hysteria2');
    expect((result.data as any).auth).toBe('password');
  });

  it('parses hy2:// link', () => {
    const result = parseShareLink('hy2://password@host.com:443');
    expect(result.protocol).toBe('hysteria2');
  });

  it('parses trojan:// link', () => {
    const result = parseShareLink('trojan://mypass@trojan.example.com:443');
    expect(result.protocol).toBe('trojan');
    expect((result.data as any).password).toBe('mypass');
  });

  it('parses vmess:// link', () => {
    const link = makeVmessLink();
    const result = parseShareLink(link);
    expect(result.protocol).toBe('vmess');
    expect((result.data as any).id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('parses ss:// link', () => {
    const link = makeSsLink();
    const result = parseShareLink(link);
    expect(result.protocol).toBe('shadowsocks');
  });

  it('throws for unsupported protocol', () => {
    expect(() => parseShareLink('http://example.com')).toThrow(
      '不支持的分享链接协议',
    );
  });
});

// ---------------------------------------------------------------------------
// formatShareLink
// ---------------------------------------------------------------------------
describe('formatShareLink', () => {
  it('formats a hysteria2 share', () => {
    const parsed = parseShareLink('hysteria2://password@host.com:443#my-node');
    const formatted = formatShareLink(parsed);
    expect(formatted).toContain('hysteria2://');
    expect(formatted).toContain('password@');
  });

  it('formats a trojan share', () => {
    const parsed = parseShareLink('trojan://pass@troj.example.com:443');
    const formatted = formatShareLink(parsed);
    expect(formatted).toContain('trojan://');
  });

  it('formats a vmess share', () => {
    const parsed = parseShareLink(makeVmessLink());
    const formatted = formatShareLink(parsed);
    expect(formatted).toContain('vmess://');
  });

  it('formats a shadowsocks share', () => {
    const parsed = parseShareLink(makeSsLink());
    const formatted = formatShareLink(parsed);
    expect(formatted).toContain('ss://');
  });
});

// ---------------------------------------------------------------------------
// shareToXrayOutbound
// ---------------------------------------------------------------------------
describe('shareToXrayOutbound', () => {
  it('converts hysteria2 string link to outbound', () => {
    const outbound = shareToXrayOutbound('hysteria2://password@host.com:443');
    expect(outbound.protocol).toBe('hysteria');
  });

  it('converts hysteria2 ParsedShare to outbound', () => {
    const parsed = parseShareLink('hysteria2://password@host.com:443');
    const outbound = shareToXrayOutbound(parsed);
    expect(outbound.protocol).toBe('hysteria');
  });

  it('converts trojan link to outbound', () => {
    const outbound = shareToXrayOutbound('trojan://pass@troj.example.com:443');
    expect(outbound.protocol).toBe('trojan');
  });

  it('converts vmess link to outbound', () => {
    const outbound = shareToXrayOutbound(makeVmessLink());
    expect(outbound.protocol).toBe('vmess');
  });

  it('converts shadowsocks link to outbound', () => {
    const outbound = shareToXrayOutbound(makeSsLink());
    expect(outbound.protocol).toBe('shadowsocks');
  });
});

// ---------------------------------------------------------------------------
// outboundToShare
// ---------------------------------------------------------------------------
describe('outboundToShare', () => {
  it('detects hysteria protocol', () => {
    const outbound = {
      protocol: 'hysteria',
      settings: { address: 'example.com', port: 443 },
      streamSettings: {
        security: 'tls',
        tlsSettings: { serverName: 'example.com', alpn: ['h3'], allowInsecure: false },
        hysteriaSettings: { version: 2, auth: 'password' },
      },
    };
    const result = outboundToShare(outbound);
    expect(result.protocol).toBe('hysteria2');
  });

  it('detects vmess protocol', () => {
    const outbound = {
      protocol: 'vmess',
      settings: {
        address: 'vmess.example.com',
        port: 443,
        id: '550e8400-e29b-41d4-a716-446655440000',
      },
      streamSettings: {
        network: 'tcp',
        security: 'none',
      },
    };
    const result = outboundToShare(outbound);
    expect(result.protocol).toBe('vmess');
  });

  it('detects trojan protocol', () => {
    const outbound = {
      protocol: 'trojan',
      settings: {
        servers: [{ address: 'troj.example.com', port: 443, password: 'pass123' }],
      },
      streamSettings: {
        network: 'tcp',
        security: 'none',
      },
    };
    const result = outboundToShare(outbound);
    expect(result.protocol).toBe('trojan');
    expect((result.data as any).password).toBe('pass123');
  });

  it('detects shadowsocks protocol', () => {
    const outbound = {
      protocol: 'shadowsocks',
      settings: {
        servers: [{ address: 'ss.example.com', port: 8443, method: 'aes-256-gcm', password: 'secret' }],
      },
    };
    const result = outboundToShare(outbound);
    expect(result.protocol).toBe('shadowsocks');
    expect((result.data as any).password).toBe('secret');
  });

  it('throws for unknown protocol', () => {
    const outbound = { protocol: 'unknown', settings: {} };
    expect(() => outboundToShare(outbound)).toThrow('不支持的协议: unknown');
  });
});

// ---------------------------------------------------------------------------
// Round-trip via dispatch layer
// ---------------------------------------------------------------------------
describe('round-trip via dispatch layer', () => {
  it('hysteria2 parse → format preserves protocol', () => {
    const link = 'hysteria2://password@host.com:443?up=100mbps#my-node';
    const parsed = parseShareLink(link);
    expect(parsed.protocol).toBe('hysteria2');
    expect((parsed.data as any).auth).toBe('password');

    const formatted = formatShareLink(parsed);
    const reparsed = parseShareLink(formatted);
    expect(reparsed.protocol).toBe('hysteria2');
    expect((reparsed.data as any).auth).toBe('password');
  });

  it('hysteria2 parse → outbound → share preserves protocol', () => {
    const link = 'hysteria2://password@host.com:443#my-node';
    const outbound = shareToXrayOutbound(link);
    expect(outbound.protocol).toBe('hysteria');

    const share = outboundToShare(outbound);
    expect(share.protocol).toBe('hysteria2');
    expect((share.data as any).auth).toBe('password');
  });
});
