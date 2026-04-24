import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import type { MouseEvent } from 'react';
import type { FormContextType, ObjectFieldTemplateProps, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import { buttonId, canExpand } from '@rjsf/utils';
import TlsSettingsWizardDialog from './TlsSettingsWizardDialog';
import { useI18n } from './i18n';
import { generateRealityKeyPair } from './realityKeys';
import { useXrayFormUpdate, type UpdateSelectedFieldPath } from './XrayFormUpdateContext';

type CollapsibleObjectFieldTemplateExtraProps = {
  updateSelectedFieldPath?: UpdateSelectedFieldPath;
};

export default function CollapsibleObjectFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: ObjectFieldTemplateProps<T, S, F> & CollapsibleObjectFieldTemplateExtraProps) {
  const { locale, t } = useI18n();
  const contextUpdateSelectedFieldPath = useXrayFormUpdate();
  const {
    description,
    disabled,
    fieldPathId,
    formData,
    onAddProperty,
    optionalDataControl,
    properties,
    readonly,
    registry,
    required,
    schema,
    title,
    uiSchema,
    updateSelectedFieldPath,
  } = props;
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;
  const isRootObject = fieldPathId.path.length === 0;
  const isTlsSettingsObject = fieldPathId.path[fieldPathId.path.length - 1] === 'tlsSettings';
  const schemaProperties = isRecord(schema.properties) ? schema.properties : {};
  const isStreamSettingsObject = fieldPathId.path[fieldPathId.path.length - 1] === 'streamSettings';
  const isObjectWithSettings =
    (isStreamSettingsObject || fieldPathId.path[fieldPathId.path.length - 1] === 'transport') &&
    typeof formData === 'object' &&
    formData !== null &&
    !Array.isArray(formData);
  const objectFormData = isObjectWithSettings ? (formData as Record<string, unknown>) : undefined;
  const isHysteriaStreamSettings = objectFormData?.network === 'hysteria';
  const isTlsSecurity = objectFormData?.security === 'tls';
  const isRealitySecurity = objectFormData?.security === 'reality';
  const hysteriaVisiblePropertyNames = new Set(['network', 'security', 'tlsSettings', 'hysteriaSettings']);
  const visibleProperties = properties.filter(
    (property) =>
      !property.hidden &&
      (!isHysteriaStreamSettings || hysteriaVisiblePropertyNames.has(property.name)) &&
      (property.name !== 'tlsSettings' || isTlsSecurity || isHysteriaStreamSettings) &&
      (property.name !== 'realitySettings' || isRealitySecurity),
  );
  const objectTitle = title || schema.title || (locale === 'zh-CN' ? '对象配置' : 'Object');
  const isRealitySettingsObject =
    fieldPathId.path[fieldPathId.path.length - 1] === 'realitySettings' ||
    objectTitle.toLowerCase().includes('reality') ||
    ('privateKey' in schemaProperties && 'publicKey' in schemaProperties && 'shortIds' in schemaProperties);
  const canAddProperty = canExpand<T, S, F>(schema, uiSchema, formData);
  const updateRealitySettings = updateSelectedFieldPath ?? contextUpdateSelectedFieldPath;
  const canGenerateRealityKeys = Boolean(isRealitySettingsObject && !disabled && !readonly && updateRealitySettings);
  const handleGenerateRealityKeys = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!updateRealitySettings) {
      return;
    }

    const keyPair = generateRealityKeyPair();
    const nextRealitySettings =
      typeof formData === 'object' && formData !== null && !Array.isArray(formData)
        ? { ...(formData as Record<string, unknown>), ...keyPair }
        : keyPair;

    updateRealitySettings([...fieldPathId.path], nextRealitySettings);
  };

  if (isTlsSettingsObject) {
    return (
      <Box sx={{ py: 1 }}>
        <TlsSettingsWizardDialog title={objectTitle} description={description} required={required} properties={properties} />
      </Box>
    );
  }

  return (
    <Accordion
      defaultExpanded={isRootObject}
      disableGutters
      elevation={0}
      sx={{
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        '&:before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary component="div" expandIcon={<ExpandMoreRoundedIcon />}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ width: '100%', minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography variant={isRootObject ? 'h6' : 'subtitle1'} sx={{ fontWeight: 700 }}>
              {objectTitle}
              {required ? ' *' : ''}
            </Typography>
            <Chip size="small" label={locale === 'zh-CN' ? `${visibleProperties.length} 个字段` : `${visibleProperties.length} fields`} />
          </Stack>

          {canGenerateRealityKeys ? (
            <Button size="small" variant="outlined" startIcon={<VpnKeyRoundedIcon />} onClick={handleGenerateRealityKeys}>
              {t('template.reality.generateKeys')}
            </Button>
          ) : null}
        </Stack>
      </AccordionSummary>

      <AccordionDetails>
        <Stack spacing={2}>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}

          {optionalDataControl}

          {visibleProperties.map((property) => (
            <Box key={property.name}>{property.content}</Box>
          ))}

          {canAddProperty ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <AddButton
                id={buttonId(fieldPathId, 'add')}
                className="rjsf-object-property-expand"
                onClick={onAddProperty}
                disabled={disabled || readonly}
                uiSchema={uiSchema}
                registry={registry}
              />
            </Box>
          ) : null}

          {visibleProperties.length === 0 && !canAddProperty ? (
            <Button disabled variant="outlined">
              {t('template.noEditableFields')}
            </Button>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
