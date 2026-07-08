import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import JSON5 from 'json5';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { XrayConfig } from './schema';
import { orderXrayConfig } from './schema';

export type ConfigFormat = 'json' | 'json5' | 'yaml' | 'toml';

export const configFormatOptions: Array<{ value: ConfigFormat; labelKey: string }> = [
  { value: 'json', labelKey: 'app.format.json' },
  { value: 'json5', labelKey: 'app.format.json5' },
  { value: 'yaml', labelKey: 'app.format.yaml' },
  { value: 'toml', labelKey: 'app.format.toml' },
];

export function detectConfigFormat(fileName: string): ConfigFormat | null {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.json5')) {
    return 'json5';
  }

  if (lowerName.endsWith('.yaml') || lowerName.endsWith('.yml')) {
    return 'yaml';
  }

  if (lowerName.endsWith('.toml')) {
    return 'toml';
  }

  if (lowerName.endsWith('.json')) {
    return 'json';
  }

  return null;
}

export function detectConfigFormatFromUrl(url: string): ConfigFormat | null {
  try {
    return detectConfigFormat(new URL(url, window.location.href).pathname);
  } catch {
    return null;
  }
}

export function parseConfigText(text: string, format: ConfigFormat) {
  switch (format) {
    case 'json':
      return JSON.parse(text) as unknown;
    case 'json5':
      return JSON5.parse(text) as unknown;
    case 'yaml':
      return parseYaml(text) as unknown;
    case 'toml':
      return parseToml(text) as unknown;
  }
}

export function serializeConfigText(config: XrayConfig, format: ConfigFormat) {
  const ordered = orderXrayConfig(config);

  switch (format) {
    case 'json':
      return JSON.stringify(ordered, null, 2);
    case 'json5':
      return JSON5.stringify(ordered, null, 2);
    case 'yaml':
      return stringifyYaml(ordered, { lineWidth: 0 });
    case 'toml':
      return stringifyToml(ordered as Record<string, unknown>);
  }
}

export function getConfigMimeType(format: ConfigFormat) {
  switch (format) {
    case 'json':
      return 'application/json;charset=utf-8';
    case 'json5':
      return 'application/json5;charset=utf-8';
    case 'yaml':
      return 'application/yaml;charset=utf-8';
    case 'toml':
      return 'application/toml;charset=utf-8';
  }
}

function createParseOrder(
  primaryFormat: ConfigFormat | null,
  secondaryFormat: ConfigFormat | null,
) {
  return Array.from(
    new Set(
      [primaryFormat, secondaryFormat, 'json', 'json5', 'yaml', 'toml'].filter(
        Boolean,
      ) as ConfigFormat[],
    ),
  );
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findUnsupportedMisspelledKey(value: unknown, path: string[] = []): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findUnsupportedMisspelledKey(value[index], [...path, String(index)]);
      if (result) {
        return result;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'maxTimediff')) {
    return [...path, 'maxTimediff'].join('.');
  }

  for (const [key, item] of Object.entries(value)) {
    const result = findUnsupportedMisspelledKey(item, [...path, key]);
    if (result) {
      return result;
    }
  }

  return null;
}

function assertNoUnsupportedMisspelledKeys(config: Record<string, unknown>) {
  const path = findUnsupportedMisspelledKey(config);

  if (path) {
    throw new Error(`配置字段拼写错误：${path} 不受支持，请使用 maxTimeDiff。`);
  }
}

export function parseImportedConfig(
  text: string,
  preferredFormat: ConfigFormat | null,
  sourceFormat: ConfigFormat | null,
) {
  const parseOrder = createParseOrder(sourceFormat, preferredFormat);

  for (const format of parseOrder) {
    try {
      const parsed = parseConfigText(text, format);
      if (isPlainObject(parsed)) {
        assertNoUnsupportedMisspelledKeys(parsed);
        return {
          config: orderXrayConfig(parsed as XrayConfig),
          format,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('配置字段拼写错误')) {
        throw error;
      }

      // Try the next supported format.
    }
  }

  throw new Error('Unable to parse imported config.');
}
