/// <mls fileReference="_102029_/l2/designSystemBase.test.ts" enhancement="_blank"/>

import assert from 'node:assert/strict';
import test from 'node:test';
import { getComponentTokensCss, tokensCssFromTheme, type IDesignSystemTokens } from './designSystemBase.js';

const BASE: IDesignSystemTokens = {
  themeName: 'Default',
  description: '',
  color: { 'primary-bg': '#111111', '_dark-primary-bg': '#eeeeee', 'ml-outline-focus': '#2563EB' },
  typography: { 'font-size-base': '16px' },
  global: { 'ml-border-width': '1px' },
};

test('tokensCssFromTheme: no components (absent or empty) = the same css as before', () => {
  const before = tokensCssFromTheme(BASE);
  assert.equal(tokensCssFromTheme({ ...BASE, components: {} }), before);
  assert.equal(tokensCssFromTheme({ ...BASE, components: { 'groupentertext--ml-x': {} } }), before);
  assert.equal(getComponentTokensCss(undefined), '');
  assert.doesNotMatch(before, /:root group/);
});

test('getComponentTokensCss: light keys on the molecule, _dark- keys in the dark block', () => {
  const css = getComponentTokensCss({
    'groupentertext--ml-address-field': { 'ml-border-width': '2px', 'ml-outline-focus': '#2563EB', '_dark-ml-outline-focus': '#60A5FA' },
  });
  assert.equal(css, [
    ':root groupentertext--ml-address-field{\n\t--ml-border-width: 2px;\n\t--ml-outline-focus: #2563EB;\n}',
    '[data-theme="dark"] groupentertext--ml-address-field, :root.dark groupentertext--ml-address-field{\n\t--ml-outline-focus: #60A5FA;\n}',
  ].join('\n'));
});

test('getComponentTokensCss: tags in order; bad tag, bad key and empty value skipped', () => {
  const css = getComponentTokensCss({
    'groupviewtable--ml-grid': { 'ml-table-action-gap': '0.75rem' },
    'groupentertext--ml-cpf-input': { 'ml-border-width': '  ', 'bad key': '1px', 'ml-x': 'a;b', 'ml-y': 'a}b', 'ml-ok': '3px' },
    'div': { 'ml-border-width': '2px' },
    'groupentertext--ml-a .evil': { 'ml-border-width': '2px' },
  });
  assert.equal(css, ':root groupentertext--ml-cpf-input{\n\t--ml-ok: 3px;\n}\n:root groupviewtable--ml-grid{\n\t--ml-table-action-gap: 0.75rem;\n}');
});

test('tokensCssFromTheme: component blocks come after the :root and dark blocks', () => {
  const css = tokensCssFromTheme({ ...BASE, components: { 'groupentertext--ml-address-field': { 'ml-border-width': '2px' } } });
  const root = css.indexOf(':root{');
  const dark = css.indexOf('[data-theme="dark"], :root.dark');
  const comp = css.indexOf(':root groupentertext--ml-address-field{');
  assert.ok(root >= 0 && dark > root && comp > dark, css);
  assert.match(css, /--ml-border-width: 1px;/);   // the value for everyone stays on :root
});
