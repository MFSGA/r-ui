import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import xraySchema from './xray-online-based.schema.json';
import xrayDefaultConfig from './xray-online-based.config.json';

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

export function getTopLevelFieldSchema(field: XrayConfigKey): RJSFSchema {
  const fieldSchema = rootProperties[field];

  return {
    ...(typeof fieldSchema === 'object' ? fieldSchema : {}),
    title: field,
    definitions: xraySchema.definitions,
  } as RJSFSchema;
}

export function getTopLevelFieldUiSchema(field: XrayConfigKey): UiSchema {
  const fieldUiSchema = uiSchema[field];

  return {
    'ui:submitButtonOptions': {
      norender: true,
    },
    ...(typeof fieldUiSchema === 'object' ? fieldUiSchema : {}),
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

function orderFields(fields: string[], preferredOrder: string[]) {
  const fieldSet = new Set(fields);
  const orderedFields = preferredOrder.filter((field) => fieldSet.has(field));
  const remainingFields = fields.filter((field) => !preferredOrder.includes(field));

  return [...orderedFields, ...remainingFields];
}

function getFieldDescription(field: XrayConfigKey) {
  const fieldSchema = rootProperties[field];

  if (typeof fieldSchema === 'object' && 'description' in fieldSchema) {
    return String(fieldSchema.description);
  }

  return '';
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
          'realitySettings',
          'rawSettings',
          'wsSettings',
          'grpcSettings',
          'xhttpSettings',
          'httpupgradeSettings',
          'sockopt',
          '*',
        ],
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
      'realitySettings',
      'rawSettings',
      'wsSettings',
      'grpcSettings',
      'xhttpSettings',
      'httpupgradeSettings',
      'sockopt',
      '*',
    ],
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
