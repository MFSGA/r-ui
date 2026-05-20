import { useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { outboundToVlessShare, formatVlessShareLink } from '../utils/vless-share';
import { useI18n } from '../i18n';
import type { XrayConfig } from '../schema';

interface ShareLinkPanelProps {
  config: XrayConfig;
  open: boolean;
  onClose: () => void;
  onCopyLink: (link: string) => void;
  onDeleteOutbound: (index: number) => void;
}

interface VlessRow {
  originalIndex: number;
  tag: string;
  protocol: string;
  address: string;
  port: number;
  network: string;
  security: string;
  shareLink: string;
}

function extractNetwork(streamSettings?: Record<string, unknown>): string {
  if (!streamSettings) return 'tcp';
  const network = streamSettings.network as string | undefined;
  if (network === 'raw') return 'tcp';
  return network ?? 'tcp';
}

function extractSecurity(streamSettings?: Record<string, unknown>): string {
  if (!streamSettings) return 'none';
  return (streamSettings.security as string) ?? 'none';
}

export default function ShareLinkPanel({
  config,
  open,
  onClose,
  onCopyLink,
  onDeleteOutbound,
}: ShareLinkPanelProps) {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const vlessRows: VlessRow[] = useMemo(() => {
    if (!Array.isArray(config.outbounds)) return [];

    return config.outbounds
      .map((outbound, index) => {
        if (outbound?.protocol !== 'vless') return null;

        try {
          const share = outboundToVlessShare(outbound);
          const shareLink = formatVlessShareLink(share);
          const streamSettings = outbound.streamSettings as Record<string, unknown> | undefined;

          return {
            originalIndex: index,
            tag: outbound.tag ?? `Outbound ${index + 1}`,
            protocol: 'VLESS',
            address: share.address,
            port: share.port,
            network: extractNetwork(streamSettings),
            security: extractSecurity(streamSettings),
            shareLink,
          };
        } catch {
          return null;
        }
      })
      .filter((row): row is VlessRow => row !== null);
  }, [config.outbounds]);

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return vlessRows;
    const query = searchText.toLowerCase();
    return vlessRows.filter(
      (row) =>
        row.tag.toLowerCase().includes(query) ||
        row.address.toLowerCase().includes(query),
    );
  }, [vlessRows, searchText]);

  const handleCopyAll = async () => {
    const allLinks = vlessRows.map((row) => row.shareLink).join('\n');
    if (allLinks) {
      try {
        await navigator.clipboard.writeText(allLinks);
      } catch {
        // Clipboard write failed - silently ignore or could show toast
      }
    }
  };

  const handleCopyRow = async (link: string, index: number) => {
    await onCopyLink(link);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex((prev) => (prev === index ? null : prev));
    }, 2000);
  };

  const handleDeleteClick = (rowIndex: number) => {
    setDeleteConfirmIndex(rowIndex);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmIndex !== null) {
      onDeleteOutbound(deleteConfirmIndex);
      setDeleteConfirmIndex(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmIndex(null);
  };

  const handleClose = () => {
    setDeleteConfirmIndex(null);
    setSearchText('');
    onClose();
  };

  const pendingDeleteRow = deleteConfirmIndex !== null
    ? filteredRows.find((row) => row.originalIndex === deleteConfirmIndex)
    : null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{t('app.vless.panelTitle')}</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Toolbar */}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              placeholder={t('app.vless.panelSearch')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleCopyAll}
              disabled={vlessRows.length === 0}
            >
              {t('app.vless.panelCopyAll')}
            </Button>
          </Stack>

          {/* Delete confirmation */}
          {pendingDeleteRow && (
            <Alert severity="warning" action={
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={handleDeleteCancel}>
                  {t('app.cancel')}
                </Button>
                <Button size="small" color="error" variant="contained" onClick={handleDeleteConfirm}>
                  {t('app.vless.panelDelete')}
                </Button>
              </Stack>
            }>
              {t('app.vless.panelDeleteConfirm', { tag: pendingDeleteRow.tag })}
            </Alert>
          )}

          {/* Table or empty state */}
          {filteredRows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {searchText ? t('app.vless.noResults') : t('app.vless.panelEmpty')}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('app.vless.panelTag')}</TableCell>
                    <TableCell>{t('app.vless.panelProtocol')}</TableCell>
                    <TableCell>{t('app.vless.panelAddress')}</TableCell>
                    <TableCell align="right">{t('app.vless.panelPort')}</TableCell>
                    <TableCell>{t('app.vless.panelNetwork')}</TableCell>
                    <TableCell>{t('app.vless.panelSecurity')}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>{t('app.vless.panelLink')}</TableCell>
                    <TableCell align="right">{t('app.vless.panelActions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((row) => {
                    const isCopied = copiedIndex === row.originalIndex;
                    return (
                      <TableRow key={row.originalIndex} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: 120 }}>
                            {row.tag}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.protocol}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                            {row.address}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{row.port}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" textTransform="uppercase">{row.network}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" textTransform="uppercase">{row.security}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ maxWidth: 180, fontFamily: 'monospace', fontSize: 12 }}
                            >
                              {row.shareLink}
                            </Typography>
                            <Tooltip title={isCopied ? t('app.vless.copied') : t('app.vless.copyLink')}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopyRow(row.shareLink, row.originalIndex)}
                                disabled={isCopied}
                              >
                                <ContentCopyRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title={t('app.vless.panelDelete')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(row.originalIndex)}
                              >
                                <DeleteRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleClose}>
          {t('app.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
