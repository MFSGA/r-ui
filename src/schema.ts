import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import xraySchema from './xray-online-based.schema.json';
import xrayDefaultConfig from './xray-online-based.config.json';
import type { Locale } from './i18n';
import { translateSchemaLabel, translateUiPlaceholder } from './i18n';

export type XrayConfig = Record<string, unknown>;
export type XrayConfigKey = string;

export const schema = xraySchema as RJSFSchema;
export const defaultConfig = xrayDefaultConfig as XrayConfig;

const rootDefinitionName = 'Basic Configuration Modules';
const rootSchema = xraySchema.definitions[rootDefinitionName] as RJSFSchema;
const rootProperties = rootSchema.properties ?? {};
const topLevelFieldOrder = [
  'log',
  'dns',
  'routing',
  'inbounds',
  'outbounds',
  'api',
  'policy',
  'transport',
  'stats',
  'reverse',
  'fakedns',
  'metrics',
  'observatory',
  'burstObservatory',
  'version',
];

export const topLevelFields = orderFields(Object.keys(rootProperties), topLevelFieldOrder);

export const topLevelFieldOptions = topLevelFields.map((field) => ({
  value: field,
  label: field,
  description: getFieldDescription(field),
}));

export function getTopLevelFieldOptions(locale: Locale) {
  return topLevelFields.map((field) => ({
    value: field,
    label: translateSchemaLabel(locale, field),
    description: getFieldDescription(field, locale),
  }));
}

export function getTopLevelFieldSchema(field: XrayConfigKey, locale: Locale): RJSFSchema {
  const fieldSchema = rootProperties[field];
  const localizedFieldSchema =
    typeof fieldSchema === 'object' && fieldSchema !== null ? (localizeSchemaNode(fieldSchema, locale, [field]) as Record<string, unknown>) : {};

  return {
    ...localizedFieldSchema,
    title: translateSchemaLabel(locale, field),
    definitions: localizeDefinitions(xraySchema.definitions, locale),
  } as RJSFSchema;
}

export function getTopLevelFieldUiSchema(field: XrayConfigKey, locale: Locale): UiSchema {
  const fieldUiSchema = uiSchema[field];
  const localizedFieldUiSchema =
    typeof fieldUiSchema === 'object' && fieldUiSchema !== null ? (localizeUiSchemaNode(fieldUiSchema, locale, [field]) as UiSchema) : {};

  return {
    'ui:submitButtonOptions': {
      norender: true,
    },
    ...localizedFieldUiSchema,
  };
}

export function orderXrayConfig(config: XrayConfig): XrayConfig {
  const orderedConfig: XrayConfig = {};

  topLevelFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(config, field) && config[field] !== undefined) {
      orderedConfig[field] = config[field];
    }
  });

  Object.keys(config).forEach((field) => {
    if (!topLevelFields.includes(field) && config[field] !== undefined) {
      orderedConfig[field] = config[field];
    }
  });

  return orderedConfig;
}

export function normalizeProtocolSwitches(field: XrayConfigKey, nextFormData: unknown, previousFormData: unknown) {
  if (field !== 'inbounds' && field !== 'outbounds') {
    return nextFormData;
  }

  if (!Array.isArray(nextFormData)) {
    return nextFormData;
  }

  const previousItems = Array.isArray(previousFormData) ? previousFormData : [];

  return nextFormData.map((nextItem, index) => {
    const previousItem = previousItems[index];

    if (!isRecord(nextItem)) {
      return nextItem;
    }

    const nextProtocol = typeof nextItem.protocol === 'string' ? nextItem.protocol : undefined;
    const previousProtocol = isRecord(previousItem) && typeof previousItem.protocol === 'string' ? previousItem.protocol : undefined;
    const protocolChanged = nextProtocol !== undefined && nextProtocol !== previousProtocol;

    if (!protocolChanged) {
      return nextItem;
    }

    const normalizedItem: Record<string, unknown> = {
      ...nextItem,
      settings: {},
    };

    let nextStreamSettings = isRecord(nextItem.streamSettings) ? { ...nextItem.streamSettings } : undefined;

    if (nextProtocol === 'hysteria') {
      nextStreamSettings = {
        ...(nextStreamSettings ?? {}),
        network: 'hysteria',
      };
    } else if (previousProtocol === 'hysteria' && nextStreamSettings) {
      if (nextStreamSettings.network === 'hysteria') {
        delete nextStreamSettings.network;
      }
    }

    nextStreamSettings = normalizeHysteriaStreamSettings(nextStreamSettings);

    if (nextStreamSettings) {
      normalizedItem.streamSettings = nextStreamSettings;
    }

    return normalizedItem;
  });
}

