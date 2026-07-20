import { createClient } from 'redis';
import env from '../config/env';
import logger from '../logger/logger';
import prisma from '../database/prisma';

export class TicketLockService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static redisClient: any = null;
  private static localLocks = new Set<string>();
  private static localRateLimits = new Map<string, number>();

  static {
    if (env.REDIS_URL) {
      logger.info('Initializing Redis for lock and rate limit management...');
      this.redisClient = createClient({ url: env.REDIS_URL });
      this.redisClient
        .connect()
        .then(() => logger.info('Redis connected successfully for locks.'))
        .catch((err: unknown) => {
          logger.error(err, 'Failed to connect to Redis. Running lock and rate limit system on Local Fallbacks.');
          this.redisClient = null;
        });
    }
  }

  /**
   * Acquire a temporary operation-level lock for a specific key.
   * Prevents simultaneous clicks/actions.
   */
  public static async acquireLock(key: string, ttlMs = 5000): Promise<boolean> {
    if (this.redisClient) {
      try {
        const reply = await this.redisClient.set(key, 'locked', {
          NX: true,
          PX: ttlMs,
        });
        return reply === 'OK';
      } catch (err) {
        logger.error({ err, key }, 'Redis lock acquisition failed. Falling back to local memory lock.');
      }
    }

    if (this.localLocks.has(key)) {
      return false;
    }
    this.localLocks.add(key);

    // Auto-release local lock after TTL
    setTimeout(() => {
      this.localLocks.delete(key);
    }, ttlMs);

    return true;
  }

  /**
   * Release a previously acquired lock.
   */
  public static async releaseLock(key: string): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err) {
        logger.error({ err, key }, 'Failed to release lock in Redis.');
      }
    }
    this.localLocks.delete(key);
  }

  /**
   * Validate if the user is currently rate-limited for an action.
   * If not limited, registers the cooldown timestamp.
   */
  public static async checkRateLimit(
    guildId: string,
    userId: string,
    action: string,
    cooldownSeconds: number,
  ): Promise<boolean> {
    const key = `ratelimit:${guildId}:${userId}:${action}`;
    const now = Date.now();
    const expiresAt = now + cooldownSeconds * 1000;

    if (this.redisClient) {
      try {
        const reply = await this.redisClient.set(key, now.toString(), {
          NX: true,
          EX: cooldownSeconds,
        });
        return reply === 'OK';
      } catch (err) {
        logger.error({ err, key }, 'Redis rate limit check failed. Falling back to database persistent limits.');
      }
    }

    // Persistent Database Fallback
    try {
      const existing = await prisma.interactionRateLimit.findUnique({
        where: {
          guildId_userId_action: {
            guildId,
            userId,
            action,
          },
        },
      });

      if (existing) {
        if (existing.expiresAt.getTime() > now) {
          return false;
        }
        await prisma.interactionRateLimit.update({
          where: { id: existing.id },
          data: { expiresAt: new Date(expiresAt) },
        });
        return true;
      } else {
        await prisma.interactionRateLimit.create({
          data: {
            guildId,
            userId,
            action,
            expiresAt: new Date(expiresAt),
          },
        });
        return true;
      }
    } catch (dbErr) {
      logger.error({ dbErr, key }, 'Database rate limit check failed. Falling back to local memory.');
      // Local Memory Fallback
      const last = this.localRateLimits.get(key) || 0;
      if (now - last < cooldownSeconds * 1000) {
        return false;
      }
      this.localRateLimits.set(key, now);
      return true;
    }
  }
}

export default TicketLockService;
