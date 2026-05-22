import { ConfigService } from '@nestjs/config';
import DodoPayments from 'dodopayments';

export type DodoEnvironment = 'test_mode' | 'live_mode';

export function resolveDodoEnvironment(configService: ConfigService): DodoEnvironment {
  const raw = (configService.get<string>('DODO_PAYMENTS_ENVIRONMENT') ?? 'test_mode').toLowerCase();
  if (raw === 'live_mode' || raw === 'live' || raw === 'production') {
    return 'live_mode';
  }
  return 'test_mode';
}

export function createDodoClient(configService: ConfigService): DodoPayments {
  return new DodoPayments({
    bearerToken: configService.get<string>('DODO_PAYMENTS_API_KEY') || '',
    environment: resolveDodoEnvironment(configService),
    webhookKey: configService.get<string>('DODO_PAYMENTS_WEBHOOK_SECRET') || '',
  });
}
