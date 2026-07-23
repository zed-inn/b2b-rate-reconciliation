import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: 'info',
  transport: env.NODE_ENV === 'dev' ? { target: 'pino-pretty' } : undefined,
});
