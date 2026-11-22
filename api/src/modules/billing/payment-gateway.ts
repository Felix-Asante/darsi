import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { ProblemException } from '../../common/errors/problem.exception.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';

export interface CheckoutRequest {
  accountId: string;
  schoolId: string;
  invoiceId: string;
  amount: bigint;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  /** Repeating the same request returns the same session instead of a second one. */
  idempotencyKey: string;
}

/** A verified payment from the provider. Only these change what a family owes. */
export interface CompletedPayment {
  eventId: string;
  paymentId: string;
  amount: bigint;
  currency: string;
  schoolId: string;
  invoiceId: string;
}

/** Wraps the card provider, so a regional one can be added later. */
export abstract class PaymentGateway {
  abstract createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
  /** Checks the signature; returns the payment for completed checkouts and null for other events. */
  abstract verifyWebhook(
    rawBody: Buffer,
    signature: string,
  ): CompletedPayment | null;
  abstract refund(
    accountId: string,
    paymentId: string,
    amount: bigint,
    idempotencyKey: string,
  ): Promise<{ id: string }>;
  /** Where a school's finance officer connects their Stripe account. */
  abstract onboardingLink(
    accountId: string | null,
    returnUrl: string,
  ): Promise<{ accountId: string; url: string }>;
}

const unavailable = () =>
  new ProblemException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'payments_unavailable',
    'Online payments are not configured',
  );

@Injectable()
export class StripeGateway extends PaymentGateway {
  private readonly stripe: Stripe | null;
  private readonly webhookSecret?: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    const key = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.stripe = key ? new Stripe(key) : null;
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
  }

  private get client(): Stripe {
    if (!this.stripe) throw unavailable();
    return this.stripe;
  }

  async createCheckout(request: CheckoutRequest) {
    const session = await this.client.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: Number(request.amount),
              product_data: { name: request.description },
            },
          },
        ],
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        metadata: { schoolId: request.schoolId, invoiceId: request.invoiceId },
        payment_intent_data: {
          metadata: {
            schoolId: request.schoolId,
            invoiceId: request.invoiceId,
          },
        },
      },
      {
        stripeAccount: request.accountId,
        idempotencyKey: request.idempotencyKey,
      },
    );
    if (!session.url) throw unavailable();
    return { url: session.url };
  }

  verifyWebhook(rawBody: Buffer, signature: string): CompletedPayment | null {
    if (!this.webhookSecret) throw unavailable();
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'invalid_signature',
        'The webhook signature is not valid',
      );
    }
    if (event.type !== 'checkout.session.completed') return null;
    const session = event.data.object;
    if (
      session.payment_status !== 'paid' ||
      !session.metadata?.schoolId ||
      !session.metadata.invoiceId
    )
      return null;
    return {
      eventId: event.id,
      paymentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? session.id),
      amount: BigInt(session.amount_total ?? 0),
      currency: (session.currency ?? '').toUpperCase(),
      schoolId: session.metadata.schoolId,
      invoiceId: session.metadata.invoiceId,
    };
  }

  async refund(
    accountId: string,
    paymentId: string,
    amount: bigint,
    idempotencyKey: string,
  ) {
    const refund = await this.client.refunds.create(
      { payment_intent: paymentId, amount: Number(amount) },
      { stripeAccount: accountId, idempotencyKey },
    );
    return { id: refund.id };
  }

  async onboardingLink(accountId: string | null, returnUrl: string) {
    const id =
      accountId ?? (await this.client.accounts.create({ type: 'standard' })).id;
    const link = await this.client.accountLinks.create({
      account: id,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return { accountId: id, url: link.url };
  }
}
