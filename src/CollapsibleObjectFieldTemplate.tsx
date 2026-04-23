import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
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
import type { FormContextType, ObjectFieldTemplateProps, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import { buttonId, canExpand } from '@rjsf/utils';
import TlsSettingsWizardDialog from './TlsSettingsWizardDialog';
import { useI18n } from './i18n';

export default function CollapsibleObjectFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: ObjectFieldTemplateProps<T, S, F>) {
  const { locale, t } = useI18n();
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
  } = props;
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;
  const isRootObject = fieldPathId.path.length === 0;
  const isTlsSettingsObject = fieldPathId.path[fieldPathId.path.length - 1] === 'tlsSettings';
  const isStreamSettingsObject = fieldPathId.path[fieldPathId.path.length - 1] === 'streamSettings';
  const isHysteriaStreamSettings =
    isStreamSettingsObject && typeof formData === 'object' && formData !== null && !Array.isArray(formData) && 'network' in formData && (formData as Record<string, unknown>).network === 'hysteria';
  const hysteriaVisiblePropertyNames = new Set(['network', 'security', 'tlsSettings', 'hysteriaSettings']);
  const visibleProperties = properties.filter(
    (property) =>
      !property.hidden &&
      (!isHysteriaStreamSettings || hysteriaVisiblePropertyNames.has(property.name)),
  );
  const objectTitle = title || schema.title || (locale === 'zh-CN' ? '对象配置' : 'Object');
  const canAddProperty = canExpand<T, S, F>(schema, uiSchema, formData);

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
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        '&:before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography variant={isRootObject ? 'h6' : 'subtitle1'} sx={{ fontWeight: 700 }}>
              {objectTitle}
              {required ? ' *' : ''}
            </Typography>
          <Chip size="small" label={locale === 'zh-CN' ? `${visibleProperties.length} 个字段` : `${visibleProperties.length} fields`} />
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
