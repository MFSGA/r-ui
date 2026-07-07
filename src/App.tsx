import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
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
  Menu,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import CollapsibleObjectFieldTemplate from './CollapsibleObjectFieldTemplate';
import {
  CompactArrayFieldItemTemplate,
  CompactArrayFieldTemplate,
} from './CompactArrayFieldTemplate';
import HysteriaAwareSecurityWidget from './HysteriaAwareSecurityWidget';
import PlaceholderBaseInputTemplate from './PlaceholderBaseInputTemplate';
const PostConfigDialog = lazy(() => import('./PostConfigDialog'));
import { XrayFormUpdateProvider } from './XrayFormUpdateContext';
import { AccordionCollapseProvider, useAccordionCollapse } from './AccordionCollapseContext';
import {
  configFormatOptions,
  detectConfigFormat,
  detectConfigFormatFromUrl,
  downloadConfigFile,
  isPlainObject,
  parseImportedConfig,
  type ConfigFormat,
} from './configFormat';
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
const MultiImportDialog = lazy(() => import('./multi-protocol/ImportDialog'));
const MultiBatchImportDialog = lazy(() => import('./multi-protocol/BatchImportDialog'));
const MultiShareLinkPanel = lazy(() => import('./multi-protocol/ShareLinkPanel'));
const ShareExportSection = lazy(() => import('./multi-protocol/ShareExportSection'));
import ErrorBoundary from './ErrorBoundary';

function CollapseToggleButton() {
  const { collapsedAll, setCollapsedAll } = useAccordionCollapse();
  const { t } = useI18n();
  return (
    <Button
      variant="text"
      onClick={() => setCollapsedAll(!collapsedAll)}
      startIcon={collapsedAll ? <UnfoldMoreRoundedIcon /> : <UnfoldLessRoundedIcon />}
    >
      {collapsedAll ? t('app.expandAll') : t('app.collapseAll')}
    </Button>
  );
}

function createDefaultConfig() {
  return orderXrayConfig(structuredClone(defaultConfig));
}

const initialSelectedField = topLevelFields.includes('inbounds') ? 'inbounds' : topLevelFields[0];

function findInitialSelectedField(config: XrayConfig) {
  return (
    topLevelFields.find((field) => Object.prototype.hasOwnProperty.call(config, field)) ??
    initialSelectedField
  );
}

function setValueAtPath(rootValue: unknown, path: Array<string | number>, nextValue: unknown) {
  if (path.length === 0) {
    return nextValue;
  }

  const rootContainer = cloneContainer(rootValue, path[0]);
  let cursor = rootContainer as Record<string, unknown> | unknown[];

  path.slice(0, -1).forEach((segment, index) => {
    const nextSegment = path[index + 1];
    const currentValue = getSegmentValue(cursor, segment);
    const nextContainer = cloneContainer(currentValue, nextSegment);

    if (Array.isArray(cursor) && isArrayIndexSegment(segment)) {
      cursor[Number(segment)] = nextContainer;
    } else {
      (cursor as Record<string, unknown>)[String(segment)] = nextContainer;
    }

    cursor = nextContainer as Record<string, unknown> | unknown[];
  });

  const lastSegment = path[path.length - 1];

  if (Array.isArray(cursor) && isArrayIndexSegment(lastSegment)) {
    cursor[Number(lastSegment)] = nextValue;
  } else {
    (cursor as Record<string, unknown>)[String(lastSegment)] = nextValue;
  }

  return rootContainer;
}

function cloneContainer(value: unknown, nextSegment: string | number) {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (isPlainObject(value)) {
    return { ...value };
  }

  return isArrayIndexSegment(nextSegment) ? [] : {};
}

function getSegmentValue(container: Record<string, unknown> | unknown[], segment: string | number) {
  if (Array.isArray(container) && isArrayIndexSegment(segment)) {
    return container[Number(segment)];
  }

  return (container as Record<string, unknown>)[String(segment)];
}

function isArrayIndexSegment(segment: string | number) {
  return typeof segment === 'number' || /^\d+$/.test(segment);
}

