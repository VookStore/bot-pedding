import prisma from '../database/prisma';
import { Ticket, TicketMember, TicketCategory, Prisma } from '@prisma/client';

export enum TicketStatus {
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  ERROR = 'ERROR',
}

export class TicketRepository {
  public static async getById(
    id: string,
  ): Promise<(Ticket & { category: TicketCategory; members: TicketMember[] }) | null> {
    return await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        members: true,
      },
    });
  }

  public static async getByChannelId(
    channelId: string,
  ): Promise<(Ticket & { category: TicketCategory; members: TicketMember[] }) | null> {
    return await prisma.ticket.findUnique({
      where: { channelId },
      include: {
        category: true,
        members: true,
      },
    });
  }

  public static async getByPublicCode(guildId: string, publicCode: string): Promise<Ticket | null> {
    return await prisma.ticket.findFirst({
      where: { guildId, publicCode },
    });
  }

  public static async countActiveByUser(guildId: string, userId: string): Promise<number> {
    return await prisma.ticket.count({
      where: {
        guildId,
        createdByUserId: userId,
        status: { in: [TicketStatus.OPEN, TicketStatus.CLOSING] },
      },
    });
  }

  public static async countTotalActive(guildId: string): Promise<number> {
    return await prisma.ticket.count({
      where: {
        guildId,
        status: { in: [TicketStatus.OPEN, TicketStatus.CLOSING] },
      },
    });
  }

  public static async create(data: Prisma.TicketUncheckedCreateInput): Promise<Ticket> {
    return await prisma.ticket.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Ticket> {
    return await prisma.ticket.update({
      where: { id },
      data,
    });
  }

  // --- Ticket Additional Members Management ---

  public static async addMember(ticketId: string, userId: string, addedByUserId: string): Promise<TicketMember> {
    return await prisma.ticketMember.upsert({
      where: {
        ticketId_userId: {
          ticketId,
          userId,
        },
      },
      update: {},
      create: {
        ticketId,
        userId,
        addedByUserId,
      },
    });
  }

  public static async removeMember(ticketId: string, userId: string): Promise<TicketMember | null> {
    try {
      return await prisma.ticketMember.delete({
        where: {
          ticketId_userId: {
            ticketId,
            userId,
          },
        },
      });
    } catch {
      return null;
    }
  }

  public static async getMembers(ticketId: string): Promise<TicketMember[]> {
    return await prisma.ticketMember.findMany({
      where: { ticketId },
    });
  }
}

export default TicketRepository;
