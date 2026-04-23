import { useMemo, useState } from 'react';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import type { IChangeEvent } from '@rjsf/core';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CollapsibleObjectFieldTemplate from './CollapsibleObjectFieldTemplate';
import type { XrayConfig } from './schema';
import {
  defaultConfig,
  getTopLevelFieldSchema,
  getTopLevelFieldUiSchema,
  orderXrayConfig,
  topLevelFieldOptions,
  topLevelFields,
} from './schema';

function createDefaultConfig() {
  return orderXrayConfig(structuredClone(defaultConfig));
}

const initialSelectedField = topLevelFields.includes('log') ? 'log' : topLevelFields[0];

function downloadJsonFile(config: XrayConfig) {
  const content = JSON.stringify(orderXrayConfig(config), null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'xray-config.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [config, setConfig] = useState<XrayConfig>(() => createDefaultConfig());
  const [selectedField, setSelectedField] = useState(initialSelectedField);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFullJsonOpen, setIsFullJsonOpen] = useState(false);

  const orderedConfig = useMemo(() => orderXrayConfig(config), [config]);
  const fullJsonPreview = useMemo(() => JSON.stringify(orderedConfig, null, 2), [orderedConfig]);
  const selectedSchema = useMemo(() => getTopLevelFieldSchema(selectedField), [selectedField]);
  const selectedUiSchema = useMemo(() => getTopLevelFieldUiSchema(selectedField), [selectedField]);
  const selectedFieldValue = config[selectedField];
  const templates = useMemo(
    () => ({
      ObjectFieldTemplate: CollapsibleObjectFieldTemplate,
    }),
    [],
  );
  const selectedModulePreview = useMemo(() => {
    const moduleConfig =
      selectedFieldValue === undefined
        ? {}
        : {
            [selectedField]: selectedFieldValue,
          };

    return JSON.stringify(moduleConfig, null, 2);
  }, [selectedField, selectedFieldValue]);

  const handleChange = (event: IChangeEvent<unknown>) => {
    setConfig((currentConfig) =>
      orderXrayConfig({
        ...currentConfig,
        [selectedField]: event.formData,
      }),
    );
    setIsSubmitted(false);
  };

  const handleSubmit = ({ formData }: IChangeEvent<unknown>) => {
    const nextConfig = orderXrayConfig({
      ...config,
      [selectedField]: formData,
    });

    setConfig(nextConfig);
    setIsSubmitted(true);
    console.log(`提交得到的 Xray ${selectedField} 配置：`, formData);
    console.log('当前完整 Xray JSON 配置：', nextConfig);
  };

  const handleReset = () => {
    setConfig((currentConfig) =>
      orderXrayConfig({
        ...currentConfig,
        [selectedField]: createDefaultConfig()[selectedField],
      }),
    );
    setIsSubmitted(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, rgba(124,58,237,0.04) 100%)',
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 3, md: 4 } }} elevation={0}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Chip label="React + TypeScript + MUI + rjsf" color="primary" variant="outlined" />
                <Chip label="Xray JSON Schema 驱动" color="secondary" variant="outlined" />
              </Stack>

              <Box>
                <Typography variant="h4" gutterBottom>
                  Xray 配置生成器
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  左侧表单由 xray-online-based.schema.json 自动生成。填写完成后，可以在右侧实时得到对应的 Xray JSON 配置。
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
            <Paper sx={{ p: 3, flex: 1.2 }} elevation={0}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    配置表单
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    先选择第一级配置模块，再只编辑该模块对应的值；右侧会同步展示完整 Xray JSON。
                  </Typography>
                </Box>

                <FormControl fullWidth>
                  <InputLabel id="top-level-field-label">第一级配置模块</InputLabel>
                  <Select
                    labelId="top-level-field-label"
                    label="第一级配置模块"
                    value={selectedField}
                    onChange={(event) => {
                      setSelectedField(event.target.value);
                      setIsSubmitted(false);
                    }}
                  >
                    {topLevelFieldOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider />

                <Form
                  key={selectedField}
                  schema={selectedSchema}
                  uiSchema={selectedUiSchema}
                  validator={validator}
                  formData={selectedFieldValue}
                  liveValidate
                  noHtml5Validate
                  showErrorList={false}
                  templates={templates}
                  onChange={handleChange}
                  onSubmit={handleSubmit}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                    <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />}>
                      保存当前模块
                    </Button>
                    <Button variant="outlined" onClick={handleReset} startIcon={<ReplayRoundedIcon />}>
                      重置当前模块
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => downloadJsonFile(config)}
                      startIcon={<DownloadRoundedIcon />}
                    >
                      导出完整 JSON
                    </Button>
                  </Stack>
                </Form>
              </Stack>
            </Paper>

            <Paper sx={{ p: 3, flex: 1, minWidth: 0 }} elevation={0}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    当前模块 JSON
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    这里只展示当前选中的 {selectedField} 模块；完整配置请通过按钮单独查看。
                  </Typography>
                </Box>

                {isSubmitted ? (
                  <Alert severity="success">当前模块已提交，完整 Xray 配置已同步更新。</Alert>
                ) : (
                  <Alert severity="info">正在实时同步当前模块的 formData，右侧只预览当前模块。</Alert>
                )}

                <Button variant="outlined" onClick={() => setIsFullJsonOpen(true)}>
                  查看完整 JSON
                </Button>

                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'grey.100',
                    overflow: 'auto',
                    fontSize: 13,
                    lineHeight: 1.6,
                    minHeight: 520,
                  }}
                >
                  {selectedModulePreview}
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Container>

      <Dialog open={isFullJsonOpen} onClose={() => setIsFullJsonOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>完整 Xray JSON 配置</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              borderRadius: 3,
              bgcolor: 'grey.100',
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: '70vh',
            }}
          >
            {fullJsonPreview}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => downloadJsonFile(config)} startIcon={<DownloadRoundedIcon />}>
            导出完整 JSON
          </Button>
          <Button variant="contained" onClick={() => setIsFullJsonOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
