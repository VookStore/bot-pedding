import prisma from '../database/prisma';
import { TicketActionLog } from '@prisma/client';
import logger from '../logger/logger';

export class AuditRepository {
  /**
   * Log a ticket action in the database and structured pino logs.
   */
  public static async logAction(
    guildId: string,
    ticketId: string | null,
    action: string,
    actorUserId: string | null,
    targetUserId: string | null = null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any = null,
  ): Promise<TicketActionLog> {
    try {
      const entry = await prisma.ticketActionLog.create({
        data: {
          guildId,
          ticketId,
          action,
          actorUserId,
          targetUserId,
          metadata: metadata ? (metadata as any) : undefined,
        },
      });

      logger.info(
        {
          id: entry.id,
          guildId,
          ticketId,
          action,
          actorUserId,
          targetUserId,
          metadata,
        },
        `Audit Log Action: ${action}`,
      );

      return entry;
    } catch (err) {
      logger.error({ err, guildId, ticketId, action }, 'Failed to write audit action log');
      throw err;
    }
  }
}

export default AuditRepository;
