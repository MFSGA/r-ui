import { describe, expect, it } from 'vitest';
import { parseImportedConfig } from '../configFormat';

describe('parseImportedConfig', () => {
  it('rejects misspelled reality maxTimediff field', () => {
    const config = {
      inbounds: [
        {
          streamSettings: {
            realitySettings: {
              maxTimediff: 0,
            },
          },
        },
      ],
    };

    expect(() => parseImportedConfig(JSON.stringify(config), 'json', 'json')).toThrow(
      '配置字段拼写错误：inbounds.0.streamSettings.realitySettings.maxTimediff 不受支持，请使用 maxTimeDiff。',
    );
  });

  it('accepts correctly spelled reality maxTimeDiff field', () => {
    const config = {
      inbounds: [
        {
          streamSettings: {
            realitySettings: {
              maxTimeDiff: 0,
            },
          },
        },
      ],
    };

    expect(parseImportedConfig(JSON.stringify(config), 'json', 'json').config).toEqual(config);
  });
});
