import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TranslatableString } from '@rjsf/utils';
import type { RJSFValidationError } from '@rjsf/utils';

export const locales = ['zh-CN', 'en-US'] as const;
export type Locale = (typeof locales)[number];

export const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

const STORAGE_KEY = 'json-schema-mui-config-demo.locale';

const appTranslations: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    'app.chip.react': 'React + TypeScript + MUI + rjsf',
    'app.chip.schema': 'Xray JSON Schema 驱动',
    'app.title': 'Xray 配置生成器',
    'app.subtitle': '左侧表单由 xray-online-based.schema.json 自动生成。填写完成后，可以在右侧实时得到对应的 Xray JSON 配置。',
    'app.form.title': '配置表单',
    'app.form.subtitle': '先选择第一级配置模块，再只编辑该模块对应的值；右侧会同步展示完整 Xray JSON。',
    'app.module.title': '当前模块 JSON',
    'app.module.subtitle': '这里只展示当前选中的 {field} 模块；完整配置请通过按钮单独查看。',
    'app.module.synced': '当前模块已提交，完整 Xray 配置已同步更新。',
    'app.module.syncing': '正在实时同步当前模块的 formData，右侧只预览当前模块。',
    'app.showFullJson': '查看完整 JSON',
    'app.fullJsonTitle': '完整 Xray JSON 配置',
    'app.downloadConfig': '导出配置',
    'app.importConfig': '导入配置',
    'app.importHint': '支持 JSON / JSON5 / YAML / TOML，导入后可以继续在表单里编辑。',
    'app.saveModule': '保存当前模块',
    'app.resetModule': '重置当前模块',
    'app.moduleSelect': '第一级配置模块',
    'app.language': '语言',
    'app.configFormat': '配置格式',
    'app.format.json': 'JSON',
    'app.format.json5': 'JSON5',
    'app.format.yaml': 'YAML',
    'app.format.toml': 'TOML',
    'app.importInvalidFormat': '导入失败：JSON 不是一个对象。',
    'app.importParseFailed': '导入失败：无法解析为 JSON、JSON5、YAML 或 TOML。',
    'app.exportFailed': '导出失败：当前配置无法序列化为所选格式。',
    'template.noEditableFields': '当前对象暂无可编辑字段',
    'template.applyPlaceholder': '应用占位值',
    'template.clearInput': '清除输入内容',
    'template.selectPlaceholder': '请选择',
    'template.hysteriaSecurityHelper': 'network 为 hysteria 时，security 固定为 tls',
    'template.tlsWizard.configure': '配置 TLS 设置',
    'template.tlsWizard.close': '关闭',
    'template.tlsWizard.previous': '上一步',
    'template.tlsWizard.next': '下一步',
    'template.tlsWizard.finish': '完成并关闭',
    'template.tlsWizard.noFields': '当前步骤没有可编辑字段。',
    'template.tlsWizard.step.basic': '基础',
    'template.tlsWizard.step.behavior': '行为',
    'template.tlsWizard.step.version': '版本与算法',
    'template.tlsWizard.step.certificates': '证书',
    'template.tlsWizard.step.ech': 'ECH 高级',
  },
  'en-US': {
    'app.chip.react': 'React + TypeScript + MUI + rjsf',
    'app.chip.schema': 'Xray JSON Schema driven',
    'app.title': 'Xray Config Generator',
    'app.subtitle': 'The left form is generated from xray-online-based.schema.json. Fill it out and see the matching Xray JSON on the right in real time.',
    'app.form.title': 'Configuration Form',
    'app.form.subtitle': 'Pick a top-level module first, then edit only that module. The right panel stays in sync with the full Xray JSON.',
    'app.module.title': 'Current Module JSON',
    'app.module.subtitle': 'Only the selected {field} module is shown here. Open the full config via the button below.',
    'app.module.synced': 'The current module has been submitted and the full Xray config is synced.',
    'app.module.syncing': 'The current module is syncing live. The right panel only previews the active module.',
    'app.showFullJson': 'View Full JSON',
    'app.fullJsonTitle': 'Full Xray JSON Config',
    'app.downloadConfig': 'Export Config',
    'app.importConfig': 'Import Config',
    'app.importHint': 'Supports JSON / JSON5 / YAML / TOML. Import a file and continue editing it in the form.',
    'app.saveModule': 'Save Module',
    'app.resetModule': 'Reset Module',
    'app.moduleSelect': 'Top-level Module',
    'app.language': 'Language',
    'app.configFormat': 'Config format',
    'app.format.json': 'JSON',
    'app.format.json5': 'JSON5',
    'app.format.yaml': 'YAML',
    'app.format.toml': 'TOML',
    'app.importInvalidFormat': 'Import failed: the file does not contain an object.',
    'app.importParseFailed': 'Import failed: failed to parse as JSON, JSON5, YAML, or TOML.',
    'app.exportFailed': 'Export failed: the current config cannot be serialized to the selected format.',
    'template.noEditableFields': 'This object has no editable fields yet.',
    'template.applyPlaceholder': 'Apply placeholder',
    'template.clearInput': 'Clear input content',
    'template.selectPlaceholder': 'Select',
    'template.hysteriaSecurityHelper': 'When network is hysteria, security is fixed to tls.',
    'template.tlsWizard.configure': 'Configure TLS Settings',
    'template.tlsWizard.close': 'Close',
    'template.tlsWizard.previous': 'Previous',
    'template.tlsWizard.next': 'Next',
    'template.tlsWizard.finish': 'Finish and Close',
    'template.tlsWizard.noFields': 'This step has no editable fields.',
    'template.tlsWizard.step.basic': 'Basics',
    'template.tlsWizard.step.behavior': 'Behavior',
    'template.tlsWizard.step.version': 'Versions & Algorithms',
    'template.tlsWizard.step.certificates': 'Certificates',
    'template.tlsWizard.step.ech': 'ECH Advanced',
  },
};

