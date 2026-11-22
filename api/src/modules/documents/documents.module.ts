import { Module } from '@nestjs/common';
import { DocumentRenderer } from './document-renderer.service.js';

/** HTML to PDF through Gotenberg, for reports, invoices and receipts. */
@Module({
  providers: [DocumentRenderer],
  exports: [DocumentRenderer],
})
export class DocumentsModule {}
