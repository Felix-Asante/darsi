import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));
const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

@ValidatorConstraint({ name: 'isTimeZone' })
export class IsTimeZone implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return (
      typeof value === 'string' && (TIME_ZONES.has(value) || value === 'UTC')
    );
  }

  defaultMessage() {
    return '$property must be an IANA time zone such as Europe/Paris';
  }
}

@ValidatorConstraint({ name: 'isCurrencyCode' })
export class IsCurrencyCode implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && CURRENCIES.has(value);
  }

  defaultMessage() {
    return '$property must be an ISO 4217 currency code such as EUR';
  }
}
