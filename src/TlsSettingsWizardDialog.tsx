import { useEffect, useMemo, useState } from 'react';
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
import type { ReactNode } from 'react';
import { useI18n } from './i18n';

type TemplateProperty = {
  name: string;
  content: ReactNode;
  hidden?: boolean;
};

type TlsStep = {
  labelKey: string;
  fields: string[];
};

const TLS_STEPS: TlsStep[] = [
  {
    labelKey: 'template.tlsWizard.step.basic',
    fields: ['serverName', 'verifyPeerCertByName', 'rejectUnknownSni'],
  },
  {
    labelKey: 'template.tlsWizard.step.behavior',
    fields: ['allowInsecure', 'disableSystemRoot', 'enableSessionResumption'],
  },
  {
    labelKey: 'template.tlsWizard.step.version',
    fields: ['alpn', 'minVersion', 'maxVersion', 'cipherSuites', 'curvePreferences'],
  },
  {
    labelKey: 'template.tlsWizard.step.certificates',
    fields: ['certificates', 'fingerprint', 'pinnedPeerCertSha256'],
  },
  {
    labelKey: 'template.tlsWizard.step.ech',
    fields: ['masterKeyLog', 'echServerKeys', 'echConfigList', 'echForceQuery', 'echSockopt'],
  },
];

interface TlsSettingsWizardDialogProps {
  title: string;
  description?: ReactNode;
  required?: boolean;
  properties: TemplateProperty[];
}

export default function TlsSettingsWizardDialog({
  title,
  description,
  properties,
  required,
}: TlsSettingsWizardDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (open) {
      setActiveStep(0);
    }
  }, [open]);

  const visibleProperties = useMemo(() => properties.filter((property) => !property.hidden), [properties]);
  const currentStep = TLS_STEPS[activeStep] ?? TLS_STEPS[0];
  const currentStepProperties = useMemo(
    () =>
      currentStep.fields
        .map((fieldName) => visibleProperties.find((property) => property.name === fieldName))
        .filter((property): property is TemplateProperty => Boolean(property)),
    [currentStep.fields, visibleProperties],
  );

  return (
    <>
      <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => setOpen(true)}>
        {t('template.tlsWizard.configure')}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {title || 'tlsSettings'}
          {required ? ' *' : ''}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip label={`${visibleProperties.length} 个字段`} size="small" />
              <Chip label={`${activeStep + 1} / ${TLS_STEPS.length} 步`} size="small" variant="outlined" />
            </Stack>

            <Stepper activeStep={activeStep} alternativeLabel>
              {TLS_STEPS.map((step) => (
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
                  {t('template.tlsWizard.noFields')}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('template.tlsWizard.close')}</Button>
          <Button onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>
            {t('template.tlsWizard.previous')}
          </Button>
          {activeStep < TLS_STEPS.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep((step) => Math.min(TLS_STEPS.length - 1, step + 1))}>
              {t('template.tlsWizard.next')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setOpen(false)}>
              {t('template.tlsWizard.finish')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
