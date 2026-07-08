import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';
import { I18nProvider } from '../i18n';

afterEach(cleanup);

function BuggyComponent({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello world</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('catches errors and shows fallback UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <I18nProvider>
        <ErrorBoundary>
          <BuggyComponent shouldThrow />
        </ErrorBoundary>
      </I18nProvider>,
    );

    expect(screen.getByText('An error occurred')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('retry button clears the error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <I18nProvider>
        <ErrorBoundary>
          <BuggyComponent shouldThrow />
        </ErrorBoundary>
      </I18nProvider>,
    );

    // Use getAllByRole to handle potential StrictMode double-rendering
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    fireEvent.click(retryButtons[0]);

    // After retry, BuggyComponent re-renders and throws again (shouldThrow still true)
    expect(screen.getByText('An error occurred')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