export function normalizeSelectedFieldValue(field: XrayConfigKey, nextFormData: unknown, previousFormData: unknown) {
  return normalizeHysteriaStreamSettingsInValue(normalizeProtocolSwitches(field, nextFormData, previousFormData));
}

function normalizeHysteriaStreamSettings(streamSettings: Record<string, unknown> | undefined) {
  if (!streamSettings || streamSettings.network !== 'hysteria') {
    return streamSettings;
  }

  const normalizedStreamSettings: Record<string, unknown> = {
    ...streamSettings,
    security: 'tls',
  };
  const allowedKeys = new Set(['network', 'security', 'tlsSettings', 'hysteriaSettings']);

  Object.keys(normalizedStreamSettings).forEach((key) => {
    if (!allowedKeys.has(key)) {
      delete normalizedStreamSettings[key];
    }
  });

  return normalizedStreamSettings;
}

function normalizeHysteriaStreamSettingsInValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeHysteriaStreamSettingsInValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const normalizedValue: Record<string, unknown> = {};

  Object.entries(value).forEach(([key, item]) => {
    normalizedValue[key] = normalizeHysteriaStreamSettingsInValue(item);
  });

  if (isRecord(normalizedValue.streamSettings)) {
    normalizedValue.streamSettings = normalizeHysteriaStreamSettings(normalizedValue.streamSettings);
  }

  return normalizedValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function orderFields(fields: string[], preferredOrder: string[]) {
  const fieldSet = new Set(fields);
  const orderedFields = preferredOrder.filter((field) => fieldSet.has(field));
  const remainingFields = fields.filter((field) => !preferredOrder.includes(field));

  return [...orderedFields, ...remainingFields];
}

function getFieldDescription(field: XrayConfigKey, locale: Locale = 'en-US') {
  const fieldSchema = rootProperties[field];

  if (typeof fieldSchema === 'object' && 'description' in fieldSchema) {
    return locale === 'en-US' ? String(fieldSchema.description) : String(fieldSchema.description);
  }

  return '';
}

function localizeDefinitions(definitions: Record<string, unknown>, locale: Locale) {
  const localizedDefinitions: Record<string, unknown> = {};

  Object.entries(definitions).forEach(([key, definition]) => {
    localizedDefinitions[key] = localizeSchemaNode(definition, locale, [key]);
  });

  return localizedDefinitions;
}

function localizeSchemaNode(node: unknown, locale: Locale, path: string[]): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => localizeSchemaNode(item, locale, path));
  }

  if (!isRecord(node)) {
    return node;
  }

  const cloned: Record<string, unknown> = { ...node };
  const lastSegment = path[path.length - 1];
  const translatedTitle = translateSchemaLabel(locale, lastSegment);

  if (translatedTitle && translatedTitle !== lastSegment) {
    cloned.title = translatedTitle;
  }

  if (isRecord(cloned.properties)) {
    const localizedProperties: Record<string, unknown> = {};

    Object.entries(cloned.properties).forEach(([key, propertySchema]) => {
      localizedProperties[key] = localizeSchemaNode(propertySchema, locale, [...path, key]);
    });

    cloned.properties = localizedProperties;
  }

  if ('items' in cloned && cloned.items !== undefined) {
    cloned.items = localizeSchemaNode(cloned.items, locale, [...path, 'items']);
  }

  if (isRecord(cloned.definitions)) {
    cloned.definitions = localizeDefinitions(cloned.definitions, locale);
  }

  if (Array.isArray(cloned.anyOf)) {
    cloned.anyOf = cloned.anyOf.map((item) => localizeSchemaNode(item, locale, path));
  }

  if (Array.isArray(cloned.oneOf)) {
    cloned.oneOf = cloned.oneOf.map((item) => localizeSchemaNode(item, locale, path));
  }

  if (Array.isArray(cloned.allOf)) {
    cloned.allOf = cloned.allOf.map((item) => localizeSchemaNode(item, locale, path));
  }

  return cloned;
}

