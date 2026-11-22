import { isAllowedOrigin } from './cors.js';

const patterns = [
  'https://darsi.app',
  'https://*.darsi.app',
  'http://localhost:3000',
];

describe('isAllowedOrigin', () => {
  it.each([
    'https://darsi.app',
    'https://greenfield.darsi.app',
    'https://ecole-du-lac.darsi.app',
    'http://localhost:3000',
  ])('allows %s', (origin) => {
    expect(isAllowedOrigin(origin, patterns)).toBe(true);
  });

  it.each([
    'https://evil.com',
    'https://darsi.app.evil.com',
    'https://evildarsi.app',
    'https://a.b.darsi.app',
    'http://greenfield.darsi.app',
    'http://localhost:3001',
  ])('rejects %s', (origin) => {
    expect(isAllowedOrigin(origin, patterns)).toBe(false);
  });
});
