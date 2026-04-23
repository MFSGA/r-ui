import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import type { IChangeEvent } from '@rjsf/core';
import JSON5 from 'json5';
import TOML from '@iarna/toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CollapsibleObjectFieldTemplate from './CollapsibleObjectFieldTemplate';
import HysteriaAwareSecurityWidget from './HysteriaAwareSecurityWidget';
import PlaceholderBaseInputTemplate from './PlaceholderBaseInputTemplate';
import type { XrayConfig } from './schema';
import {
  defaultConfig,
  getTopLevelFieldSchema,
  getTopLevelFieldUiSchema,
  getTopLevelFieldOptions,
  normalizeSelectedFieldValue,
  orderXrayConfig,
  topLevelFields,
} from './schema';
import { localeOptions, useI18n } from './i18n';

type ConfigFormat = 'json' | 'json5' | 'yaml' | 'toml';

const configFormatOptions: Array<{ value: ConfigFormat; labelKey: string }> = [
  { value: 'json', labelKey: 'app.format.json' },
  { value: 'json5', labelKey: 'app.format.json5' },
  { value: 'yaml', labelKey: 'app.format.yaml' },
  { value: 'toml', labelKey: 'app.format.toml' },
];

function createDefaultConfig() {
  return orderXrayConfig(structuredClone(defaultConfig));
}