function localizeUiSchemaNode(node: unknown, locale: Locale, path: string[]): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => localizeUiSchemaNode(item, locale, path));
  }

  if (!isRecord(node)) {
    return node;
  }

  const cloned: Record<string, unknown> = {};

  Object.entries(node).forEach(([key, value]) => {
    if (key === 'ui:placeholder' && typeof value === 'string') {
      cloned[key] = translateUiPlaceholder(locale, path.join('.')) ?? value;
      return;
    }

    cloned[key] = localizeUiSchemaNode(value, locale, [...path, key]);
  });

  return cloned;
}

export const uiSchema: UiSchema = {
  'ui:submitButtonOptions': {
    norender: true,
  },
  'ui:order': topLevelFieldOrder,
  version: {
    'ui:order': ['min', 'max', '*'],
    min: {
      'ui:placeholder': '例如：25.8.3',
    },
    max: {
      'ui:placeholder': '例如：26.1.0',
    },
  },
  log: {
    'ui:order': ['loglevel', 'dnsLog', 'access', 'error', 'maskAddress', '*'],
    access: {
      'ui:placeholder': '/var/log/xray/access.log',
    },
    error: {
      'ui:placeholder': '/var/log/xray/error.log',
    },
  },
  dns: {
    'ui:order': [
      'servers',
      'hosts',
      'queryStrategy',
      'clientIp',
      'disableCache',
      'disableFallback',
      'disableFallbackIfMatch',
      'tag',
      '*',
    ],
    servers: {
      items: {
        'ui:order': ['address', 'port', 'domains', 'expectIPs', 'queryStrategy', 'skipFallback', 'clientIP', '*'],
      },
    },
  },
  routing: {
    'ui:order': ['domainStrategy', 'domainMatcher', 'rules', 'balancers', 'settings', '*'],
    rules: {
      items: {
        'ui:order': [
          'type',
          'inboundTag',
          'domain',
          'ip',
          'port',
          'source',
          'sourcePort',
          'network',
          'protocol',
          'user',
          'attrs',
          'outboundTag',
          'balancerTag',
          'domainMatcher',
          '*',
        ],
        outboundTag: {
          'ui:placeholder': 'direct',
        },
        balancerTag: {
          'ui:placeholder': 'balancer-name',
        },
      },
    },
  },
  inbounds: {
    items: {
      'ui:order': ['tag', 'listen', 'port', 'protocol', 'settings', 'streamSettings', 'sniffing', 'allocate', '*'],
      listen: {
        'ui:placeholder': '0.0.0.0',
      },
      tag: {
        'ui:placeholder': 'socks-in',
      },
      settings: {
        'ui:order': [
          'clients',
          'accounts',
          'auth',
          'udp',
          'ip',
          'address',
          'port',
          'network',
          'decryption',
          'fallbacks',
          'timeout',
          'allowTransparent',
          'userLevel',
          '*',
        ],
      },
      streamSettings: {
        'ui:order': [
          'network',
          'security',
          'tlsSettings',
          'hysteriaSettings',
          'realitySettings',
          'rawSettings',
          'wsSettings',
          'grpcSettings',
          'xhttpSettings',
          'httpupgradeSettings',
          'sockopt',
          '*',
        ],
        security: {
          'ui:widget': 'HysteriaAwareSecurityWidget',
        },
        tlsSettings: {
          'ui:order': ['serverName', 'certificates', 'alpn', 'fingerprint', 'allowInsecure', '*'],
        },
        realitySettings: {
          'ui:order': [
            'dest',
            'serverNames',
            'privateKey',
            'shortIds',
            'publicKey',
            'serverName',
            'shortId',
            'fingerprint',
            'spiderX',
            '*',
          ],
        },
        sockopt: {
          'ui:order': ['mark', 'interface', 'domainStrategy', 'tcpFastOpen', 'tcpMptcp', 'tproxy', 'dialerProxy', '*'],
        },
      },
      sniffing: {
        'ui:order': ['enabled', 'destOverride', 'routeOnly', 'metadataOnly', 'domainsExcluded', '*'],
      },
    },
  },
  outbounds: {
    items: {
      'ui:order': ['tag', 'protocol', 'settings', 'streamSettings', 'mux', 'proxySettings', 'sendThrough', 'targetStrategy', '*'],
      tag: {
        'ui:placeholder': 'direct',
      },
      settings: {
        'ui:order': [
          'vnext',
          'servers',
          'domainStrategy',
          'redirect',
          'response',
          'network',
          'address',
          'port',
          'userLevel',
          'fragment',
          'noises',
          '*',
        ],
        vnext: {
          items: {
            'ui:order': ['address', 'port', 'users', '*'],
            users: {
              items: {
                'ui:order': ['id', 'password', 'encryption', 'security', 'alterId', 'flow', 'email', 'level', '*'],
              },
            },
          },
        },
        servers: {
          items: {
            'ui:order': ['address', 'port', 'method', 'password', 'users', 'flow', 'email', 'level', 'uot', '*'],
            users: {
              items: {
                'ui:order': ['user', 'pass', '*'],
              },
            },
          },
        },
      },
      streamSettings: {
        'ui:order': [
          'network',
          'security',
          'tlsSettings',
          'realitySettings',
          'rawSettings',
          'wsSettings',
          'grpcSettings',
          'xhttpSettings',
          'httpupgradeSettings',
          'sockopt',
          '*',
        ],
        security: {
          'ui:widget': 'HysteriaAwareSecurityWidget',
        },
        tlsSettings: {
          'ui:order': ['serverName', 'alpn', 'fingerprint', 'allowInsecure', 'certificates', '*'],
        },
        realitySettings: {
          'ui:order': ['serverName', 'publicKey', 'shortId', 'fingerprint', 'spiderX', 'privateKey', 'shortIds', '*'],
        },
        sockopt: {
          'ui:order': ['interface', 'domainStrategy', 'tcpFastOpen', 'tcpMptcp', 'mark', 'dialerProxy', 'tproxy', '*'],
        },
      },
      mux: {
        'ui:order': ['enabled', 'concurrency', 'xudpConcurrency', 'xudpProxyUDP443', 'padding', '*'],
      },
      proxySettings: {
        'ui:order': ['tag', 'transportLayer', '*'],
      },
    },
  },
  transport: {
    'ui:order': ['tcpSettings', 'kcpSettings', 'wsSettings', 'httpSettings', 'dsSettings', 'quicSettings', 'grpcSettings', '*'],
  },
  observatory: {
    'ui:order': ['subjectSelector', 'probeURL', 'probeInterval', 'enableConcurrency', '*'],
  },
  burstObservatory: {
    'ui:order': ['subjectSelector', 'pingConfig', '*'],
    pingConfig: {
      'ui:order': ['destination', 'connectivity', 'interval', 'sampling', 'timeout', '*'],
    },
  },
  api: {
    'ui:order': ['tag', 'services', '*'],
  },
  policy: {
    'ui:order': ['levels', 'system', '*'],
  },
  stats: {
    'ui:order': ['*'],
  },
  reverse: {
    'ui:order': ['bridges', 'portals', '*'],
  },
  fakedns: {
    items: {
      'ui:order': ['ipPool', 'poolSize', '*'],
    },
  },
  metrics: {
    'ui:order': ['tag', 'listen', '*'],
  },
  commonProtocolUser: {
    items: {
      'ui:order': ['id', 'password', 'user', 'pass', 'email', 'level', 'flow', 'security', 'encryption', 'alterId', '*'],
    },
  },
  clients: {
    items: {
      'ui:order': ['id', 'password', 'email', 'level', 'flow', 'encryption', '*'],
    },
  },
  accounts: {
    items: {
      'ui:order': ['user', 'pass', '*'],
    },
  },
  users: {
    items: {
      'ui:order': ['id', 'user', 'password', 'pass', 'email', 'level', 'flow', 'security', 'encryption', 'alterId', '*'],
    },
  },
  peers: {
    items: {
      'ui:order': ['endpoint', 'publicKey', 'allowedIPs', 'keepAlive', '*'],
    },
  },
  certificates: {
    items: {
      'ui:order': ['certificateFile', 'keyFile', 'certificate', 'key', 'usage', '*'],
    },
  },
  headers: {
    'ui:order': ['Host', '*'],
  },
  fragment: {
    'ui:order': ['packets', 'length', 'interval', '*'],
  },
  noises: {
    items: {
      'ui:order': ['type', 'packet', 'delay', '*'],
    },
  },
  pingConfig: {
    'ui:order': ['destination', 'connectivity', 'interval', 'sampling', 'timeout', '*'],
  },
  system: {
    'ui:order': [
      'statsInboundUplink',
      'statsInboundDownlink',
      'statsOutboundUplink',
      'statsOutboundDownlink',
      '*',
    ],
  },
  levels: {
    'ui:order': ['*'],
  },
  bridges: {
    items: {
      'ui:order': ['tag', 'domain', '*'],
    },
  },
  portals: {
    items: {
      'ui:order': ['tag', 'domain', '*'],
    },
  },
  balancers: {
    items: {
      'ui:order': ['tag', 'selector', 'strategy', 'fallbackTag', '*'],
    },
  },
  hosts: {
    'ui:order': ['*'],
  },
  settings: {
    'ui:order': ['vnext', 'servers', 'domainStrategy', 'redirect', 'response', 'network', 'address', 'port', '*'],
  },
  streamSettings: {
    'ui:order': [
      'network',
      'security',
      'tlsSettings',
      'hysteriaSettings',
      'realitySettings',
      'rawSettings',
      'wsSettings',
      'grpcSettings',
      'xhttpSettings',
      'httpupgradeSettings',
      'sockopt',
      '*',
    ],
    security: {
      'ui:widget': 'HysteriaAwareSecurityWidget',
    },
  },
  sockopt: {
    'ui:order': ['interface', 'domainStrategy', 'tcpFastOpen', 'tcpMptcp', 'mark', 'dialerProxy', 'tproxy', '*'],
  },
  tlsSettings: {
    'ui:order': ['serverName', 'alpn', 'fingerprint', 'allowInsecure', 'certificates', '*'],
  },
  realitySettings: {
    'ui:order': ['serverName', 'publicKey', 'shortId', 'fingerprint', 'spiderX', 'privateKey', 'shortIds', '*'],
  },
  rawSettings: {
    'ui:order': ['acceptProxyProtocol', 'header', '*'],
  },
  wsSettings: {
    'ui:order': ['path', 'headers', 'host', 'maxEarlyData', 'earlyDataHeaderName', 'acceptProxyProtocol', '*'],
  },
  grpcSettings: {
    'ui:order': ['serviceName', 'authority', 'multiMode', 'idle_timeout', 'health_check_timeout', '*'],
  },
  xhttpSettings: {
    'ui:order': ['host', 'path', 'mode', 'headers', 'extra', 'downloadSettings', '*'],
  },
  httpupgradeSettings: {
    'ui:order': ['host', 'path', 'headers', '*'],
  },
  sniffing: {
    'ui:order': ['enabled', 'destOverride', 'routeOnly', 'metadataOnly', 'domainsExcluded', '*'],
  },
  mux: {
    'ui:order': ['enabled', 'concurrency', 'xudpConcurrency', 'xudpProxyUDP443', 'padding', '*'],
  },
  proxySettings: {
    'ui:order': ['tag', 'transportLayer', '*'],
  },
  vnext: {
    items: {
      'ui:order': ['address', 'port', 'users', '*'],
    },
  },
  servers: {
    items: {
      'ui:order': ['address', 'port', 'method', 'password', 'users', 'domains', 'expectIPs', '*'],
    },
  },
  rules: {
    items: {
      'ui:order': ['type', 'inboundTag', 'domain', 'ip', 'port', 'network', 'outboundTag', 'balancerTag', '*'],
    },
  },
};
