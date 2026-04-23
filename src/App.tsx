import { useMemo, useState } from 'react';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import type { IChangeEvent } from '@rjsf/core';
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

function createDefaultConfig() {
  return orderXrayConfig(structuredClone(defaultConfig));
}

const initialSelectedField = topLevelFields.includes('log') ? 'log' : topLevelFields[0];

function downloadJsonFile(config: XrayConfig) {
  const content = JSON.stringify(orderXrayConfig(config), null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'xray-config.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const { locale, setLocale, t, translateString, transformValidationErrors } = useI18n();
  const [config, setConfig] = useState<XrayConfig>(() => createDefaultConfig());
  const [selectedField, setSelectedField] = useState(initialSelectedField);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFullJsonOpen, setIsFullJsonOpen] = useState(false);

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
                    <Button variant="outlined" onClick={handleReset} startIcon={<ReplayRoundedIcon />}>
                      {t('app.resetModule')}
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => downloadJsonFile(config)}
                      startIcon={<DownloadRoundedIcon />}
                    >
                      {t('app.downloadFullJson')}
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
          <Button onClick={() => downloadJsonFile(config)} startIcon={<DownloadRoundedIcon />}>
            导出完整 JSON
          </Button>
          <Button variant="contained" onClick={() => setIsFullJsonOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