const schemaLabelTranslations: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    log: '日志',
    dns: 'DNS',
    routing: '路由',
    inbounds: '入站',
    outbounds: '出站',
    api: 'API',
    policy: '策略',
    transport: '传输',
    stats: '统计',
    reverse: '反向代理',
    fakedns: 'Fake DNS',
    metrics: '指标',
    observatory: '可观测性',
    burstObservatory: '突发探测',
    version: '版本',
    loglevel: '日志级别',
    dnsLog: 'DNS 日志',
    access: '访问日志',
    error: '错误日志',
    maskAddress: '掩码地址',
    servers: '服务器',
    hosts: 'Hosts',
    queryStrategy: '查询策略',
    clientIp: '客户端 IP',
    disableCache: '禁用缓存',
    disableFallback: '禁用回退',
    disableFallbackIfMatch: '匹配时禁用回退',
    tag: '标签',
    domainStrategy: '域策略',
    domainMatcher: '域匹配器',
    rules: '规则',
    balancers: '负载均衡器',
    settings: '设置',
    type: '类型',
    inboundTag: '入站标签',
    domain: '域名',
    ip: 'IP',
    port: '端口',
    source: '来源',
    sourcePort: '来源端口',
    network: '网络',
    protocol: '协议',
    user: '用户',
    attrs: '属性',
    outboundTag: '出站标签',
    balancerTag: '均衡器标签',
    listen: '监听地址',
    streamSettings: '流设置',
    sniffing: '流量探测',
    allocate: '分配',
    clients: '客户端',
    accounts: '账号',
    auth: '认证',
    udp: 'UDP',
    address: '地址',
    decryption: '解密',
    fallbacks: '回退',
    timeout: '超时',
    allowTransparent: '允许透明代理',
    userLevel: '用户等级',
    security: '安全',
    tlsSettings: 'TLS 设置',
    realitySettings: 'Reality 设置',
    rawSettings: 'Raw 设置',
    wsSettings: 'WebSocket 设置',
    grpcSettings: 'gRPC 设置',
    xhttpSettings: 'XHTTP 设置',
    httpupgradeSettings: 'HTTP Upgrade 设置',
    hysteriaSettings: 'Hysteria 设置',
    udpmasks: 'UDP 掩码',
    sockopt: 'Socket 选项',
    serverName: '服务器名称',
    verifyPeerCertByName: '按名称验证对端证书',
    rejectUnknownSni: '拒绝未知 SNI',
    allowInsecure: '允许不安全',
    alpn: 'ALPN',
    minVersion: '最小版本',
    maxVersion: '最大版本',
    cipherSuites: '密码套件',
    certificates: '证书',
    disableSystemRoot: '禁用系统根证书',
    enableSessionResumption: '启用会话恢复',
    fingerprint: '指纹',
    pinnedPeerCertSha256: '固定对端证书 SHA256',
    curvePreferences: '曲线优先级',
    masterKeyLog: '主密钥日志',
    echServerKeys: 'ECH 服务器密钥',
    echConfigList: 'ECH 配置列表',
    echForceQuery: '强制查询 ECH',
    echSockopt: 'ECH Socket 选项',
  },
  'en-US': {
    log: 'Log',
    dns: 'DNS',
    routing: 'Routing',
    inbounds: 'Inbound',
    outbounds: 'Outbound',
    api: 'API',
    policy: 'Policy',
    transport: 'Transport',
    stats: 'Stats',
    reverse: 'Reverse',
    fakedns: 'Fake DNS',
    metrics: 'Metrics',
    observatory: 'Observatory',
    burstObservatory: 'Burst Observatory',
    version: 'Version',
    loglevel: 'Log level',
    dnsLog: 'DNS log',
    access: 'Access log',
    error: 'Error log',
    maskAddress: 'Mask address',
    servers: 'Servers',
    hosts: 'Hosts',
    queryStrategy: 'Query strategy',
    clientIp: 'Client IP',
    disableCache: 'Disable cache',
    disableFallback: 'Disable fallback',
    disableFallbackIfMatch: 'Disable fallback if match',
    tag: 'Tag',
    domainStrategy: 'Domain strategy',
    domainMatcher: 'Domain matcher',
    rules: 'Rules',
    balancers: 'Balancers',
    settings: 'Settings',
    type: 'Type',
    inboundTag: 'Inbound tag',
    domain: 'Domain',
    ip: 'IP',
    port: 'Port',
    source: 'Source',
    sourcePort: 'Source port',
    network: 'Network',
    protocol: 'Protocol',
    user: 'User',
    attrs: 'Attributes',
    outboundTag: 'Outbound tag',
    balancerTag: 'Balancer tag',
    listen: 'Listen',
    streamSettings: 'Stream settings',
    sniffing: 'Sniffing',
    allocate: 'Allocate',
    clients: 'Clients',
    accounts: 'Accounts',
    auth: 'Auth',
    udp: 'UDP',
    address: 'Address',
    decryption: 'Decryption',
    fallbacks: 'Fallbacks',
    timeout: 'Timeout',
    allowTransparent: 'Allow transparent',
    userLevel: 'User level',
    security: 'Security',
    tlsSettings: 'TLS settings',
    realitySettings: 'Reality settings',
    rawSettings: 'Raw settings',
    wsSettings: 'WebSocket settings',
    grpcSettings: 'gRPC settings',
    xhttpSettings: 'XHTTP settings',
    httpupgradeSettings: 'HTTP Upgrade settings',
    hysteriaSettings: 'Hysteria settings',
    udpmasks: 'UDP masks',
    sockopt: 'Socket options',
    serverName: 'Server name',
    verifyPeerCertByName: 'Verify peer cert by name',
    rejectUnknownSni: 'Reject unknown SNI',
    allowInsecure: 'Allow insecure',
    alpn: 'ALPN',
    minVersion: 'Min version',
    maxVersion: 'Max version',
    cipherSuites: 'Cipher suites',
    certificates: 'Certificates',
    disableSystemRoot: 'Disable system root',
    enableSessionResumption: 'Enable session resumption',
    fingerprint: 'Fingerprint',
    pinnedPeerCertSha256: 'Pinned peer cert SHA256',
    curvePreferences: 'Curve preferences',
    masterKeyLog: 'Master key log',
    echServerKeys: 'ECH server keys',
    echConfigList: 'ECH config list',
    echForceQuery: 'Force ECH query',
    echSockopt: 'ECH socket options',
  },
};

