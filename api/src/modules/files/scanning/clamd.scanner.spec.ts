import { createServer, type Server } from 'node:net';
import { Readable } from 'node:stream';
import { ClamdScanner } from './clamd.scanner.js';

/** A stand-in clamd that checks the INSTREAM framing and flags a marker. */
function fakeClamd(): Promise<{
  server: Server;
  port: number;
  received: () => Buffer;
}> {
  let received = Buffer.alloc(0);
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      const command = 'zINSTREAM\0';
      if (buffer.length < command.length) return;
      let offset = command.length;
      const chunks: Buffer[] = [];
      while (buffer.length >= offset + 4) {
        const size = buffer.readUInt32BE(offset);
        if (size === 0) {
          received = Buffer.concat(chunks);
          socket.end(
            received.includes('BAD')
              ? 'stream: Test.Marker FOUND\0'
              : 'stream: OK\0',
          );
          return;
        }
        if (buffer.length < offset + 4 + size) return;
        chunks.push(buffer.subarray(offset + 4, offset + 4 + size));
        offset += 4 + size;
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === 'object' && address ? address.port : 0,
        received: () => received,
      });
    }),
  );
}

describe('ClamdScanner', () => {
  it('streams the file in INSTREAM chunks and reads the verdict', async () => {
    const clamd = await fakeClamd();
    const scanner = new ClamdScanner('127.0.0.1', clamd.port);
    const big = Buffer.alloc(200 * 1024, 'a');

    expect(await scanner.scan(Readable.from([big]))).toBe('clean');
    expect(clamd.received().length).toBe(big.length);
    expect(await scanner.scan(Readable.from([Buffer.from('xx BAD xx')]))).toBe(
      'infected',
    );
    clamd.server.close();
  });

  it('fails when clamd is unreachable, so the file stays unavailable', async () => {
    await expect(
      new ClamdScanner('127.0.0.1', 1, 1000).scan(Readable.from(['x'])),
    ).rejects.toThrow();
  });
});
