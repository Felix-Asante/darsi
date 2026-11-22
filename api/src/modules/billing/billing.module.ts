import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PeopleModule } from '../people/people.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { BillingController } from './billing.controller.js';
import {
  BillingSettings,
  CreditNote,
  Discount,
  DocumentSequence,
  FeeItem,
  FeeStructure,
  FeeStructureLine,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentAllocation,
  PaymentProviderEvent,
  Refund,
  StudentDiscount,
} from './billing.entities.js';
import { BillingReportsService } from './billing-reports.service.js';
import { BillingSetupService } from './billing-setup.service.js';
import { BILLING_QUEUE, InvoicesService } from './invoices.service.js';
import { LedgerService } from './ledger.service.js';
import { PaymentGateway, StripeGateway } from './payment-gateway.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingSettings,
      FeeItem,
      FeeStructure,
      FeeStructureLine,
      Discount,
      StudentDiscount,
      DocumentSequence,
      Invoice,
      InvoiceLine,
      CreditNote,
      Payment,
      PaymentAllocation,
      Refund,
      PaymentProviderEvent,
    ]),
    BullModule.registerQueue({ name: BILLING_QUEUE }),
    AcademicsModule,
    PeopleModule,
    SchoolsModule,
    CalendarModule,
    DocumentsModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingSetupService,
    LedgerService,
    InvoicesService,
    PaymentsService,
    BillingReportsService,
    { provide: PaymentGateway, useClass: StripeGateway },
  ],
  exports: [InvoicesService, PaymentsService, BillingSetupService],
})
export class BillingModule {}
