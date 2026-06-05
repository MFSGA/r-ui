import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { importShareToXrayConfig } from '../utils/multi-protocol-share';
import type { ParsedShare } from '../utils/multi-protocol-share';
import { useMultiProtocolValidation } from './useMultiProtocolValidation';
import { useI18n } from '../i18n';
import type { XrayConfig } from '../schema';

interface MultiImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: XrayConfig;
  onConfigUpdate: (config: XrayConfig) => void;
  onError: (message: string | null) => void;
}

function buildParsedFields(
  parsedResult: ParsedShare,
  t: (key: string, params?: Record<string, string | number>) => string,
): Array<{ label: string; value: string | undefined }> {
  const { protocol, data } = parsedResult;
  const fields: Array<{ label: string; value: string | undefined }> = [
    { label: t('app.share.previewProtocol'), value: protocol },
    { label: t('app.share.previewAddress'), value: data.address },
    { label: t('app.share.previewPort'), value: String(data.port) },
    { label: t('app.share.previewName'), value: data.name },
  ];

  switch (protocol) {
    case 'vmess': {
      const p = data.params;
      fields.push(
        { label: t('app.share.previewEncryption'), value: p.scy },
        { label: t('app.share.previewSecurity'), value: p.tls },
        { label: t('app.share.previewSni'), value: p.sni },
        { label: t('app.share.previewFp'), value: p.fp },
        { label: t('app.share.previewPath'), value: p.path },
        { label: t('app.share.previewHost'), value: p.host },
        { label: t('app.share.previewServiceName'), value: p.serviceName },
      );
      break;
    }
    case 'trojan': {
      const p = data.params;
      fields.push(
        { label: t('app.share.previewSni'), value: p.sni },
        { label: t('app.share.previewFp'), value: p.fp },
        { label: t('app.share.previewPath'), value: p.path },
        { label: t('app.share.previewHost'), value: p.host },
        { label: t('app.share.previewServiceName'), value: p.serviceName },
      );
      break;
    }
    case 'shadowsocks': {
      fields.push(
        { label: t('app.share.previewEncryption'), value: data.method },
      );
      break;
    }
    case 'hysteria2': {
      const p = data.params;
      fields.push(
        { label: t('app.share.previewAuth'), value: data.auth },
        { label: t('app.share.previewSni'), value: p.sni },
        { label: t('app.share.previewInsecure'), value: p.insecure === true ? 'Yes' : undefined },
        { label: t('app.share.previewObfs'), value: p.obfs },
        { label: t('app.share.previewObfsPassword'), value: p.obfsPassword },
        { label: t('app.share.previewUp'), value: p.up },
        { label: t('app.share.previewDown'), value: p.down },
        { label: t('app.share.previewPinSHA256'), value: p.pinSHA256 },
        { label: t('app.share.previewCongestion'), value: p.congestion },
      );
      break;
    }
  }

  return fields.filter((f) => f.value !== undefined && f.value !== '');
}

export default function MultiImportDialog({
  open,
  onClose,
  config,
  onConfigUpdate,
  onError,
}: MultiImportDialogProps) {
  const { t } = useI18n();
  const { input, parsedResult, error, isValidating, validate, clear } = useMultiProtocolValidation();
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    validate(value);
    setCopied(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleConfirmImport();
    }
  };

  const handleConfirmImport = async () => {
    if (!input.trim() || error || !parsedResult) {
      return;
    }

    setIsImporting(true);
    onError(null);

    try {
      const updatedConfig = importShareToXrayConfig(config, input);
      onConfigUpdate(updatedConfig);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    clear();
    setCopied(false);
    onClose();
  };

  const handleCopyParsed = async () => {
    if (!parsedResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(parsedResult, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('[ImportDialog] Failed to copy parsed data to clipboard');
    }
  };

  const borderColor = error ? 'error.main' : parsedResult ? 'success.main' : 'divider';

  const parsedFields = parsedResult ? buildParsedFields(parsedResult, t) : [];

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t('app.share.importTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('app.share.importHint')}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label={t('app.share.importLabel')}
            placeholder={t('app.share.importPlaceholder')}
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            error={!!error}
            helperText={
              error
                ? t('app.share.parseFailed', { 1: error })
                : isValidating
                  ? t('app.share.parsing')
                  : ''
            }
            sx={{
              '& .MuiOutlinedInput-root': {
                borderColor,
                transition: 'border-color 0.2s',
                '&.Mui-focused': {
                  borderColor,
                },
                '& fieldset': {
                  borderColor,
                  borderWidth: error || parsedResult ? 2 : 1,
                  transition: 'border-color 0.2s, border-width 0.2s',
                },
                '&:hover fieldset': {
                  borderColor,
                },
              },
            }}
          />

          <Collapse in={!!parsedResult} timeout={300}>
            {parsedResult && (
              <Card
                variant="outlined"
                sx={{
                  mt: 1,
                  borderColor: 'success.light',
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
                }}
              >
                <CardContent sx={{ pb: '16px !important', '&:last-child': { pb: '16px !important' } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" color="success.dark" fontWeight={600}>
                      {t('app.share.parsedDataTitle')}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleCopyParsed}
                      title={copied ? t('app.share.copiedParsed') : t('app.share.copyParsed')}
                      sx={{ color: 'success.main' }}
                    >
                      {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </Stack>
                  <Stack spacing={0.75}>
                    {parsedFields.map(({ label, value }) => (
                      <Stack key={label} direction="row" spacing={1} alignItems="baseline">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ minWidth: 90, fontWeight: 500 }}
                        >
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                          {value}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Collapse>

          <Collapse in={!!error} timeout={300}>
            {error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {t('app.share.validationError')}: {error}
              </Alert>
            )}
          </Collapse>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={isImporting}>
          {t('app.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirmImport}
          disabled={isImporting || !input.trim() || !!error || !parsedResult}
        >
          {isImporting ? t('app.posting') : t('app.share.importConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
