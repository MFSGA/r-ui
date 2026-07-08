import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { TranslationContext, translateApp } from './i18n';
import type { Locale } from './i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  static contextType = TranslationContext;
  declare context: { locale: Locale } | undefined;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const locale = this.context?.locale ?? 'en-US';

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 4,
          }}
        >
          <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }} elevation={3}>
            <Typography variant="h5" gutterBottom>
              {translateApp(locale, 'app.errorBoundary.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {this.state.error?.message || translateApp(locale, 'app.errorBoundary.subtitle')}
            </Typography>
            <Button variant="contained" onClick={this.handleRetry}>
              {translateApp(locale, 'app.errorBoundary.retry')}
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
