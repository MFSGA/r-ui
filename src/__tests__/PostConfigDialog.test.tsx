import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import PostConfigDialog from '../PostConfigDialog';

afterEach(cleanup);

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'app.postUrlTitle': '发送配置',
        'app.postUrlHint': '提示信息',
        'app.postUrlLabel': '目标 URL',
        'app.postUrlPlaceholder': 'https://example.com/api/config',
        'app.cancel': '取消',
        'app.postUrlSubmit': '发送',
        'app.posting': '发送中...',
        'app.format.json': 'JSON',
        'app.format.yaml': 'YAML',
        'app.format.toml': 'TOML',
        'app.format.json5': 'JSON5',
      };
      return translations[key] || key;
    },
  }),
}));

describe('PostConfigDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    config: { outbounds: [{ protocol: 'freedom', tag: 'direct' }] },
    format: 'json' as const,
    onError: vi.fn(),
  };

  it('renders when open', () => {
    render(<PostConfigDialog {...baseProps} />);
    expect(screen.getByText('发送配置')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<PostConfigDialog {...baseProps} open={false} />);
    expect(screen.queryByText('发送配置')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<PostConfigDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('has URL input field', () => {
    render(<PostConfigDialog {...baseProps} />);
    expect(screen.getByLabelText('目标 URL')).toBeInTheDocument();
  });
});
