import { useEffect, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { toDataURL } from 'qrcode';
import { useI18n } from '../i18n';

interface QrCodeDialogProps {
  open: boolean;
  onClose: () => void;
  link: string;
  tag: string;
}

export default function QrCodeDialog({ open, onClose, link, tag }: QrCodeDialogProps) {
  const { t } = useI18n();
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !link) return;

    setError(null);
    toDataURL(link, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => {
        console.error('QR generation failed:', err);
        setError('Failed to generate QR code');
      });
  }, [open, link]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{t('app.share.qrCodeTitle')}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {tag}
          </Typography>

          {error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : dataUrl ? (
            <Box
              component="img"
              src={dataUrl}
              alt={`QR Code for ${tag}`}
              sx={{
                width: 280,
                height: 280,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Generating...
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary" textAlign="center">
            {t('app.share.qrCodeHint')}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
