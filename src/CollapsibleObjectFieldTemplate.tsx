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

export default function CollapsibleObjectFieldTemplate<
  T = unknown,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = unknown,
>(props: ObjectFieldTemplateProps<T, S, F>) {
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
  const visibleProperties = properties.filter((property) => !property.hidden);
  const hiddenProperties = properties.filter((property) => property.hidden);
  const objectTitle = title || schema.title || '对象配置';
  const canAddProperty = canExpand<T, S, F>(schema, uiSchema, formData);

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
          <Chip size="small" label={`${visibleProperties.length} 个字段`} />
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

          {hiddenProperties.map((property) => (
            <Box key={property.name} sx={{ display: 'none' }}>
              {property.content}
            </Box>
          ))}

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
              当前对象暂无可编辑字段
            </Button>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
