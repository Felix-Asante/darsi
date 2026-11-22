import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  type RawBodyRequest,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public, RequirePermission } from '../auth/auth.decorators.js';
import {
  BillingSettingsDto,
  CreditNoteDto,
  DiscountDto,
  DraftInvoiceDto,
  FeeItemDto,
  FeeStructureDto,
  IssueInvoiceDto,
  LocaleQueryDto,
  PaymentDto,
  RefundDto,
  ReportRangeDto,
  RunPeriodDto,
  StudentDiscountsDto,
} from './billing.dto.js';
import { BillingReportsService } from './billing-reports.service.js';
import { BillingSetupService } from './billing-setup.service.js';
import { InvoicesService } from './invoices.service.js';
import { PaymentsService } from './payments.service.js';

const id = new ParseUUIDPipe({ version: '7' });

const pdf = ({ name, content }: { name: string; content: Buffer }) =>
  new StreamableFile(content, {
    type: 'application/pdf',
    disposition: `inline; filename="${name}"`,
  });

@Controller('billing')
export class BillingController {
  constructor(
    private readonly setup: BillingSetupService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly reports: BillingReportsService,
  ) {}

  // ── Setup ───────────────────────────────────────────────────────────

  @Get('settings')
  @RequirePermission({ fee: ['read'] })
  settings() {
    return this.setup.settings();
  }

  @Put('settings')
  @RequirePermission({ fee: ['manage'] })
  saveSettings(@Body() dto: BillingSettingsDto) {
    return this.setup.saveSettings(dto);
  }

