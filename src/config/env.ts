import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DEVELOPER_GUILD_ID: z.string().optional(),
  BOT_FOUNDER_IDS: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .refine((val) => val.length > 0, 'BOT_FOUNDER_IDS must contain at least one Discord user ID'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
  REDIS_URL: z.string().optional(),
  TRANSCRIPT_STORAGE_MODE: z.enum(['local', 's3']).default('local'),
  TRANSCRIPT_LOCAL_PATH: z.string().default(path.join(process.cwd(), 'data', 'transcripts')),

  // S3 settings
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print detailed validation errors to console and crash process early
  // eslint-disable-next-line no-console
  console.error('❌ Environment validation failed:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export default env;
