import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

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
      <ErrorBoundary>
        <BuggyComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('发生错误')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('retry button clears the error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BuggyComponent shouldThrow />
      </ErrorBoundary>,
    );

    // Use getAllByRole to handle potential StrictMode double-rendering
    const retryButtons = screen.getAllByRole('button', { name: '重试' });
    fireEvent.click(retryButtons[0]);

    // After retry, BuggyComponent re-renders and throws again (shouldThrow still true)
    expect(screen.getByText('发生错误')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