  @Post('stripe/connect')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ fee: ['manage'] })
  connectStripe(@Query() { locale }: LocaleQueryDto) {
    return this.payments.connectStripe(locale ?? 'en');
  }

  @Get('fee-items')
  @RequirePermission({ fee: ['read'] })
  feeItems() {
    return this.setup.feeItems();
  }

  @Post('fee-items')
  @RequirePermission({ fee: ['manage'] })
  createFeeItem(@Body() dto: FeeItemDto) {
    return this.setup.saveFeeItem(dto);
  }

  @Put('fee-items/:id')
  @RequirePermission({ fee: ['manage'] })
  updateFeeItem(@Param('id', id) itemId: string, @Body() dto: FeeItemDto) {
    return this.setup.saveFeeItem(dto, itemId);
  }

  @Get('structures')
  @RequirePermission({ fee: ['read'] })
  structures(@Query('academicYearId') academicYearId?: string) {
    return this.setup.structures(academicYearId);
  }

  @Put('structures')
  @RequirePermission({ fee: ['manage'] })
  saveStructure(@Body() dto: FeeStructureDto) {
    return this.setup.saveStructure(dto);
  }

  @Get('discounts')
  @RequirePermission({ fee: ['read'] })
  discounts() {
    return this.setup.discounts();
  }

  @Post('discounts')
  @RequirePermission({ fee: ['manage'] })
  createDiscount(@Body() dto: DiscountDto) {
    return this.setup.saveDiscount(dto);
  }

  @Put('discounts/:id')
  @RequirePermission({ fee: ['manage'] })
  updateDiscount(
    @Param('id', id) discountId: string,
    @Body() dto: DiscountDto,
  ) {
    return this.setup.saveDiscount(dto, discountId);
  }

  @Put('students/:id/discounts')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ fee: ['manage'] })
  setStudentDiscounts(
    @Param('id', id) studentId: string,
    @Body() { discountIds }: StudentDiscountsDto,
  ) {
    return this.setup.setStudentDiscounts(studentId, discountIds);
  }

  // ── Invoices ────────────────────────────────────────────────────────

  @Get('invoices')
  @RequirePermission({ invoice: ['read'] })
  listInvoices(
    @Query('familyId') familyId?: string,
    @Query('status') status?: 'draft' | 'issued',
  ) {
    return this.invoices.list({
      familyId,
      status: status === 'draft' || status === 'issued' ? status : undefined,
    });
  }

  @Get('invoices/:id')
  @RequirePermission({ invoice: ['read'] })
  invoice(@Param('id', id) invoiceId: string) {
    return this.invoices.get(invoiceId);
  }

  @Get('invoices/:id/pdf')
  @RequirePermission({ invoice: ['read'] })
  async invoicePdf(
    @Param('id', id) invoiceId: string,
    @Query() { locale }: LocaleQueryDto,
  ) {
    return pdf(await this.invoices.pdf(invoiceId, locale ?? 'en'));
  }

  @Post('invoices')
  @RequirePermission({ invoice: ['issue'] })
  createDraft(@Body() dto: DraftInvoiceDto) {
    return this.invoices.createDraft(dto);
  }

  @Patch('invoices/:id')
  @RequirePermission({ invoice: ['issue'] })
  updateDraft(
    @Param('id', id) invoiceId: string,
    @Body() dto: DraftInvoiceDto,
  ) {
    return this.invoices.updateDraft(invoiceId, dto);
  }

  @Delete('invoices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ invoice: ['issue'] })
  deleteDraft(@Param('id', id) invoiceId: string) {
    return this.invoices.deleteDraft(invoiceId);
  }

  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ invoice: ['issue'] })
  issue(
    @Param('id', id) invoiceId: string,
    @Body() { dueDate }: IssueInvoiceDto,
  ) {
    return this.invoices.issue(invoiceId, dueDate);
  }

  @Post('invoices/:id/credit-notes')
  @RequirePermission({ invoice: ['credit'] })
  creditNote(
    @Param('id', id) invoiceId: string,
    @Body() { amount, reason }: CreditNoteDto,
  ) {
    return this.invoices.creditNote(invoiceId, BigInt(amount), reason);
  }

  /** Guardians pay on Stripe's page; repeat clicks with the same key get the same session. */
  @Post('invoices/:id/checkout')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ invoice: ['read'] })
  checkout(
    @Param('id', id) invoiceId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Query() { locale }: LocaleQueryDto,
  ) {
    if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) {
      throw new BadRequestException('An Idempotency-Key header is required');
    }
    return this.payments.checkout(invoiceId, idempotencyKey, locale ?? 'en');
  }

  @Post('runs/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ invoice: ['issue'] })
  previewRun(@Body() dto: RunPeriodDto) {
    return this.invoices.preview(dto);
  }

  @Post('runs')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ invoice: ['issue'] })
  run(@Body() dto: RunPeriodDto) {
    return this.invoices.run(dto);
  }

  // ── Payments ────────────────────────────────────────────────────────

  @Get('payments')
  @RequirePermission({ payment: ['read'] })
  listPayments(@Query('familyId') familyId?: string) {
    return this.payments.list(familyId);
  }

  @Post('payments')
  @RequirePermission({ payment: ['record'] })
  recordPayment(@Body() dto: PaymentDto) {
    return this.payments.record(dto);
  }

  @Post('payments/:id/refunds')
  @RequirePermission({ payment: ['refund'] })
  refund(
    @Param('id', id) paymentId: string,
    @Body() { amount, reason }: RefundDto,
  ) {
    return this.payments.refund(paymentId, BigInt(amount), reason);
  }

  @Get('payments/:id/receipt')
  @RequirePermission({ payment: ['read'] })
  async receipt(
    @Param('id', id) paymentId: string,
    @Query() { locale }: LocaleQueryDto,
  ) {
    return pdf(await this.payments.receiptPdf(paymentId, locale ?? 'en'));
  }

  @Get('statements')
  @RequirePermission({ invoice: ['read'] })
  statements() {
    return this.payments.statements();
  }

  /** Stripe calls this; the signature, not a session, proves it. */
  @Post('webhooks/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!request.rawBody || !signature)
      throw new BadRequestException('Missing signature');
    return this.payments.webhook(request.rawBody, signature);
  }

  // ── Reports (FEE-17) ────────────────────────────────────────────────

  @Get('families')
  @RequirePermission({ fee: ['read'] })
  families() {
    return this.reports.accounts();
  }

  @Get('reports/outstanding')
  @RequirePermission({ fee: ['read'] })
  outstanding(@Query('gradeLevelId') gradeLevelId?: string) {
    return this.reports.outstanding(gradeLevelId);
  }

  @Get('reports/outstanding.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="outstanding.csv"')
  @RequirePermission({ fee: ['read'] })
  outstandingCsv(@Query('gradeLevelId') gradeLevelId?: string) {
    return this.reports.outstandingCsv(gradeLevelId);
  }

  @Get('reports/collections')
  @RequirePermission({ fee: ['read'] })
  collections(@Query() { from, to }: ReportRangeDto) {
    return this.reports.collections(from, to);
  }
}
