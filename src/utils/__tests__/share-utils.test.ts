import { describe, it, expect } from 'vitest';
import {
  assertNonEmpty,
  assertValidPort,
  asDict,
  stringOrUndefined,
  numberOrUndefined,
  parseJsonMaybe,
  stringifyMaybe,
  deepClone,
  decodeUriPart,
  stripIpv6Brackets,
  formatHostForUri,
  toAsciiHost,
} from '../share-utils';

// ---------------------------------------------------------------------------
// assertNonEmpty
// ---------------------------------------------------------------------------
describe('assertNonEmpty', () => {
  it('passes for a non-empty string', () => {
    expect(() => assertNonEmpty('hello', 'test')).not.toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => assertNonEmpty('', 'name')).toThrow('name 不可省略或为空');
  });

  it('throws for null', () => {
    expect(() => assertNonEmpty(null, 'name')).toThrow('name 不可省略或为空');
  });

  it('throws for undefined', () => {
    expect(() => assertNonEmpty(undefined, 'name')).toThrow('name 不可省略或为空');
  });

  it('throws for a number', () => {
    expect(() => assertNonEmpty(42, 'name')).toThrow('name 不可省略或为空');
  });
});

// ---------------------------------------------------------------------------
// assertValidPort
// ---------------------------------------------------------------------------
describe('assertValidPort', () => {
  it('passes for port 1', () => {
    expect(() => assertValidPort(1)).not.toThrow();
  });

  it('passes for port 443', () => {
    expect(() => assertValidPort(443)).not.toThrow();
  });

  it('passes for port 65535', () => {
    expect(() => assertValidPort(65535)).not.toThrow();
  });

  it('throws for port 0', () => {
    expect(() => assertValidPort(0)).toThrow('remote-port 必须是 1 到 65535 的整数');
  });

  it('throws for port 65536', () => {
    expect(() => assertValidPort(65536)).toThrow('remote-port 必须是 1 到 65535 的整数');
  });

  it('throws for negative port', () => {
    expect(() => assertValidPort(-1)).toThrow('remote-port 必须是 1 到 65535 的整数');
  });

  it('throws for NaN', () => {
    expect(() => assertValidPort(NaN)).toThrow('remote-port 必须是 1 到 65535 的整数');
  });

  it('throws for non-integer', () => {
    expect(() => assertValidPort(3.14)).toThrow('remote-port 必须是 1 到 65535 的整数');
  });
});

