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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { importVlessShareToXrayConfig } from '../utils/vless-share';
import { useI18n } from '../i18n';
import { useVlessValidation } from './useVlessValidation';
import type { XrayConfig } from '../schema';

interface VlessImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: XrayConfig;
  onConfigUpdate: (config: XrayConfig) => void;
  onError: (message: string | null) => void;
}

export default function VlessImportDialog({
  open,
  onClose,
  config,
  onConfigUpdate,
  onError,
}: VlessImportDialogProps) {
  const { t } = useI18n();
  const { input, parsedResult, error, isValidating, validate, clear } = useVlessValidation();
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
      const updatedConfig = importVlessShareToXrayConfig(config, input);
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
      // fallback ignored
    }
  };

  const borderColor = error ? 'error.main' : parsedResult ? 'success.main' : 'divider';

  const parsedFields: Array<{ label: string; value: string | undefined }> = [
    { label: t('app.vless.previewProtocol'), value: parsedResult?.params.type },
    { label: t('app.vless.previewAddress'), value: parsedResult?.address },
    { label: t('app.vless.previewPort'), value: parsedResult?.port?.toString() },
    { label: t('app.vless.previewName'), value: parsedResult?.name },
    { label: t('app.vless.previewEncryption'), value: parsedResult?.params.encryption },
    { label: t('app.vless.previewSecurity'), value: parsedResult?.params.security },
    { label: t('app.vless.previewFlow'), value: parsedResult?.params.flow },
    { label: t('app.vless.previewSni'), value: parsedResult?.params.sni },
    { label: t('app.vless.previewFp'), value: parsedResult?.params.fp },
    { label: t('app.vless.previewPath'), value: parsedResult?.params.path },
    { label: t('app.vless.previewHost'), value: parsedResult?.params.host },
    { label: t('app.vless.previewServiceName'), value: parsedResult?.params.serviceName },
  ].filter((f) => f.value !== undefined && f.value !== '');

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t('app.vless.importTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('app.vless.importHint')}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label={t('app.vless.importLabel')}
            placeholder={t('app.vless.importPlaceholder')}
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            error={!!error}
            helperText={
              error
                ? t('app.vless.parseFailed', { 1: error })
                : isValidating
                  ? t('app.vless.batchParsing')
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
                  bgcolor: 'success.50',
                }}
              >
                <CardContent sx={{ pb: '16px !important', '&:last-child': { pb: '16px !important' } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" color="success.dark" fontWeight={600}>
                      {t('app.vless.parsedDataTitle')}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleCopyParsed}
                      title={copied ? t('app.vless.copiedParsed') : t('app.vless.copyParsed')}
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
                {t('app.vless.validationError')}: {error}
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
          {isImporting ? t('app.posting') : t('app.vless.importConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
