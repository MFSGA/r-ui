import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { ConfigFormat } from './configFormat';
import { getConfigMimeType, serializeConfigText } from './configFormat';
import { useI18n } from './i18n';
import type { XrayConfig } from './schema';

interface PostConfigDialogProps {
  config: XrayConfig;
  format: ConfigFormat;
  onError: (message: string | null) => void;
  onClose: () => void;
  open: boolean;
}

export default function PostConfigDialog({ config, format, onClose, onError, open }: PostConfigDialogProps) {
  const { t } = useI18n();
  const [postUrl, setPostUrl] = useState('');
  const [isPostingConfig, setIsPostingConfig] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);

  const handleClose = () => {
    if (!isPostingConfig) {
      onClose();
    }
  };

  const handleSubmit = async () => {
    const normalizedUrl = postUrl.trim();

    if (!normalizedUrl) {
      onError(t('app.postUrlInvalid'));
      setPostResult(null);
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(normalizedUrl, window.location.href);
    } catch {
      onError(t('app.postUrlInvalid'));
      setPostResult(null);
      return;
    }

    setIsPostingConfig(true);
    onError(null);
    setPostResult(null);

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': getConfigMimeType(format),
        },
        body: serializeConfigText(config, format),
      });

      if (!response.ok) {
        onError(t('app.postUrlFailed', { status: response.status, url: parsedUrl.toString() }));
        return;
      }

      setPostResult(t('app.postUrlSucceeded', { status: response.status }));
    } catch {
      onError(t('app.postUrlRequestFailed'));
    } finally {
      setIsPostingConfig(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('app.postUrlTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('app.postUrlHint', { format: format.toUpperCase() })}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label={t('app.postUrlLabel')}
            placeholder={t('app.postUrlPlaceholder')}
            value={postUrl}
            onChange={(event) => setPostUrl(event.target.value)}
          />
          {postResult ? <Alert severity="success">{postResult}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPostingConfig}>
          {t('app.cancel')}
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isPostingConfig}>
          {isPostingConfig ? t('app.posting') : t('app.postUrlSubmit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
