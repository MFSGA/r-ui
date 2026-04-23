import type { ChangeEvent, FocusEvent, MouseEvent } from 'react';
import { useCallback } from 'react';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { SchemaExamples } from '@rjsf/core';
import type { BaseInputTemplateProps, FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import { ariaDescribedByIds, examplesId, getInputProps, labelValue } from '@rjsf/utils';

const TYPES_THAT_SHRINK_LABEL = ['date', 'datetime-local', 'file', 'time'];

export default function PlaceholderBaseInputTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: BaseInputTemplateProps<T, S, F>) {
  const {
    id,
    htmlName,
    placeholder,
    required,
    readonly,
    disabled,
    type,
    label,
    hideLabel,
    value,
    onChange,
    onChangeOverride,
    onBlur,
    onFocus,
    autofocus,
    options,
    schema,
    rawErrors = [],
    registry,
    InputLabelProps,
    InputProps,
    slotProps,
    ...textFieldProps
  } = props;
  const { ClearButton } = registry.templates.ButtonTemplates;
  const { step, min, max, accept, ...rest } = getInputProps<T, S, F>(schema, type, options);
  const htmlInputProps = {
    ...slotProps?.htmlInput,
    step,
    min,
    max,
    accept,
    ...(schema.examples ? { list: examplesId(id) } : undefined),
  };
  const isEmpty = value === undefined || value === null || value === '';
  const canApplyPlaceholder = Boolean(placeholder && isEmpty && !readonly && !disabled);
  const _onChange = ({ target: { value } }: ChangeEvent<HTMLInputElement>) =>
    onChange(value === '' ? options.emptyValue : value);
  const _onBlur = ({ target }: FocusEvent<HTMLInputElement>) => onBlur(id, target && target.value);
  const _onFocus = ({ target }: FocusEvent<HTMLInputElement>) => onFocus(id, target && target.value);
  const displayInputLabelProps = TYPES_THAT_SHRINK_LABEL.includes(type)
    ? { ...slotProps?.inputLabel, ...InputLabelProps, shrink: true }
    : { ...slotProps?.inputLabel, ...InputLabelProps };
  const _onClear = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onChange(options.emptyValue ?? '');
    },
    [onChange, options.emptyValue],
  );
  const _onApplyPlaceholder = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onChange(placeholder);
    },
    [onChange, placeholder],
  );
  const inputProps = { ...InputProps, ...slotProps?.input };
  const endAdornments = [];

  if (canApplyPlaceholder) {
    endAdornments.push(
      <InputAdornment key="placeholder" position="end">
        <Tooltip title="应用占位值">
          <IconButton aria-label="应用占位值" edge="end" size="small" onClick={_onApplyPlaceholder}>
            <AutoFixHighRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </InputAdornment>,
    );
  }

  if (options.allowClearTextInputs && value && !readonly && !disabled) {
    endAdornments.push(
      <InputAdornment key="clear" position="end">
        <ClearButton registry={registry} onClick={_onClear} />
      </InputAdornment>,
    );
  }

  if (inputProps.endAdornment) {
    endAdornments.unshift(inputProps.endAdornment);
  }

  if (endAdornments.length > 0) {
    inputProps.endAdornment = <>{endAdornments}</>;
  }

  return (
    <>
      <TextField
        id={id}
        name={htmlName || id}
        placeholder={placeholder}
        label={labelValue(label || undefined, hideLabel, undefined)}
        autoFocus={autofocus}
        required={required}
        disabled={disabled || readonly}
        slotProps={{
          ...slotProps,
          input: inputProps,
          htmlInput: htmlInputProps,
          inputLabel: displayInputLabelProps,
        }}
        {...rest}
        value={value || value === 0 ? value : ''}
        error={rawErrors.length > 0}
        onChange={onChangeOverride || _onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}
        {...(textFieldProps as TextFieldProps)}
        aria-describedby={ariaDescribedByIds(id, !!schema.examples)}
      />
      <SchemaExamples id={id} schema={schema} />
    </>
  );
}
