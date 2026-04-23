import { useEffect, useMemo } from 'react';
import { MenuItem, TextField } from '@mui/material';
import type { WidgetProps } from '@rjsf/utils';
import { useI18n } from './i18n';

type FormContext = {
  currentData?: unknown;
};

export default function HysteriaAwareSecurityWidget(props: WidgetProps) {
  const { t } = useI18n();
  const { id, label, options, onChange, required, readonly, disabled, rawErrors, value, formContext } = props;
  const enumOptions = Array.isArray(options.enumOptions) ? options.enumOptions : [];
  const rootData = (formContext as FormContext | undefined)?.currentData;
  const errorCount = rawErrors?.length ?? 0;
  const isHysteriaNetwork = useMemo(() => {
    const pathParts = String(id).replace(/^root_/, '').split('_').filter(Boolean);
    const parentPath = pathParts.slice(0, -1);
    const parentValue = resolvePath(rootData, parentPath);

    return isRecord(parentValue) && parentValue.network === 'hysteria';
  }, [id, rootData]);

  useEffect(() => {
    if (isHysteriaNetwork && value !== 'tls') {
      onChange('tls');
    }
  }, [isHysteriaNetwork, onChange, value]);

  const displayedOptions = isHysteriaNetwork ? [{ label: 'tls', value: 'tls' }] : enumOptions;
  const displayedValue = isHysteriaNetwork ? 'tls' : value ?? '';
  const helperText = isHysteriaNetwork
    ? t('template.hysteriaSecurityHelper')
    : rawErrors?.[0] ?? (required ? ' ' : '');

  return (
    <TextField
      select
      fullWidth
      id={id}
      label={label}
      value={displayedValue}
      onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      required={required}
      disabled={disabled || readonly || isHysteriaNetwork}
      error={errorCount > 0}
      helperText={helperText}
      margin="normal"
    >
      {!required && !isHysteriaNetwork ? (
        <MenuItem value="">
          <em>{t('template.selectPlaceholder')}</em>
        </MenuItem>
      ) : null}
      {displayedOptions.map((option) => (
        <MenuItem key={String(option.value)} value={option.value as string}>
          {String(option.label)}
        </MenuItem>
      ))}
    </TextField>
  );
}

function resolvePath(root: unknown, pathParts: string[]) {
  return pathParts.reduce<unknown>((current, part) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[part];
  }, root);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
