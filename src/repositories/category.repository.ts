import prisma from '../database/prisma';
import { TicketCategory, TicketCategoryRole } from '@prisma/client';

export class CategoryRepository {
  public static async getById(id: string): Promise<TicketCategory | null> {
    return await prisma.ticketCategory.findFirst({
      where: { id, deletedAt: null },
    });
  }

  public static async getBySlug(guildId: string, slug: string): Promise<TicketCategory | null> {
    return await prisma.ticketCategory.findFirst({
      where: { guildId, slug, deletedAt: null },
    });
  }

  public static async getActive(guildId: string): Promise<TicketCategory[]> {
    return await prisma.ticketCategory.findMany({
      where: { guildId, active: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  public static async getAll(guildId: string): Promise<TicketCategory[]> {
    return await prisma.ticketCategory.findMany({
      where: { guildId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  public static async create(
    data: Omit<TicketCategory, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<TicketCategory> {
    return await prisma.ticketCategory.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: Partial<Omit<TicketCategory, 'id' | 'guildId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  ): Promise<TicketCategory> {
    return await prisma.ticketCategory.update({
      where: { id },
      data,
    });
  }

  public static async softDelete(id: string): Promise<TicketCategory> {
    return await prisma.ticketCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public static async countActiveTickets(categoryId: string): Promise<number> {
    return await prisma.ticket.count({
      where: { categoryId, status: 'OPEN' },
    });
  }

  // --- Category Staff Role Mappings ---

  public static async getRoles(categoryId: string): Promise<TicketCategoryRole[]> {
    return await prisma.ticketCategoryRole.findMany({
      where: { ticketCategoryId: categoryId },
    });
  }

  public static async setRoles(
    categoryId: string,
    roles: { roleId: string; roleNameSnapshot: string }[],
  ): Promise<void> {
    // Delete existing roles
    await prisma.ticketCategoryRole.deleteMany({
      where: { ticketCategoryId: categoryId },
    });

    // Create new role mappings
    if (roles.length > 0) {
      await prisma.ticketCategoryRole.createMany({
        data: roles.map((r) => ({
          ticketCategoryId: categoryId,
          roleId: r.roleId,
          roleNameSnapshot: r.roleNameSnapshot,
        })),
      });
    }
  }
}

export default CategoryRepository;