export default function App() {
  const { locale, setLocale, t, translateString, transformValidationErrors } = useI18n();
  const [config, setConfig] = useState<XrayConfig>(() => createDefaultConfig());
  const [selectedField, setSelectedField] = useState(() =>
    findInitialSelectedField(createDefaultConfig()),
  );
  const initialFormat = (
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('format') : null
  ) as ConfigFormat | null;
  const [configFormat, setConfigFormat] = useState<ConfigFormat>(
    initialFormat && ['json', 'json5', 'yaml', 'toml'].includes(initialFormat)
      ? initialFormat
      : 'json',
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFullJsonOpen, setIsFullJsonOpen] = useState(false);
  const [importMenuAnchorEl, setImportMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [isImportUrlOpen, setIsImportUrlOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isPostUrlOpen, setIsPostUrlOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Multi-protocol states
  const [multiImportOpen, setMultiImportOpen] = useState(false);
  const [multiBatchImportOpen, setMultiBatchImportOpen] = useState(false);
  const [multiPanelOpen, setMultiPanelOpen] = useState(false);

  const orderedConfig = useMemo(() => orderXrayConfig(config), [config]);
  const fullJsonPreview = useMemo(() => JSON.stringify(orderedConfig, null, 2), [orderedConfig]);
  const selectedSchema = useMemo(
    () => getTopLevelFieldSchema(selectedField, locale),
    [selectedField, locale],
  );
  const selectedUiSchema = useMemo(
    () => getTopLevelFieldUiSchema(selectedField, locale),
    [selectedField, locale],
  );
  const selectedFieldValue = config[selectedField];
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
  const updateSelectedFieldPath = useCallback(
    (path: Array<string | number>, nextValue: unknown) => {
      setConfig((currentConfig) => {
        const nextSelectedValue = setValueAtPath(
          structuredClone(currentConfig[selectedField]),
          path,
          nextValue,
        );

        return orderXrayConfig({
          ...currentConfig,
          [selectedField]: normalizeSelectedFieldValue(
            selectedField,
            nextSelectedValue,
            currentConfig[selectedField],
          ),
        });
      });
      setIsSubmitted(false);
    },
    [selectedField],
  );
  const templates = useMemo(
    () => ({
      ArrayFieldTemplate: CompactArrayFieldTemplate,
      ArrayFieldItemTemplate: CompactArrayFieldItemTemplate,
      BaseInputTemplate: PlaceholderBaseInputTemplate,
      ObjectFieldTemplate: (props: Parameters<typeof CollapsibleObjectFieldTemplate>[0]) => (
        <CollapsibleObjectFieldTemplate
          {...props}
          updateSelectedFieldPath={updateSelectedFieldPath}
        />
      ),
    }),
    [updateSelectedFieldPath],
  );
  const formContext = useMemo(
    () => ({
      currentData: selectedFieldValue,
      updateSelectedFieldPath,
    }),
    [selectedFieldValue, updateSelectedFieldPath],
  );
  const selectedFieldOptions = useMemo(() => getTopLevelFieldOptions(locale), [locale]);
  const isImportMenuOpen = Boolean(importMenuAnchorEl);

  const handleChange = (event: IChangeEvent<unknown>) => {
    setConfig((currentConfig) =>
      orderXrayConfig({
        ...currentConfig,
        [selectedField]: normalizeSelectedFieldValue(
          selectedField,
          event.formData,
          currentConfig[selectedField],
        ),
      }),
    );
    setIsSubmitted(false);
  };

  const handleSubmit = ({ formData }: IChangeEvent<unknown>) => {
    const nextFormData = normalizeSelectedFieldValue(
      selectedField,
      formData,
      config[selectedField],
    );
    const nextConfig = orderXrayConfig({
      ...config,
      [selectedField]: nextFormData,
    });

    setConfig(nextConfig);
    setIsSubmitted(true);
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

  const handleImportMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setImportMenuAnchorEl(event.currentTarget);
  };

  const handleImportMenuClose = () => {
    setImportMenuAnchorEl(null);
  };

  const handleImportFileClick = () => {
    handleImportMenuClose();
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
      const importedResult = parseImportedConfig(text, configFormat, detectedFormat);
      const importedConfig = importedResult.config;
      setConfig(importedConfig);
      setSelectedField(findInitialSelectedField(importedConfig));
      setOperationError(null);
      setIsSubmitted(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('app.importParseFailed'));
    }
  };

  const handleImportUrlOpen = () => {
    handleImportMenuClose();
    setImportUrl('');
    setIsImportUrlOpen(true);
  };

  const handleImportUrlClose = () => {
    if (!isImportingUrl) {
      setIsImportUrlOpen(false);
    }
  };

  const handleImportUrlSubmit = async () => {
    const normalizedUrl = importUrl.trim();

    if (!normalizedUrl) {
      setOperationError(t('app.importUrlInvalid'));
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(normalizedUrl, window.location.href);
    } catch {
      setOperationError(t('app.importUrlInvalid'));
      return;
    }

    setIsImportingUrl(true);

    try {
      const response = await fetch(parsedUrl.toString(), { credentials: 'omit' });

      if (!response.ok) {
        setOperationError(
          t('app.importUrlFetchFailed', { status: response.status, url: parsedUrl.toString() }),
        );
        return;
      }

      const text = await response.text();
      const detectedFormat = detectConfigFormatFromUrl(parsedUrl.toString());
      const importedResult = parseImportedConfig(text, configFormat, detectedFormat);
      setConfig(importedResult.config);
      setSelectedField(findInitialSelectedField(importedResult.config));
      setOperationError(null);
      setIsSubmitted(false);
      setIsImportUrlOpen(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('app.importUrlParseFailed'));
    } finally {
      setIsImportingUrl(false);
    }
  };

  // Keep the POST dialog wired below; restore this handler with the toolbar button when POST is exposed again.
  // const handlePostUrlOpen = () => {
  //   setOperationError(null);
  //   setIsPostUrlOpen(true);
  // };

  // Multi-protocol handlers
  const handleMultiImportOpen = () => {
    setOperationError(null);
    setMultiImportOpen(true);
  };

  const handleMultiImportClose = () => {
    setMultiImportOpen(false);
  };

  const handleMultiImportConfirm = (updatedConfig: XrayConfig) => {
    setConfig(updatedConfig);
    setOperationError(null);
    setIsSubmitted(false);
  };

  const handleMultiBatchImportOpen = () => {
    setOperationError(null);
    setMultiBatchImportOpen(true);
  };

  const handleMultiBatchImportClose = () => {
    setMultiBatchImportOpen(false);
  };

  const handleMultiBatchConfigUpdate = (updatedConfig: XrayConfig) => {
    setConfig(updatedConfig);
    setOperationError(null);
    setIsSubmitted(false);
  };

  const handleMultiPanelOpen = () => {
    setMultiPanelOpen(true);
  };

  const handleMultiPanelClose = () => {
    setMultiPanelOpen(false);
  };

  const handleMultiPanelCopyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
  };

  const handleMultiPanelDeleteOutbound = (index: number) => {
    setConfig((currentConfig) => {
      if (!Array.isArray(currentConfig.outbounds)) return currentConfig;
      const nextOutbounds = [...currentConfig.outbounds];
      nextOutbounds.splice(index, 1);
      return orderXrayConfig({ ...currentConfig, outbounds: nextOutbounds });
    });
    setOperationError(null);
    setIsSubmitted(false);
  };

  return (
    <ErrorBoundary>
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
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
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

                  <AccordionCollapseProvider>
                    <XrayFormUpdateProvider value={updateSelectedFieldPath}>
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
                          <Button variant="outlined" onClick={handleImportMenuOpen}>
                            {t('app.importConfig')}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={handleReset}
                            startIcon={<ReplayRoundedIcon />}
                          >
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
                          <CollapseToggleButton />
                        </Stack>
                      </Form>
                    </XrayFormUpdateProvider>
                  </AccordionCollapseProvider>

                  <Menu
                    anchorEl={importMenuAnchorEl}
                    open={isImportMenuOpen}
                    onClose={handleImportMenuClose}
                  >
                    <MenuItem onClick={handleImportFileClick}>{t('app.importFromFile')}</MenuItem>
                    <MenuItem onClick={handleImportUrlOpen}>{t('app.importFromUrl')}</MenuItem>
                  </Menu>
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
                  {selectedField === 'outbounds' &&
                    Array.isArray(config.outbounds) &&
                    config.outbounds.length > 0 && (
                      <Suspense fallback={null}>
                        <ShareExportSection
                          outbounds={config.outbounds}
                          onImportOpen={handleMultiImportOpen}
                          onPanelOpen={handleMultiPanelOpen}
                          onBatchImportOpen={handleMultiBatchImportOpen}
                        />
                      </Suspense>
                    )}
                </Stack>
              </Paper>
            </Stack>
          </Stack>
        </Container>

        <Dialog
          open={isFullJsonOpen}
          onClose={() => setIsFullJsonOpen(false)}
          maxWidth="md"
          fullWidth
        >
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
              {t('app.close')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={isImportUrlOpen} onClose={handleImportUrlClose} maxWidth="sm" fullWidth>
          <DialogTitle>{t('app.importUrlTitle')}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('app.importUrlHint')}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label={t('app.importUrlLabel')}
                placeholder={t('app.importUrlPlaceholder')}
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleImportUrlClose} disabled={isImportingUrl}>
              {t('app.cancel')}
            </Button>
            <Button variant="contained" onClick={handleImportUrlSubmit} disabled={isImportingUrl}>
              {isImportingUrl ? t('app.importing') : t('app.importUrlSubmit')}
            </Button>
          </DialogActions>
        </Dialog>

        <Suspense fallback={null}>
          <PostConfigDialog
            config={orderedConfig}
            format={configFormat}
            onClose={() => setIsPostUrlOpen(false)}
            onError={setOperationError}
            open={isPostUrlOpen}
          />
        </Suspense>

        <Suspense fallback={null}>
          <MultiImportDialog
            open={multiImportOpen}
            onClose={handleMultiImportClose}
            config={orderedConfig}
            onConfigUpdate={handleMultiImportConfirm}
            onError={setOperationError}
          />
        </Suspense>

        <Suspense fallback={null}>
          <MultiBatchImportDialog
            open={multiBatchImportOpen}
            onClose={handleMultiBatchImportClose}
            config={orderedConfig}
            onConfigUpdate={handleMultiBatchConfigUpdate}
            onError={setOperationError}
          />
        </Suspense>

        <Suspense fallback={null}>
          <MultiShareLinkPanel
            open={multiPanelOpen}
            onClose={handleMultiPanelClose}
            config={orderedConfig}
            onCopyLink={handleMultiPanelCopyLink}
            onDeleteOutbound={handleMultiPanelDeleteOutbound}
          />
        </Suspense>

        <Box
          component="input"
          ref={importInputRef}
          type="file"
          accept=".json,.json5,.yaml,.yml,.toml,application/json,application/yaml,application/toml,text/plain"
          sx={{ display: 'none' }}
          onChange={handleImportFileChange}
        />
      </Box>
    </ErrorBoundary>
  );
}
