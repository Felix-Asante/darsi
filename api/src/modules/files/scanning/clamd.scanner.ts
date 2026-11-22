import { connect } from 'node:net';
import type { Readable } from 'node:stream';
import { MalwareScanner, type ScanResult } from './malware-scanner.js';

const CHUNK = 64 * 1024;

/**
 * Streams the file to clamd with the INSTREAM command: each chunk is prefixed
 * by its length (4 bytes, big-endian), and a zero length ends the stream.
 * clamd answers `stream: OK` or `stream: <name> FOUND`.
 */
export class ClamdScanner extends MalwareScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 120_000,
  ) {
    super();
  }

  scan(content: Readable): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: this.host, port: this.port });
      let answer = '';
      const fail = (error: Error) => {
        socket.destroy();
        content.destroy();
        reject(error);
      };
      socket.setTimeout(this.timeoutMs, () =>
        fail(new Error('clamd timed out')),
      );
      socket.on('error', fail);
      socket.on('data', (data) => (answer += data.toString()));
      socket.on('end', () => {
        const reply = answer.replace(/\0/g, '').trim();
        if (reply.endsWith('OK')) resolve('clean');
        else if (reply.endsWith('FOUND')) resolve('infected');
        else reject(new Error(`clamd answered: ${reply}`));
      });

      socket.on('connect', async () => {
        try {
          socket.write('zINSTREAM\0');
          for await (const piece of content) {
            const buffer = Buffer.isBuffer(piece)
              ? piece
              : Buffer.from(piece as string);
            for (let offset = 0; offset < buffer.length; offset += CHUNK) {
              const chunk = buffer.subarray(offset, offset + CHUNK);
              const size = Buffer.alloc(4);
              size.writeUInt32BE(chunk.length);
              if (!socket.write(Buffer.concat([size, chunk])))
                await new Promise((done) => socket.once('drain', done));
            }
          }
          socket.end(Buffer.alloc(4));
        } catch (error) {
          fail(error as Error);
        }
      });
    });
  }
}
