import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProblemException } from '../../common/errors/problem.exception.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';

/** Gotenberg's Chromium route: HTML in, PDF out. */
@Injectable()
export class DocumentRenderer {
  private readonly url?: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.url = config.get('GOTENBERG_URL', { infer: true });
  }

  async pdf(html: string): Promise<Buffer> {
    if (!this.url) {
      throw new ProblemException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'documents_unavailable',
        'PDF generation is not configured',
      );
    }
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('preferCssPageSize', 'true');
    form.append('printBackground', 'true');
    const response = await fetch(
      `${this.url.replace(/\/+$/, '')}/forms/chromium/convert/html`,
      {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!response.ok) throw new Error(`Gotenberg answered ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}
