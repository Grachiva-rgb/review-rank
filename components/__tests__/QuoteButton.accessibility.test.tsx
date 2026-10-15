import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QuoteButton from '../QuoteButton';

const controlledState = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      const value = controlledState.values[controlledState.index++];
      return [value === undefined ? initial : value, () => {}];
    }) as typeof actual.useState,
  };
});

const props = {
  businessName: 'Sample Plumbing',
  businessId: 'sample-place',
  category: 'plumbing' as const,
};

function renderOpenDialogs(count = 1, error = '') {
  controlledState.values = Array.from({ length: count }, () => [
    true, false, false, error, false, true,
  ]).flat();
  controlledState.index = 0;

  const children = Array.from({ length: count }, (_, index) =>
    React.createElement(QuoteButton, { ...props, key: index })
  );
  return renderToStaticMarkup(React.createElement(React.Fragment, null, ...children));
}

describe('QuoteButton accessible modal markup', () => {
  beforeEach(() => {
    controlledState.values = [];
    controlledState.index = 0;
  });

  it('renders labelled dialog controls, native consent validation, and a scrollable panel', () => {
    const markup = renderOpenDialogs();
    const titleId = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(titleId).toBeTruthy();
    expect(markup).toContain(`id="${titleId}"`);

    for (const [label, controlId] of [
      ['Your name', /id="([^"]+-name)"/],
      ['Phone number', /id="([^"]+-phone)"/],
      ['What do you need?', /id="([^"]+-description)"/],
    ] as const) {
      const id = markup.match(controlId)?.[1];
      expect(id).toBeTruthy();
      expect(markup).toContain(
        `<label for="${id}" class="mb-1 block text-xs font-medium text-[#5A4A3F]">${label}</label>`
      );
    }

    expect(markup).toMatch(/<input[^>]*id="[^"]+-consent"[^>]*required/);
    expect(markup).toContain('max-h-[90dvh]');
    expect(markup).toContain('overflow-y-auto');
  });

  it('announces validation errors and associates them with the form controls', () => {
    const markup = renderOpenDialogs(1, 'Please enter your name.');
    const errorId = markup.match(/<p id="([^"]+)" role="alert" aria-live="assertive"/)?.[1];
    expect(errorId).toBeTruthy();
    expect(markup).toContain('Please enter your name.');
    expect(markup).toContain(`aria-describedby="${errorId}"`);
  });

  it('uses distinct generated ids when multiple quote dialogs render together', () => {
    const markup = renderOpenDialogs(2);
    const titleIds = [...markup.matchAll(/aria-labelledby="([^"]+)"/g)].map(match => match[1]);
    expect(titleIds).toHaveLength(2);
    expect(new Set(titleIds).size).toBe(2);
  });
});
