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

export const topLevelFields = Object.keys(rootProperties);

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
  version: {
    min: {
      'ui:placeholder': '例如：25.8.3',
    },
    max: {
      'ui:placeholder': '例如：26.1.0',
    },
  },
  log: {
    access: {
      'ui:placeholder': '/var/log/xray/access.log',
    },
    error: {
      'ui:placeholder': '/var/log/xray/error.log',
    },
  },
  inbounds: {
    items: {
      listen: {
        'ui:placeholder': '127.0.0.1',
      },
      tag: {
        'ui:placeholder': 'socks-in',
      },
    },
  },
  outbounds: {
    items: {
      tag: {
        'ui:placeholder': 'direct',
      },
    },
  },
  routing: {
    rules: {
      items: {
        outboundTag: {
          'ui:placeholder': 'direct',
        },
        balancerTag: {
          'ui:placeholder': 'balancer-name',
        },
      },
    },
  },
};
