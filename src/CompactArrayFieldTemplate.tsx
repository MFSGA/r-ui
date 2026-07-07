import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type {
  ArrayFieldItemTemplateProps,
  ArrayFieldTemplateProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';
import { useI18n } from './i18n';

export function CompactArrayFieldTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RJSF convention requires any defaults
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RJSF convention requires any defaults
  F extends FormContextType = any,
>(props: ArrayFieldTemplateProps<T, S, F>) {
  const { locale, t } = useI18n();
  const {
    canAdd,
    disabled,
    items,
    onAddClick,
    optionalDataControl,
    readonly,
    required,
    schema,
    title,
    uiSchema,
  } = props;
  const label = uiSchema?.['ui:title'] ?? title;
  const description = uiSchema?.['ui:description'] ?? schema.description;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: items.length > 0 ? '1px solid' : 0,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {label}
              {required ? ' *' : ''}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={locale === 'zh-CN' ? `${items.length} 项` : `${items.length} items`}
              sx={{
                height: 22,
                border: 0,
                bgcolor: 'action.hover',
                color: 'text.secondary',
                fontSize: 12,
                '& .MuiChip-label': { px: 0.85 },
              }}
            />
          </Stack>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          ) : null}
        </Box>

        {optionalDataControl}

        {canAdd ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={onAddClick}
            disabled={disabled || readonly}
            sx={{ borderRadius: 1.5, flexShrink: 0, fontWeight: 700 }}
          >
            {t('template.array.addItem')}
          </Button>
        ) : null}
      </Stack>

      <Stack spacing={1.25} sx={{ p: items.length > 0 ? 2 : 0 }}>
        {items.length > 0 ? (
          items
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            {t('template.array.empty')}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export function CompactArrayFieldItemTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RJSF convention requires any defaults
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RJSF convention requires any defaults
  F extends FormContextType = any,
>(props: ArrayFieldItemTemplateProps<T, S, F>) {
  const { t } = useI18n();
  const { buttonsProps, children, hasToolbar, index } = props;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.default',
        p: 1.25,
      }}
    >
      <Box
        sx={{
          '& > .MuiAccordion-root': {
            bgcolor: 'background.paper',
          },
        }}
      >
        {children}
      </Box>

      {hasToolbar ? (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 1 }}>
          <Tooltip title={t('template.array.moveUp')}>
            <span>
              <IconButton
                size="small"
                onClick={buttonsProps.onMoveUpItem}
                disabled={!buttonsProps.hasMoveUp || buttonsProps.disabled || buttonsProps.readonly}
                aria-label={t('template.array.moveUp')}
              >
                <ArrowUpwardRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('template.array.moveDown')}>
            <span>
              <IconButton
                size="small"
                onClick={buttonsProps.onMoveDownItem}
                disabled={
                  !buttonsProps.hasMoveDown || buttonsProps.disabled || buttonsProps.readonly
                }
                aria-label={t('template.array.moveDown')}
              >
                <ArrowDownwardRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('template.array.remove')}>
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={buttonsProps.onRemoveItem}
                disabled={!buttonsProps.hasRemove || buttonsProps.disabled || buttonsProps.readonly}
                aria-label={`${t('template.array.remove')} ${index + 1}`}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ) : null}
    </Box>
  );
}
