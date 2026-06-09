import { useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { outboundToShare, formatShareLink } from '../utils/multi-protocol-share';
import { useI18n } from '../i18n';
import type { XrayConfig } from '../schema';

interface MultiShareLinkPanelProps {
  config: XrayConfig;
  open: boolean;
  onClose: () => void;
  onCopyLink: (link: string) => void;
  onDeleteOutbound: (index: number) => void;
}

interface ShareRow {
  originalIndex: number;
  tag: string;
  protocol: string; // "VMess" | "Trojan" | "SS"
  address: string;
  port: number;
  network: string;
  security: string;
  shareLink: string;
  method: string | undefined; // shadowsocks method
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

function protocolColor(protocol: string): 'primary' | 'warning' | 'success' | 'info' | 'secondary' {
  switch (protocol) {
    case 'VMess':
      return 'primary';
    case 'Trojan':
      return 'warning';
    case 'SS':
      return 'success';
    case 'Hy2':
      return 'info';
    case 'VLESS':
      return 'secondary';
    default:
      return 'primary';
  }
}

export default function MultiShareLinkPanel({
  config,
  open,
  onClose,
  onCopyLink,
  onDeleteOutbound,
}: MultiShareLinkPanelProps) {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<'all' | 'VMess' | 'Trojan' | 'SS' | 'Hy2' | 'VLESS'>('all');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const rows: ShareRow[] = useMemo(() => {
    if (!Array.isArray(config.outbounds)) return [];

    return config.outbounds
      .map((outbound, index) => {
        const protocol = outbound?.protocol;
        if (protocol !== 'vmess' && protocol !== 'trojan' && protocol !== 'shadowsocks' && protocol !== 'hysteria' && protocol !== 'vless') return null;

        try {
          const parsed = outboundToShare(outbound as Record<string, unknown>);
          const shareLink = formatShareLink(parsed);
          const streamSettings = outbound.streamSettings as Record<string, unknown> | undefined;

          return {
            originalIndex: index,
            tag: (outbound.tag as string) ?? `Outbound ${index + 1}`,
            protocol: protocol === 'vless' ? 'VLESS' : protocol === 'vmess' ? 'VMess' : protocol === 'trojan' ? 'Trojan' : protocol === 'shadowsocks' ? 'SS' : 'Hy2',
            address: parsed.data.address,
            port: parsed.data.port,
            network: extractNetwork(streamSettings),
            security: extractSecurity(streamSettings),
            shareLink,
            method: parsed.protocol === 'shadowsocks' ? parsed.data.method : undefined,
          };
        } catch {
          return null;
        }
      })
      .filter((row): row is ShareRow => row !== null);
  }, [config.outbounds]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (protocolFilter !== 'all') {
      result = result.filter((row) => row.protocol === protocolFilter);
    }
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      result = result.filter(
        (row) =>
          row.tag.toLowerCase().includes(query) ||
          row.address.toLowerCase().includes(query),
      );
    }
    return result;
  }, [rows, searchText, protocolFilter]);

  const handleCopyAll = async () => {
    const allLinks = rows.map((row) => row.shareLink).join('\n');
    if (allLinks) {
      try {
        await navigator.clipboard.writeText(allLinks);
      } catch (err) {
        console.warn('Copy all links failed:', err);
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
          <Typography variant="h6">{t('app.share.panelTitle')}</Typography>
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
              placeholder={t('app.share.panelSearch')}
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
              disabled={rows.length === 0}
            >
              {t('app.share.panelCopyAll')}
            </Button>
          </Stack>

          {/* Protocol filter chips */}
          <Stack direction="row" spacing={1}>
            {(['all', 'VLESS', 'VMess', 'Trojan', 'SS', 'Hy2'] as const).map((p) => (
              <Chip
                key={p}
                label={p === 'all' ? 'All' : p}
                color={protocolFilter === p ? 'primary' : 'default'}
                variant={protocolFilter === p ? 'filled' : 'outlined'}
                size="small"
                onClick={() => setProtocolFilter(p)}
              />
            ))}
          </Stack>

          {/* Delete confirmation */}
          {pendingDeleteRow && (
            <Alert severity="warning" action={
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={handleDeleteCancel}>
                  {t('app.cancel')}
                </Button>
                <Button size="small" color="error" variant="contained" onClick={handleDeleteConfirm}>
                  {t('app.share.panelDelete')}
                </Button>
              </Stack>
            }>
              {t('app.share.panelDeleteConfirm', { tag: pendingDeleteRow.tag })}
            </Alert>
          )}

          {/* Table or empty state */}
          {filteredRows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {searchText ? t('app.share.noResults') : t('app.share.panelEmpty')}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('app.share.panelTag')}</TableCell>
                    <TableCell>{t('app.share.panelProtocol')}</TableCell>
                    <TableCell>{t('app.share.panelAddress')}</TableCell>
                    <TableCell align="right">{t('app.share.panelPort')}</TableCell>
                    <TableCell>{t('app.share.panelNetwork')}</TableCell>
                    <TableCell>{t('app.share.panelSecurity')}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>{t('app.share.panelLink')}</TableCell>
                    <TableCell align="right">{t('app.share.panelActions')}</TableCell>
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
                          <Chip
                            label={row.protocol}
                            size="small"
                            color={protocolColor(row.protocol)}
                            variant="outlined"
                          />
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
                            <Tooltip title={isCopied ? t('app.share.copied') : t('app.share.copyLink')}>
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
                            <Tooltip title={t('app.share.panelDelete')}>
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
