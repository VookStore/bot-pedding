import { GuildMember } from 'discord.js';
import env from '../config/env';
import prisma from '../database/prisma';

export class TicketPermissionService {
  /**
   * Checks if a user is a bot founder.
   */
  public static isFounder(userId: string): boolean {
    return env.BOT_FOUNDER_IDS.includes(userId);
  }

  /**
   * Checks if a guild member has staff permissions for a given category.
   * Bot founders bypass role validation.
   */
  public static async isStaff(member: GuildMember, categoryId: string): Promise<boolean> {
    if (this.isFounder(member.id)) {
      return true;
    }

    // Fetch the category roles from the database
    const categoryRoles = await prisma.ticketCategoryRole.findMany({
      where: { ticketCategoryId: categoryId },
      select: { roleId: true },
    });

    if (categoryRoles.length === 0) {
      // If no roles are configured, only founders can access
      return false;
    }

    const staffRoleIds = categoryRoles.map((cr) => cr.roleId);

    // Check if the member has any of the staff roles
    return member.roles.cache.some((role) => staffRoleIds.includes(role.id));
  }

  /**
   * Checks if a user has administrative permission on the ticket (is founder, staff, or optionally the assigned agent).
   */
  public static async canManageTicket(
    member: GuildMember,
    ticket: { categoryId: string; assignedToUserId: string | null },
  ): Promise<boolean> {
    if (this.isFounder(member.id)) {
      return true;
    }

    if (ticket.assignedToUserId === member.id) {
      return true;
    }

    return await this.isStaff(member, ticket.categoryId);
  }
}

export default TicketPermissionService;