const uiPlaceholderTranslations: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    'version.min': '例如：25.8.3',
    'version.max': '例如：26.1.0',
  },
  'en-US': {
    'version.min': 'e.g. 25.8.3',
    'version.max': 'e.g. 26.1.0',
  },
};

const rjsfTranslations: Record<Locale, Partial<Record<TranslatableString, string>>> = {
  'zh-CN': {
    [TranslatableString.ArrayItemTitle]: '项目',
    [TranslatableString.MissingItems]: '缺少数组项定义',
    [TranslatableString.EmptyArray]: '暂无项目，可使用下方按钮添加。',
    [TranslatableString.YesLabel]: '是',
    [TranslatableString.NoLabel]: '否',
    [TranslatableString.CloseLabel]: '关闭',
    [TranslatableString.ErrorsLabel]: '错误',
    [TranslatableString.NewStringDefault]: '新值',
    [TranslatableString.AddButton]: '添加',
    [TranslatableString.AddItemButton]: '添加项目',
    [TranslatableString.CopyButton]: '复制',
    [TranslatableString.MoveDownButton]: '下移',
    [TranslatableString.MoveUpButton]: '上移',
    [TranslatableString.RemoveButton]: '删除',
    [TranslatableString.NowLabel]: '现在',
    [TranslatableString.ClearLabel]: '清除',
    [TranslatableString.AriaDateLabel]: '选择日期',
    [TranslatableString.PreviewLabel]: '预览',
    [TranslatableString.DecrementAriaLabel]: '数值减 1',
    [TranslatableString.IncrementAriaLabel]: '数值加 1',
    [TranslatableString.OptionalObjectAdd]: '为可选字段添加数据',
    [TranslatableString.OptionalObjectRemove]: '移除可选字段数据',
    [TranslatableString.OptionalObjectEmptyMsg]: '可选字段暂无数据',
    [TranslatableString.Type]: '类型',
    [TranslatableString.Value]: '值',
    [TranslatableString.ClearButton]: '清除输入',
    [TranslatableString.UnknownFieldType]: '未知字段类型 %1',
    [TranslatableString.OptionPrefix]: '选项 %1',
    [TranslatableString.TitleOptionPrefix]: '%1 选项 %2',
    [TranslatableString.KeyLabel]: '%1 键',
    [TranslatableString.InvalidObjectField]: '无效的 "%1" 对象字段配置：_%2_。',
    [TranslatableString.UnsupportedField]: '不支持的字段类型。',
    [TranslatableString.UnsupportedFieldWithId]: '字段 `%1` 的 schema 不受支持。',
    [TranslatableString.UnsupportedFieldWithReason]: '不支持的字段 schema：_%1_。',
    [TranslatableString.UnsupportedFieldWithIdAndReason]: '字段 `%1` 的 schema 不受支持：_%2_。',
    [TranslatableString.FilesInfo]: '**%1**（%2，%3 字节）',
  },
  'en-US': {
    [TranslatableString.ArrayItemTitle]: 'Item',
    [TranslatableString.MissingItems]: 'Missing items definition',
    [TranslatableString.EmptyArray]: 'No items yet. Use the button below to add some.',
    [TranslatableString.YesLabel]: 'Yes',
    [TranslatableString.NoLabel]: 'No',
    [TranslatableString.CloseLabel]: 'Close',
    [TranslatableString.ErrorsLabel]: 'Errors',
    [TranslatableString.NewStringDefault]: 'New Value',
    [TranslatableString.AddButton]: 'Add',
    [TranslatableString.AddItemButton]: 'Add Item',
    [TranslatableString.CopyButton]: 'Copy',
    [TranslatableString.MoveDownButton]: 'Move down',
    [TranslatableString.MoveUpButton]: 'Move up',
    [TranslatableString.RemoveButton]: 'Remove',
    [TranslatableString.NowLabel]: 'Now',
    [TranslatableString.ClearLabel]: 'Clear',
    [TranslatableString.AriaDateLabel]: 'Select a date',
    [TranslatableString.PreviewLabel]: 'Preview',
    [TranslatableString.DecrementAriaLabel]: 'Decrease value by 1',
    [TranslatableString.IncrementAriaLabel]: 'Increase value by 1',
    [TranslatableString.OptionalObjectAdd]: 'Add data for optional field',
    [TranslatableString.OptionalObjectRemove]: 'Remove data for optional field',
    [TranslatableString.OptionalObjectEmptyMsg]: 'No data for optional field',
    [TranslatableString.Type]: 'Type',
    [TranslatableString.Value]: 'Value',
    [TranslatableString.ClearButton]: 'Clear input',
    [TranslatableString.UnknownFieldType]: 'Unknown field type %1',
    [TranslatableString.OptionPrefix]: 'Option %1',
    [TranslatableString.TitleOptionPrefix]: '%1 option %2',
    [TranslatableString.KeyLabel]: '%1 Key',
    [TranslatableString.InvalidObjectField]: 'Invalid "%1" object field configuration: _%2_.',
    [TranslatableString.UnsupportedField]: 'Unsupported field schema.',
    [TranslatableString.UnsupportedFieldWithId]: 'Unsupported field schema for field `%1`.',
    [TranslatableString.UnsupportedFieldWithReason]: 'Unsupported field schema: _%1_.',
    [TranslatableString.UnsupportedFieldWithIdAndReason]: 'Unsupported field schema for field `%1`: _%2_.',
    [TranslatableString.FilesInfo]: '**%1** (%2, %3 bytes)',
  },
};

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const TranslationContext = createContext<TranslationContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale],
  );

  return createElement(TranslationContext.Provider, { value, children });
}