const initialSelectedField = topLevelFields.includes('inbounds') ? 'inbounds' : topLevelFields[0];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detectConfigFormat(fileName: string): ConfigFormat | null {
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

function parseConfigText(text: string, format: ConfigFormat) {
  switch (format) {
    case 'json':
      return JSON.parse(text) as unknown;
    case 'json5':
      return JSON5.parse(text) as unknown;
    case 'yaml':
      return parseYaml(text) as unknown;
    case 'toml':
      return TOML.parse(text) as unknown;
  }
}

function serializeConfigText(config: XrayConfig, format: ConfigFormat) {
  const ordered = orderXrayConfig(config);

  switch (format) {
    case 'json':
      return JSON.stringify(ordered, null, 2);
    case 'json5':
      return JSON5.stringify(ordered, null, 2);
    case 'yaml':
      return stringifyYaml(ordered, { lineWidth: 0 });
    case 'toml':
      return TOML.stringify(ordered as any);
  }
}

function downloadConfigFile(config: XrayConfig, format: ConfigFormat) {
  const content = serializeConfigText(config, format);
  const mimeType =
    format === 'json'
      ? 'application/json;charset=utf-8'
      : format === 'json5'
        ? 'application/json5;charset=utf-8'
        : format === 'yaml'
          ? 'application/yaml;charset=utf-8'
          : 'application/toml;charset=utf-8';
  const extension = format === 'json' ? 'json' : format;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `xray-config.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function findInitialSelectedField(config: XrayConfig) {
  return topLevelFields.find((field) => Object.prototype.hasOwnProperty.call(config, field)) ?? initialSelectedField;
}

export default function App() {
  const { locale, setLocale, t, translateString, transformValidationErrors } = useI18n();
  const [config, setConfig] = useState<XrayConfig>(() => createDefaultConfig());
  const [selectedField, setSelectedField] = useState(() => findInitialSelectedField(createDefaultConfig()));
  const [configFormat, setConfigFormat] = useState<ConfigFormat>('json');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFullJsonOpen, setIsFullJsonOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const orderedConfig = useMemo(() => orderXrayConfig(config), [config]);
  const fullJsonPreview = useMemo(() => JSON.stringify(orderedConfig, null, 2), [orderedConfig]);
  const selectedSchema = useMemo(() => getTopLevelFieldSchema(selectedField, locale), [selectedField, locale]);
  const selectedUiSchema = useMemo(() => getTopLevelFieldUiSchema(selectedField, locale), [selectedField, locale]);
  const selectedFieldValue = config[selectedField];
  const templates = useMemo(
    () => ({
      BaseInputTemplate: PlaceholderBaseInputTemplate,
      ObjectFieldTemplate: CollapsibleObjectFieldTemplate,
    }),
    [],
  );
  const selectedModulePreview = useMemo(() => {
    const moduleConfig =
      selectedFieldValue === undefined
        ? {}
        : {
            [selectedField]: selectedFieldValue,
          };

    return JSON.stringify(moduleConfig, null, 2);
  }, [selectedField, selectedFieldValue]);
  const widgets = useMemo(
    () => ({
      HysteriaAwareSecurityWidget,
    }),
    [],
  );
  const formContext = useMemo(
    () => ({
      currentData: selectedFieldValue,
    }),
    [selectedFieldValue],
  );
  const selectedFieldOptions = useMemo(() => getTopLevelFieldOptions(locale), [locale]);

  const handleChange = (event: IChangeEvent<unknown>) => {
    setConfig((currentConfig) =>
      orderXrayConfig({
        ...currentConfig,
        [selectedField]: normalizeSelectedFieldValue(selectedField, event.formData, currentConfig[selectedField]),
      }),
    );
    setIsSubmitted(false);
  };

  const handleSubmit = ({ formData }: IChangeEvent<unknown>) => {
    const nextFormData = normalizeSelectedFieldValue(selectedField, formData, config[selectedField]);
    const nextConfig = orderXrayConfig({
      ...config,
      [selectedField]: nextFormData,
    });

    setConfig(nextConfig);
    setIsSubmitted(true);
    console.log(`提交得到的 Xray ${selectedField} 配置：`, nextFormData);
    console.log('当前完整 Xray JSON 配置：', nextConfig);
  };

  const handleReset = () => {
    setConfig((currentConfig) =>
      orderXrayConfig({
        ...currentConfig,
        [selectedField]: createDefaultConfig()[selectedField],
      }),
    );
    setIsSubmitted(false);
    setOperationError(null);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const detectedFormat = detectConfigFormat(file.name);
      const parseOrder = Array.from(
        new Set([detectedFormat, configFormat, 'json', 'json5', 'yaml', 'toml'].filter(Boolean) as ConfigFormat[]),
      );
      let parsed: unknown = null;
      let parsedSuccessfully = false;
      let resolvedFormat: ConfigFormat | null = null;

      for (const format of parseOrder) {
        try {
          parsed = parseConfigText(text, format);
          parsedSuccessfully = true;
          resolvedFormat = format;
          break;
        } catch {
          // Try the next supported format.
        }
      }

      if (!parsedSuccessfully || !isPlainObject(parsed)) {
        setOperationError(t('app.importParseFailed'));
        return;
      }

      const importedConfig = orderXrayConfig(parsed as XrayConfig);
      setConfig(importedConfig);
      setSelectedField(findInitialSelectedField(importedConfig));
      if (resolvedFormat) {
        setConfigFormat(resolvedFormat);
      }
      setOperationError(null);
      setIsSubmitted(false);
    } catch {
      setOperationError(t('app.importParseFailed'));
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, rgba(124,58,237,0.04) 100%)',
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 3, md: 4 } }} elevation={0}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Chip label={t('app.chip.react')} color="primary" variant="outlined" />
                <Chip label={t('app.chip.schema')} color="secondary" variant="outlined" />
              </Stack>

              <Box>
                <Typography variant="h4" gutterBottom>
                  {t('app.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {t('app.subtitle')}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
            <Paper sx={{ p: 3, flex: 1.2 }} elevation={0}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('app.form.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('app.form.subtitle')}
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel id="top-level-field-label">{t('app.moduleSelect')}</InputLabel>
                    <Select
                      labelId="top-level-field-label"
                      label={t('app.moduleSelect')}
                      value={selectedField}
                      onChange={(event) => {
                        setSelectedField(String(event.target.value));
                        setIsSubmitted(false);
                      }}
                    >
                      {selectedFieldOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel id="config-format-label">{t('app.configFormat')}</InputLabel>
                    <Select
                      labelId="config-format-label"
                      label={t('app.configFormat')}
                      value={configFormat}
                      onChange={(event) => setConfigFormat(event.target.value as ConfigFormat)}
                    >
                      {configFormatOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel id="locale-label">{t('app.language')}</InputLabel>
                    <Select
                      labelId="locale-label"
                      label={t('app.language')}
                      value={locale}
                      onChange={(event) => setLocale(event.target.value as typeof locale)}
                    >
                      {localeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <Divider />

                <Typography variant="body2" color="text.secondary">
                  {t('app.importHint')}
                </Typography>

                <Form
                  key={`${selectedField}-${locale}`}
                  schema={selectedSchema}
                  uiSchema={selectedUiSchema}
                  validator={validator}
                  formData={selectedFieldValue}
                  liveValidate
                  noHtml5Validate
                  showErrorList={false}
                  templates={templates}
                  widgets={widgets}
                  formContext={formContext}
                  translateString={translateString}
                  transformErrors={transformValidationErrors}
                  onChange={handleChange}
                  onSubmit={handleSubmit}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                    <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />}>
                      {t('app.saveModule')}
                    </Button>
                    <Button variant="outlined" onClick={handleImportClick}>
                      {t('app.importConfig')}
                    </Button>
                    <Button variant="outlined" onClick={handleReset} startIcon={<ReplayRoundedIcon />}>
                      {t('app.resetModule')}
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => {
                        try {
                          downloadConfigFile(config, configFormat);
                          setOperationError(null);
                        } catch {
                          setOperationError(t('app.exportFailed'));
                        }
                      }}
                      startIcon={<DownloadRoundedIcon />}
                    >
                      {t('app.downloadConfig')}
                    </Button>
                  </Stack>
                </Form>
              </Stack>
            </Paper>

            <Paper sx={{ p: 3, flex: 1, minWidth: 0 }} elevation={0}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('app.module.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('app.module.subtitle', { field: selectedField })}
                  </Typography>
                </Box>

                {isSubmitted ? (
                  <Alert severity="success">{t('app.module.synced')}</Alert>
                ) : (
                  <Alert severity="info">{t('app.module.syncing')}</Alert>
                )}

                <Button variant="outlined" onClick={() => setIsFullJsonOpen(true)}>
                  {t('app.showFullJson')}
                </Button>

                {operationError ? <Alert severity="error">{operationError}</Alert> : null}

                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'grey.100',
                    overflow: 'auto',
                    fontSize: 13,
                    lineHeight: 1.6,
                    minHeight: 520,
                  }}
                >
                  {selectedModulePreview}
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Container>

      <Dialog open={isFullJsonOpen} onClose={() => setIsFullJsonOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('app.fullJsonTitle')}</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              borderRadius: 3,
              bgcolor: 'grey.100',
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: '70vh',
            }}
          >
            {fullJsonPreview}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              try {
                downloadConfigFile(config, configFormat);
                setOperationError(null);
              } catch {
                setOperationError(t('app.exportFailed'));
              }
            }}
            startIcon={<DownloadRoundedIcon />}
          >
            {t('app.downloadConfig')}
          </Button>
          <Button variant="contained" onClick={() => setIsFullJsonOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        component="input"
        ref={importInputRef}
        type="file"
        accept=".json,.json5,.yaml,.yml,.toml,application/json,application/yaml,application/toml,text/plain"
        sx={{ display: 'none' }}
        onChange={handleImportFileChange}
      />
    </Box>
  );
}
