import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss, { type Root, type Rule } from 'postcss';
import tailwind from '@tailwindcss/postcss';

let stylesheet: Root;

function matchingRules(selector: string): Rule[] {
  const matches: Rule[] = [];
  stylesheet.walkRules((rule) => {
    if (rule.selector.split(',').some((part) => part.trim() === selector)) {
      matches.push(rule);
    }
  });
  return matches;
}

function values(property: string, selector?: string): string[] {
  const results: string[] = [];
  if (!selector) {
    stylesheet.walkDecls(property, (declaration) => { results.push(declaration.value); });
    return results;
  }
  for (const rule of matchingRules(selector)) {
    for (const node of rule.nodes) {
      if (node.type === 'decl' && node.prop === property) results.push(node.value);
    }
  }
  return results;
}

beforeAll(async () => {
  const root = process.cwd();
  const from = path.join(root, 'app/globals.css');
  const result = await postcss([tailwind({ base: root, optimize: false })])
    .process(`${await readFile(from, 'utf8')}\n@source inline("rounded-sm");`, { from });
  stylesheet = postcss.parse(result.css);
}, 30000);

describe('Tailwind 4 legacy styling contracts', () => {
  it('generates existing shrink and white-background utilities', () => {
    expect(values('flex-shrink', '.flex-shrink-0')).toContain('0');
    expect(values('background-color', '.bg-white')).toContain('var(--color-white)');
    expect(values('--color-white')).toContain('#fff');
  });

  it('keeps the transparent focus outline after the built-in outline-none rule', () => {
    const rules = matchingRules('.focus\\:outline-none:focus');
    expect(rules.length).toBeGreaterThan(0);
    const finalRule = rules.at(-1)!;
    const declarations: Record<string, string> = {};
    finalRule.walkDecls((declaration) => { declarations[declaration.prop] = declaration.value; });
    expect(declarations.outline).toBe('2px solid transparent');
    expect(declarations['outline-offset']).toBe('2px');
    expect(declarations['outline-style']).not.toBe('none');
  });

  it('keeps safe-area rules outside cascade layers so padding utilities cannot mask insets', () => {
    for (const selector of ['nav.safe-top', 'header.safe-top', '.safe-bottom', '.safe-screen']) {
      const rules = matchingRules(selector);
      expect(rules).not.toHaveLength(0);
      expect(rules.every((rule) => rule.parent?.type === 'root')).toBe(true);
    }
    expect(values('padding-top', 'nav.safe-top')).toContain('calc(var(--safe-top) + 0.75rem)');
  });

  it('preserves legacy font, small shadow/radius and blur tokens', () => {
    expect(values('font-family', '.font-sans').some((value) => /^ui-sans-serif,\s*system-ui,\s*sans-serif/.test(value))).toBe(true);
    expect(values('--blur-sm')).toContain('4px');
    const radius = values('border-radius', '.rounded-sm').at(-1);
    expect(radius === '0.125rem' || (radius === 'var(--radius-sm)' && values('--radius-sm').includes('0.125rem'))).toBe(true);
    expect(values('--tw-shadow', '.shadow-sm').some((value) => value.startsWith('0 1px 2px 0 ') && value.includes('0.05'))).toBe(true);
  });

  it('retains exact TripAdvisor alpha tints', () => {
    expect(values('background-color', '.bg-\\[\\#00AA6C\\]\\/5').at(-1)).toBe('rgb(0 170 108 / 0.05)');
    expect(values('border-color', '.border-\\[\\#00AA6C\\]\\/30').at(-1)).toBe('rgb(0 170 108 / 0.3)');
  });

  it('does not scan sibling verification-fixture classes into the app stylesheet', () => {
    expect(matchingRules('.case-frame')).toHaveLength(0);
    expect(matchingRules('.focus-probe')).toHaveLength(0);
  });
});