export function useI18n() {
  const context = useContext(TranslationContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return {
    locale: context.locale,
    setLocale: context.setLocale,
    t: (key: string, params?: Record<string, string | number>) => translate(context.locale, key, params),
    translateString: (stringKey: TranslatableString, params?: string[]) => translateRjsfString(context.locale, stringKey, params),
    transformValidationErrors: (errors: RJSFValidationError[]) => transformValidationErrors(context.locale, errors),
  };
}

export function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en-US') {
      return stored;
    }

    const browserLanguage = window.navigator.language.toLowerCase();
    if (browserLanguage.startsWith('zh')) {
      return 'zh-CN';
    }
  }

  return 'en-US';
}

export function translateSchemaLabel(locale: Locale, key: string): string {
  return schemaLabelTranslations[locale][key] ?? schemaLabelTranslations['en-US'][key] ?? key;
}

export function translateUiPlaceholder(locale: Locale, path: string): string | undefined {
  return uiPlaceholderTranslations[locale][path] ?? uiPlaceholderTranslations['en-US'][path];
}

export function translateRjsfString(locale: Locale, stringKey: TranslatableString, params?: string[]): string {
  const template = String(rjsfTranslations[locale][stringKey] ?? rjsfTranslations['en-US'][stringKey] ?? stringKey);
  return interpolate(template, params);
}

