import { appLink } from './app-links.js';

describe('appLink', () => {
  it('links English pages without a prefix and French ones under /fr', () => {
    expect(
      appLink('https://greenfield.darsi.app/', 'en', '/reset-password'),
    ).toBe('https://greenfield.darsi.app/reset-password');
    expect(
      appLink('https://greenfield.darsi.app', 'fr-FR', 'reset-password'),
    ).toBe('https://greenfield.darsi.app/fr/reset-password');
    expect(appLink('https://darsi.app', null, '/sign-in')).toBe(
      'https://darsi.app/sign-in',
    );
  });
});
