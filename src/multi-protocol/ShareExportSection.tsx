import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { useI18n } from '../i18n';
import { formatShareLink, outboundToShare } from '../utils/multi-protocol-share';

type ShareableOutbound = {
  protocol?: unknown;
  tag?: unknown;
};

interface ShareExportSectionProps {
  outbounds: ShareableOutbound[];
  onImportOpen: () => void;
  onPanelOpen: () => void;
  onBatchImportOpen: () => void;
}

function isShareableProtocol(protocol: unknown) {
  return (
    protocol === 'vless' ||
    protocol === 'vmess' ||
    protocol === 'trojan' ||
    protocol === 'shadowsocks' ||
    protocol === 'hysteria'
  );
}

export default function ShareExportSection({
  outbounds,
  onImportOpen,
  onPanelOpen,
  onBatchImportOpen,
}: ShareExportSectionProps) {
  const { t } = useI18n();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<number, string>>({});

  const handleCopyLink = async (outbound: ShareableOutbound, index: number) => {
    try {
      const parsed = outboundToShare(outbound);
      const link = formatShareLink(parsed);
      setLinks((prev) => ({ ...prev, [index]: link }));
      await navigator.clipboard.writeText(link);
      setCopiedIndex(index);
      setErrorIndex(null);
      setTimeout(() => {
        setCopiedIndex((prev) => (prev === index ? null : prev));
      }, 2000);
    } catch (err) {
      console.warn('Clipboard write failed', err);
      setErrorIndex(index);
      setCopiedIndex(null);
    }
  };

  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
          {t('app.share.exportSection')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={onImportOpen}>
            {t('app.share.importTitle')}
          </Button>
          <Button variant="outlined" size="small" onClick={onPanelOpen}>
            {t('app.share.panelTitle')}
          </Button>
          <Button variant="contained" size="small" onClick={onBatchImportOpen}>
            {t('app.share.batchTitle')}
          </Button>
        </Stack>
      </Stack>

      {outbounds.map((outbound, index) => {
        const isCopied = copiedIndex === index;
        const hasError = errorIndex === index;
        const tag =
          typeof outbound.tag === 'string' && outbound.tag ? outbound.tag : `Outbound ${index + 1}`;

        if (!isShareableProtocol(outbound.protocol)) {
          return (
            <Box key={index}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {t('app.share.outboundTag')}:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {tag}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  {t('app.vless.notShareable')}
                </Typography>
              </Stack>
              {index < outbounds.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          );
        }

        return (
          <Box key={index}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {t('app.share.outboundTag')}:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {tag}
                </Typography>
              </Stack>

              <Button
                variant="outlined"
                size="small"
                onClick={() => void handleCopyLink(outbound, index)}
                disabled={isCopied}
                sx={{ alignSelf: 'flex-start' }}
              >
                {isCopied ? t('app.share.copied') : t('app.share.copyLink')}
              </Button>

              {hasError && links[index] && (
                <TextField
                  fullWidth
                  size="small"
                  value={links[index]}
                  inputProps={{ readOnly: true }}
                  onClick={(event) => {
                    (event.target as HTMLInputElement).select();
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={t('app.share.clipboardManualCopy')}>
                          <ContentCopyRoundedIcon fontSize="small" />
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            </Stack>
            {index < outbounds.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        );
      })}
    </Stack>
  );
}
