import type { IncomingMessage } from 'node:http';
import { v7 as uuidv7 } from 'uuid';

const VALID_REQUEST_ID = /^[\w-]{8,64}$/;

/** Reuses a trusted upstream `x-request-id`, so one id follows a request through every log line. */
export function requestIdFor(
  request: IncomingMessage & { id?: unknown },
): string {
  if (typeof request.id === 'string') return request.id;

  const header = request.headers['x-request-id'];
  const id =
    typeof header === 'string' && VALID_REQUEST_ID.test(header)
      ? header
      : uuidv7();
  request.id = id;
  return id;
}
