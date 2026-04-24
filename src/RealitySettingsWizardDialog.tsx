import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import { useI18n } from './i18n';
import { generateRealityKeyPair } from './realityKeys';
import { useXrayFormUpdate, type UpdateSelectedFieldPath } from './XrayFormUpdateContext';

type TemplateProperty = {
  name: string;
  content: ReactNode;
  hidden?: boolean;
};

type RealityStep = {
  labelKey: string;
  fields: string[];
};

const REALITY_STEPS: RealityStep[] = [
  {
    labelKey: 'template.realityWizard.step.keys',
    fields: ['privateKey', 'publicKey', 'shortIds'],
  },
  {
    labelKey: 'template.realityWizard.step.server',
    fields: ['serverName', 'fingerprint', 'spiderX', 'target'],
  },
  {
    labelKey: 'template.realityWizard.step.client',
    fields: ['minClientVer', 'maxClientVer', 'maxTimeDiff'],
  },
  {
    labelKey: 'template.realityWizard.step.advanced',
    fields: ['show', 'mldsa65Seed', 'limitFallbackUpload', 'limitFallbackDownload'],
  },
];

interface RealitySettingsWizardDialogProps {
  title: string;
  description?: ReactNode;
  disabled?: boolean;
  fieldPath: Array<string | number>;
  formData: unknown;
  properties: TemplateProperty[];
  readonly?: boolean;
  required?: boolean;
  updateSelectedFieldPath?: UpdateSelectedFieldPath;
}

export default function RealitySettingsWizardDialog({
  title,
  description,
  disabled,
  fieldPath,
  formData,
  properties,
  readonly,
  required,
  updateSelectedFieldPath,
}: RealitySettingsWizardDialogProps) {
  const { t } = useI18n();
  const contextUpdateSelectedFieldPath = useXrayFormUpdate();
  const updateRealitySettings = updateSelectedFieldPath ?? contextUpdateSelectedFieldPath;
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (open) {
      setActiveStep(0);
    }
  }, [open]);

  const visibleProperties = useMemo(() => properties.filter((property) => !property.hidden), [properties]);
  const currentStep = REALITY_STEPS[activeStep] ?? REALITY_STEPS[0];
  const currentStepProperties = useMemo(
    () =>
      currentStep.fields
        .map((fieldName) => visibleProperties.find((property) => property.name === fieldName))
        .filter((property): property is TemplateProperty => Boolean(property)),
    [currentStep.fields, visibleProperties],
  );
  const canGenerateKeys = Boolean(!disabled && !readonly && updateRealitySettings);

  const handleGenerateKeys = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!updateRealitySettings) {
      return;
    }

    const keyPair = generateRealityKeyPair();
    const nextRealitySettings =
      typeof formData === 'object' && formData !== null && !Array.isArray(formData)
        ? { ...(formData as Record<string, unknown>), ...keyPair }
        : keyPair;

    updateRealitySettings([...fieldPath], nextRealitySettings);
  };

  return (
    <>
      <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => setOpen(true)}>
        {t('template.realityWizard.configure')}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {title || 'realitySettings'}
          {required ? ' *' : ''}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap">
              <Chip label={`${visibleProperties.length} ${t('template.realityWizard.fields')}`} size="small" />
              <Chip label={`${activeStep + 1} / ${REALITY_STEPS.length} ${t('template.realityWizard.steps')}`} size="small" variant="outlined" />
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="outlined"
                startIcon={<VpnKeyRoundedIcon />}
                onClick={handleGenerateKeys}
                disabled={!canGenerateKeys}
              >
                {t('template.reality.generateKeys')}
              </Button>
            </Stack>

            <Stepper activeStep={activeStep} alternativeLabel>
              {REALITY_STEPS.map((step) => (
                <Step key={step.labelKey}>
                  <StepLabel>{t(step.labelKey)}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {t(currentStep.labelKey)}
              </Typography>
              <Stack spacing={2}>
                {currentStepProperties.map((property) => (
                  <Box key={property.name}>{property.content}</Box>
                ))}
              </Stack>
              {currentStepProperties.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('template.realityWizard.noFields')}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('template.realityWizard.close')}</Button>
          <Button onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>
            {t('template.realityWizard.previous')}
          </Button>
          {activeStep < REALITY_STEPS.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep((step) => Math.min(REALITY_STEPS.length - 1, step + 1))}>
              {t('template.realityWizard.next')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setOpen(false)}>
              {t('template.realityWizard.finish')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