export function transformValidationErrors(locale: Locale, errors: RJSFValidationError[]): RJSFValidationError[] {
  return errors.map((error) => ({
    ...error,
    message: translateValidationError(locale, error),
  }));
}

function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const template = String(appTranslations[locale][key] ?? appTranslations['en-US'][key] ?? key);
  return interpolate(template, params ? Object.values(params).map(String) : undefined);
}

function translateValidationError(locale: Locale, error: RJSFValidationError) {
  if (locale === 'en-US') {
    return error.message ?? error.stack;
  }

  switch (error.name) {
    case 'required':
      return `缺少必填字段 ${String(error.params?.missingProperty ?? '')}`.trim();
    case 'additionalProperties':
      return `不允许额外字段 ${String(error.params?.additionalProperty ?? '')}`.trim();
    case 'type':
      return `类型必须为 ${String(error.params?.type ?? '')}`.trim();
    case 'enum':
      return '值不在允许范围内';
    case 'anyOf':
    case 'oneOf':
      return '必须匹配一个可用的配置分支';
    case 'minLength':
      return `字符串长度不能少于 ${String(error.params?.limit ?? '')}`.trim();
    case 'maxLength':
      return `字符串长度不能超过 ${String(error.params?.limit ?? '')}`.trim();
    case 'minimum':
      return `数值不能小于 ${String(error.params?.limit ?? '')}`.trim();
    case 'maximum':
      return `数值不能大于 ${String(error.params?.limit ?? '')}`.trim();
    default:
      return error.message ?? error.stack;
  }
}

function interpolate(template: string, params?: Array<string | number>): string {
  if (!params?.length) {
    return template;
  }

  let result = String(template);

  params.forEach((param, index) => {
    result = result.replaceAll(`%${index + 1}`, String(param));
  });

  return result;
}
