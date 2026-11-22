import { escapeIdentifier } from 'pg';

/** The role the API connects as, taken from DATABASE_URL so migrations and the app agree. */
export function runtimeRole() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL must be set: its user is the runtime role');
  }
  const { username, password } = new URL(url);
  const name = decodeURIComponent(username);
  return {
    name,
    identifier: escapeIdentifier(name),
    password: decodeURIComponent(password),
  };
}
