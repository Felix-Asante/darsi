import type { Readable } from 'node:stream';
import { MalwareScanner, type ScanResult } from './malware-scanner.js';

/** The standard antivirus test string. Real scanners all detect it. */
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

/** For automated tests only: detects nothing but EICAR. Production refuses this scanner. */
export class TestSignatureScanner extends MalwareScanner {
  async scan(content: Readable): Promise<ScanResult> {
    let tail = '';
    for await (const piece of content) {
      const text =
        tail +
        (Buffer.isBuffer(piece) ? piece.toString('latin1') : String(piece));
      if (text.includes(EICAR)) return 'infected';
      tail = text.slice(-EICAR.length);
    }
    return 'clean';
  }
}
