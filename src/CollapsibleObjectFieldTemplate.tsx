import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type {
  FormContextType,
  ObjectFieldTemplateProps,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';
import { buttonId, canExpand } from '@rjsf/utils';
import RealitySettingsWizardDialog from './RealitySettingsWizardDialog';
import TlsSettingsWizardDialog from './TlsSettingsWizardDialog';
import { useState } from 'react';
import { useI18n } from './i18n';
import { useXrayFormUpdate, type UpdateSelectedFieldPath } from './XrayFormUpdateContext';
import { useAccordionCollapse } from './AccordionCollapseContext';

type CollapsibleObjectFieldTemplateExtraProps = {
  updateSelectedFieldPath?: UpdateSelectedFieldPath;
};

const networkSettingsPropertyByNetwork: Record<string, string> = {
  raw: 'rawSettings',
  tcp: 'rawSettings',
  ws: 'wsSettings',
  websocket: 'wsSettings',
  grpc: 'grpcSettings',
  xhttp: 'xhttpSettings',
  httpupgrade: 'httpupgradeSettings',
  kcp: 'kcpSettings',
  mkcp: 'kcpSettings',
  hysteria: 'hysteriaSettings',
};

const streamSettingsBasePropertyNames = new Set([
  'network',
  'security',
  'tlsSettings',
  'realitySettings',
  'sockopt',
]);
const streamNetworkSettingsPropertyNames = new Set(Object.values(networkSettingsPropertyByNetwork));

export default function CollapsibleObjectFieldTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RJSF convention requires any defaults
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RJSF convention requires any defaults
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
  const selectedNetwork =
    typeof objectFormData?.network === 'string' ? objectFormData.network : undefined;
  const selectedNetworkSettingsProperty = selectedNetwork
    ? networkSettingsPropertyByNetwork[selectedNetwork]
    : undefined;
  const isHysteriaStreamSettings = selectedNetwork === 'hysteria';
  const isTlsSecurity = objectFormData?.security === 'tls';
  const isRealitySecurity = objectFormData?.security === 'reality';
  const isVisibleForSelectedNetwork = (propertyName: string) => {
    if (!isStreamSettingsObject || !streamNetworkSettingsPropertyNames.has(propertyName)) {
      return true;
    }

    return propertyName === selectedNetworkSettingsProperty;
  };
  const visibleProperties = properties.filter(
    (property) =>
      !property.hidden &&
      (!isHysteriaStreamSettings ||
        streamSettingsBasePropertyNames.has(property.name) ||
        property.name === 'hysteriaSettings') &&
      isVisibleForSelectedNetwork(property.name) &&
      (property.name !== 'tlsSettings' || isTlsSecurity || isHysteriaStreamSettings) &&
      (property.name !== 'realitySettings' || isRealitySecurity),
  );
  const objectTitle = title || schema.title || (locale === 'zh-CN' ? '对象配置' : 'Object');
  const isRealitySettingsObject =
    fieldPathId.path[fieldPathId.path.length - 1] === 'realitySettings' ||
    objectTitle.toLowerCase().includes('reality') ||
    ('privateKey' in schemaProperties &&
      'publicKey' in schemaProperties &&
      'shortIds' in schemaProperties);
  const canAddProperty = canExpand<T, S, F>(schema, uiSchema, formData);
  const updateRealitySettings = updateSelectedFieldPath ?? contextUpdateSelectedFieldPath;
  const accordionId =
    fieldPathId.path.length > 0 ? `accordion-${fieldPathId.path.join('-')}` : 'accordion-root';
  const accordionDetailsId = `${accordionId}-details`;
  const { collapsedAll, setCollapsedAll } = useAccordionCollapse();
  const [expandedLocal, setExpandedLocal] = useState(isRootObject);
  const isExpanded = collapsedAll && !isRootObject ? false : expandedLocal;
  const nestingLevel = Math.max(fieldPathId.path.length - 1, 0);
  const isNestedObject = nestingLevel > 0;

  if (isTlsSettingsObject) {
    return (
      <Box sx={{ py: 0.25 }}>
        <TlsSettingsWizardDialog
          title={objectTitle}
          description={description}
          required={required}
          properties={properties}
        />
      </Box>
    );
  }

  if (isRealitySettingsObject) {
    return (
      <Box sx={{ py: 0.25 }}>
        <RealitySettingsWizardDialog
          title={objectTitle}
          description={description}
          disabled={disabled}
          fieldPath={[...fieldPathId.path]}
          formData={formData}
          properties={properties}
          readonly={readonly}
          required={required}
          updateSelectedFieldPath={updateRealitySettings}
        />
      </Box>
    );
  }

  return (
    <Accordion
      expanded={isExpanded}
      onChange={(_, nextExpanded) => {
        if (collapsedAll && nextExpanded) {
          setCollapsedAll(false);
        }
        setExpandedLocal(nextExpanded);
      }}
      disableGutters
      elevation={0}
      aria-label={objectTitle}
      sx={{
        position: 'relative',
        border: '1px solid',
        borderColor: isExpanded ? 'primary.100' : 'divider',
        borderRadius: 1.5,
        bgcolor: isExpanded && !isRootObject ? 'rgba(37, 99, 235, 0.018)' : 'background.paper',
        boxShadow: isExpanded && !isRootObject ? 'inset 2px 0 0 rgba(37, 99, 235, 0.32)' : 'none',
        overflow: 'hidden',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'box-shadow', 'background-color'], {
            duration: theme.transitions.duration.shortest,
          }),
        '& + &': {
          mt: 1,
        },
        '&:before': {
          display: 'none',
        },
        '& .MuiAccordionSummary-root': {
          minHeight: isNestedObject ? 48 : 54,
          px: isNestedObject ? 2 : 2.25,
          py: 0,
        },
        '& .MuiAccordionSummary-content': {
          my: 1,
          minWidth: 0,
        },
        '& .MuiAccordionSummary-expandIconWrapper': {
          color: 'text.secondary',
        },
      }}
    >
      <AccordionSummary
        component="div"
        expandIcon={<ExpandMoreRoundedIcon />}
        aria-controls={accordionDetailsId}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
          <Typography
            variant={isRootObject ? 'h6' : 'subtitle1'}
            sx={{
              fontWeight: 700,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {objectTitle}
            {required ? ' *' : ''}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={
              locale === 'zh-CN'
                ? `${visibleProperties.length} 个字段`
                : `${visibleProperties.length} fields`
            }
            sx={{
              height: 22,
              border: 0,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              fontSize: 12,
              flexShrink: 0,
              '& .MuiChip-label': { px: 0.85 },
            }}
          />
        </Stack>
      </AccordionSummary>

      <AccordionDetails
        id={accordionDetailsId}
        sx={{
          px: isNestedObject ? 2 : 2.25,
          pt: 0,
          pb: isNestedObject ? 1.5 : 2,
        }}
      >
        <Stack spacing={isNestedObject ? 1.25 : 1.75}>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}

          {optionalDataControl}

          {visibleProperties.map((property) => (
            <Box
              key={property.name}
              sx={{
                '& > .MuiFormControl-root': {
                  my: 0.25,
                },
              }}
            >
              {property.content}
            </Box>
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
            <Tooltip title={t('template.noEditableFields')}>
              <Button disabled variant="outlined">
                {t('template.noEditableFields')}
              </Button>
            </Tooltip>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
