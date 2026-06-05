import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  parseShareLink,
  importShareToXrayConfig,
} from '../utils/multi-protocol-share';
import type { ParsedShare } from '../utils/multi-protocol-share';
import { useI18n } from '../i18n';
import type { XrayConfig } from '../schema';

type ImportMode = 'append' | 'replaceByTag' | 'replaceFirst';

interface ParsedLine {
  raw: string;
  share: ParsedShare | null;
  error: string | null;
}

interface BatchImportResult {
  successCount: number;
  failedCount: number;
}

interface MultiBatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: XrayConfig;
  onConfigUpdate: (config: XrayConfig) => void;
  onError: (message: string | null) => void;
}

function getProtocolInfo(share: ParsedShare): string {
  switch (share.protocol) {
    case 'vmess':
      return `${share.data.params.net} / ${share.data.params.tls}`;
    case 'trojan':
      return `${share.data.params.type} / tls`;
    case 'shadowsocks':
      return `${share.data.method}${share.data.params.plugin ? ` / plugin:${share.data.params.plugin}` : ''}`;
    case 'hysteria2':
      return `hysteria2 / ${share.data.params.congestion ?? 'bbr'}`;
  }
}

export default function MultiBatchImportDialog({
  open,
  onClose,
  config,
  onConfigUpdate,
  onError,
}: MultiBatchImportDialogProps) {
  const { t } = useI18n();
  const [inputText, setInputText] = useState('');
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });

  const firstInvalidRef = useRef<HTMLDivElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement | null>(null);

  const validCount = parsedLines.filter((line) => line.share !== null).length;
  const invalidCount = parsedLines.filter((line) => line.share === null).length;
  const hasParsed = parsedLines.length > 0;
  const hasValidLinks = validCount > 0;

  // Auto-scroll to first invalid link after parsing
  useEffect(() => {
    if (hasParsed && invalidCount > 0 && firstInvalidRef.current && resultsContainerRef.current) {
      firstInvalidRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hasParsed, invalidCount]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setInputText('');
      setParsedLines([]);
      setImportResult(null);
      setImportMode('append');
      setParseProgress({ current: 0, total: 0 });
    }
  }, [open]);

  const handleParse = () => {
    const lines = inputText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return;
    }

    setIsParsing(true);
    setImportResult(null);

    // Synchronous parsing - completes in <1ms
    const results: ParsedLine[] = [];
    for (const raw of lines) {
      try {
        const share = parseShareLink(raw);
        results.push({ raw, share, error: null });
      } catch (err) {
        results.push({
          raw,
          share: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    setParsedLines(results);
    setIsParsing(false);
    setParseProgress({ current: lines.length, total: lines.length });
    // Clear ref so useEffect can re-scroll to the first invalid line of this parse run
    firstInvalidRef.current = null;
  };

  const handleConfirmImport = async () => {
    if (!hasValidLinks) {
      return;
    }

    setIsImporting(true);
    onError(null);
    setImportResult(null);

    let successCount = 0;
    let failedCount = 0;

    let currentConfig = config;

    for (const line of parsedLines) {
      if (line.share === null) {
        failedCount++;
        continue;
      }

      try {
        currentConfig = importShareToXrayConfig(currentConfig, line.raw, {
          mode: importMode,
        });
        successCount++;
      } catch (err) {
        console.warn('[BatchImport] Failed to import line', err);
        failedCount++;
      }
    }

    onConfigUpdate(currentConfig);
    setImportResult({ successCount, failedCount });
    setIsImporting(false);
  };

  const handleCancel = () => {
    setInputText('');
    setParsedLines([]);
    setImportResult(null);
    setImportMode('append');
    setParseProgress({ current: 0, total: 0 });
    onClose();
  };

  const truncateLink = (link: string, maxLength = 60) => {
    return link.length > maxLength ? `${link.slice(0, maxLength)}...` : link;
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>{t('app.share.batchTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('app.share.batchHint')}
          </Typography>

          <TextField
            fullWidth
            multiline
            minRows={6}
            label={t('app.share.batchLabel')}
            placeholder={t('app.share.batchPlaceholder')}
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              setParsedLines([]);
              setImportResult(null);
            }}
            disabled={isImporting}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              onClick={handleParse}
              disabled={isParsing || !inputText.trim()}
            >
              {isParsing ? t('app.share.batchParsing') : t('app.share.batchParse')}
            </Button>
            {isParsing && (
              <Stack spacing={0.5} sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={(parseProgress.current / parseProgress.total) * 100}
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {t('app.share.parsingProgress', { 1: parseProgress.current, 2: parseProgress.total })}
                </Typography>
              </Stack>
            )}
          </Stack>

          {hasParsed && (
            <Stack spacing={1.5} ref={resultsContainerRef}>
              <Typography variant="subtitle2" fontWeight={600}>
                {t('app.share.batchPreview')}
              </Typography>

              {parsedLines.map((line, index) => {
                const isFirstInvalid = line.share === null && !firstInvalidRef.current;
                const ref = isFirstInvalid ? firstInvalidRef : undefined;

                const lineContent = (
                  <Stack
                    key={index}
                    ref={ref}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: (theme) => line.share ? alpha(theme.palette.success.main, 0.08) : alpha(theme.palette.error.main, 0.08),
                      border: (theme) =>
                        `1px solid ${line.share ? theme.palette.success.light : theme.palette.error.light}`,
                    }}
                  >
                    {line.share ? (
                      <Badge
                        color="success"
                        badgeContent={'\u2713'}
                        sx={{ mt: 0.5 }}
                      />
                    ) : (
                      <Tooltip title={line.error ?? t('app.share.invalid')} arrow placement="top">
                        <Badge
                          color="error"
                          badgeContent={'\u2717'}
                          sx={{ mt: 0.5, cursor: 'help' }}
                        />
                      </Tooltip>
                    )}
                    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          wordBreak: 'break-all',
                          color: 'text.secondary',
                        }}
                      >
                        {truncateLink(line.raw)}
                      </Typography>
                      {line.share ? (
                        <Stack direction="row" spacing={2} flexWrap="wrap">
                          <Typography variant="caption" color="text.secondary">
                            {line.share.protocol}: {line.share.data.name ?? line.share.data.address}:{line.share.data.port}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getProtocolInfo(line.share)}
                          </Typography>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <ErrorOutlineIcon fontSize="small" sx={{ color: 'error.main', fontSize: 14 }} />
                          <Typography variant="caption" color="error.main">
                            {line.error}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                );

                // For invalid lines, wrap with tooltip for hover detail
                if (!line.share) {
                  return (
                    <Tooltip key={index} title={line.error ?? t('app.share.invalid')} arrow placement="top">
                      {lineContent}
                    </Tooltip>
                  );
                }

                return lineContent;
              })}

              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="success.main" fontWeight={500}>
                  {t('app.share.batchValidCount', { 1: validCount })}
                </Typography>
                <Typography variant="body2" color="error.main" fontWeight={500}>
                  {t('app.share.batchInvalidCount', { 1: invalidCount })}
                </Typography>
                {isParsing && (
                  <CircularProgress size={16} sx={{ ml: 1 }} />
                )}
              </Stack>
            </Stack>
          )}

          {hasParsed && hasValidLinks && (
            <FormControl fullWidth>
              <InputLabel id="batch-import-mode-label">{t('app.share.importMode')}</InputLabel>
              <Select
                labelId="batch-import-mode-label"
                label={t('app.share.importMode')}
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as ImportMode)}
                disabled={isImporting}
              >
                <MenuItem value="append">{t('app.share.modeAppend')}</MenuItem>
                <MenuItem value="replaceByTag">{t('app.share.modeReplaceTag')}</MenuItem>
                <MenuItem value="replaceFirst">{t('app.share.modeReplaceFirst')}</MenuItem>
              </Select>
            </FormControl>
          )}

          {importResult && (
            <Alert severity={importResult.failedCount === 0 ? 'success' : 'warning'}>
              {t('app.share.batchResult', {
                1: importResult.successCount,
                2: importResult.failedCount,
              })}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={isImporting}>
          {t('app.share.batchCancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirmImport}
          disabled={isImporting || !hasValidLinks}
        >
          {isImporting ? t('app.share.batchImporting') : t('app.share.batchConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
