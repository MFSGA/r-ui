import { cleanup, render, screen } from '@testing-library/react';
import type { ArrayFieldTemplateProps } from '@rjsf/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompactArrayFieldTemplate } from '../CompactArrayFieldTemplate';

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN',
    t: (key: string) => key,
  }),
}));

afterEach(cleanup);

function createProps(path: Array<string | number>): ArrayFieldTemplateProps {
  return {
    canAdd: false,
    disabled: false,
    fieldPathId: {
      $id: path.length === 0 ? 'root' : `root_${path.join('_')}`,
      path,
    },
    items: [],
    onAddClick: vi.fn(),
    optionalDataControl: undefined,
    readonly: false,
    registry: {
      formContext: {
        extraActions: <button type="button">添加 TCP REALITY 入站</button>,
      },
    },
    required: false,
    schema: { type: 'array' },
    title: '数组字段',
    uiSchema: {},
  } as unknown as ArrayFieldTemplateProps;
}

describe('CompactArrayFieldTemplate', () => {
  it('renders extra actions for the root array', () => {
    render(<CompactArrayFieldTemplate {...createProps([])} />);

    expect(screen.getByRole('button', { name: '添加 TCP REALITY 入站' })).toBeInTheDocument();
  });

  it('does not render root extra actions for nested arrays', () => {
    render(<CompactArrayFieldTemplate {...createProps([0, 'settings', 'clients'])} />);

    expect(screen.queryByRole('button', { name: '添加 TCP REALITY 入站' })).not.toBeInTheDocument();
  });
});