// ---------------------------------------------------------------------------
// asDict
// ---------------------------------------------------------------------------
describe('asDict', () => {
  it('returns the same object for a plain object', () => {
    const obj = { a: 1, b: 2 };
    expect(asDict(obj)).toBe(obj);
  });

  it('returns empty object for null', () => {
    expect(asDict(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(asDict(undefined)).toEqual({});
  });

  it('returns the array itself for an array (typeof array is object)', () => {
    // In JavaScript, typeof [] === 'object', so asDict returns the array as-is
    expect(asDict([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('returns empty object for a string', () => {
    expect(asDict('hello')).toEqual({});
  });

  it('returns empty object for a number', () => {
    expect(asDict(42)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// stringOrUndefined
// ---------------------------------------------------------------------------
describe('stringOrUndefined', () => {
  it('returns the string for a non-empty string', () => {
    expect(stringOrUndefined('hello')).toBe('hello');
  });

  it('returns undefined for an empty string', () => {
    expect(stringOrUndefined('')).toBeUndefined();
  });

  it('returns undefined for a number', () => {
    expect(stringOrUndefined(42)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(stringOrUndefined(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(stringOrUndefined(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// numberOrUndefined
// ---------------------------------------------------------------------------
describe('numberOrUndefined', () => {
  it('returns the number for a finite number', () => {
    expect(numberOrUndefined(42)).toBe(42);
  });

  it('returns undefined for NaN', () => {
    expect(numberOrUndefined(NaN)).toBeUndefined();
  });

  it('returns undefined for Infinity', () => {
    expect(numberOrUndefined(Infinity)).toBeUndefined();
  });

  it('returns undefined for -Infinity', () => {
    expect(numberOrUndefined(-Infinity)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(numberOrUndefined(undefined)).toBeUndefined();
  });

  it('returns undefined for a string', () => {
    expect(numberOrUndefined('42')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseJsonMaybe
// ---------------------------------------------------------------------------
describe('parseJsonMaybe', () => {
  it('parses a valid JSON object', () => {
    expect(parseJsonMaybe('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses a valid JSON array', () => {
    expect(parseJsonMaybe('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns the string for a plain string', () => {
    expect(parseJsonMaybe('hello')).toBe('hello');
  });

  it('returns the string for an empty string', () => {
    expect(parseJsonMaybe('')).toBe('');
  });

  it('returns the string for whitespace-only string', () => {
    expect(parseJsonMaybe('   ')).toBe('   ');
  });

  it('returns the string for invalid JSON starting with {', () => {
    expect(parseJsonMaybe('{invalid}')).toBe('{invalid}');
  });

  it('returns the string for invalid JSON starting with [', () => {
    expect(parseJsonMaybe('[invalid]')).toBe('[invalid]');
  });
});

// ---------------------------------------------------------------------------
// stringifyMaybe
// ---------------------------------------------------------------------------
describe('stringifyMaybe', () => {
  it('returns the string as-is for a string value', () => {
    expect(stringifyMaybe('hello')).toBe('hello');
  });

  it('returns JSON string for an object', () => {
    expect(stringifyMaybe({ a: 1 })).toBe('{"a":1}');
  });

  it('returns undefined for null', () => {
    expect(stringifyMaybe(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(stringifyMaybe(undefined)).toBeUndefined();
  });

  it('returns JSON string for an array', () => {
    expect(stringifyMaybe([1, 2, 3])).toBe('[1,2,3]');
  });
});

// ---------------------------------------------------------------------------
// deepClone
// ---------------------------------------------------------------------------
describe('deepClone', () => {
  it('clones a simple object', () => {
    const original = { a: 1, b: 2 };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('clones a nested object', () => {
    const original = { a: { b: { c: 3 } } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned.a).not.toBe(original.a);
    expect(cloned.a.b).not.toBe(original.a.b);
  });

  it('clones an array', () => {
    const original = [1, [2, 3]];
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[1]).not.toBe(original[1]);
  });
});

// ---------------------------------------------------------------------------
// decodeUriPart
// ---------------------------------------------------------------------------
describe('decodeUriPart', () => {
  it('decodes a valid encoded string', () => {
    expect(decodeUriPart('hello%20world')).toBe('hello world');
  });

  it('decodes %2F as /', () => {
    expect(decodeUriPart('path%2Fto%2Fresource')).toBe('path/to/resource');
  });

  it('throws for an invalid percent-encoded string', () => {
    expect(() => decodeUriPart('%GG')).toThrow('URL 编码非法: %GG');
  });

  it('passes through an unencoded string', () => {
    expect(decodeUriPart('simple')).toBe('simple');
  });
});

// ---------------------------------------------------------------------------
// stripIpv6Brackets
// ---------------------------------------------------------------------------
describe('stripIpv6Brackets', () => {
  it('strips brackets from [::1]', () => {
    expect(stripIpv6Brackets('[::1]')).toBe('::1');
  });

  it('strips brackets from a full IPv6 address', () => {
    expect(stripIpv6Brackets('[2001:db8::1]')).toBe('2001:db8::1');
  });

  it('returns plain host as-is', () => {
    expect(stripIpv6Brackets('example.com')).toBe('example.com');
  });

  it('returns IPv4 as-is', () => {
    expect(stripIpv6Brackets('192.168.1.1')).toBe('192.168.1.1');
  });

  it('handles empty string', () => {
    expect(stripIpv6Brackets('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatHostForUri
// ---------------------------------------------------------------------------
describe('formatHostForUri', () => {
  it('wraps IPv6 in brackets', () => {
    expect(formatHostForUri('::1')).toBe('[::1]');
  });

  it('wraps IPv6 in brackets after stripping existing brackets', () => {
    expect(formatHostForUri('[::1]')).toBe('[::1]');
  });

  it('returns IPv4 as-is', () => {
    expect(formatHostForUri('192.168.1.1')).toBe('192.168.1.1');
  });

  it('returns hostname as-is', () => {
    expect(formatHostForUri('example.com')).toBe('example.com');
  });

  it('trims whitespace', () => {
    expect(formatHostForUri('  example.com  ')).toBe('example.com');
  });
});

// ---------------------------------------------------------------------------
// toAsciiHost
// ---------------------------------------------------------------------------
describe('toAsciiHost', () => {
  it('returns IPv6 as-is (already contains :)', () => {
    expect(toAsciiHost('::1')).toBe('::1');
  });

  it('returns IPv4 as-is', () => {
    expect(toAsciiHost('192.168.1.1')).toBe('192.168.1.1');
  });

  it('returns hostname as-is when URL parsing works', () => {
    expect(toAsciiHost('example.com')).toBe('example.com');
  });

  it('returns the input as fallback on parse failure', () => {
    // A host with invalid characters for URL parsing
    expect(toAsciiHost('invalid host!')).toBe('invalid host!');
  });
});
