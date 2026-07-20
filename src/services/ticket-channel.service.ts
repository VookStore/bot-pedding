import { Guild, GuildMember, TextChannel, PermissionFlagsBits, ChannelType } from 'discord.js';
import { sanitizeChannelName } from '../shared/utils/sanitize-channel-name';
import logger from '../logger/logger';

export class TicketChannelService {
  /**
   * Creates a private ticket channel in the guild.
   */
  public static async createTicketChannel(
    guild: Guild,
    creatorMember: GuildMember,
    categorySlug: string,
    publicCode: string,
    discordParentCategoryId: string | null,
    staffRoleIds: string[],
  ): Promise<TextChannel> {
    const rawChannelName = `ticket-${categorySlug}-${publicCode}`;
    const sanitizedName = sanitizeChannelName(rawChannelName);

    // Prepare permission overwrites
    const overwrites: Array<{
      id: string;
      allow: bigint[];
      deny: bigint[];
    }> = [
      // Deny access to everyone
      {
        id: guild.roles.everyone.id,
        allow: [],
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Allow the ticket creator
      {
        id: creatorMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
        deny: [],
      },
      // Allow the bot
      {
        id: guild.members.me!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
        deny: [],
      },
    ];

    // Allow each staff role associated with the category
    for (const roleId of staffRoleIds) {
      // Validate that role exists in guild
      const roleExists = guild.roles.cache.has(roleId);
      if (roleExists) {
        overwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
          deny: [],
        });
      }
    }

    // Create the channel
    const channel = await guild.channels.create({
      name: sanitizedName,
      type: ChannelType.GuildText,
      parent: discordParentCategoryId || undefined,
      permissionOverwrites: overwrites as never,
      reason: `VOOK Ticket: Opened by ${creatorMember.user.tag} (Code: ${publicCode})`,
    });

    logger.info({ channelId: channel.id, name: sanitizedName }, 'Created ticket channel successfully');
    return channel;
  }

  /**
   * Archives a channel by removing member permissions, changing name, and moving to archived category.
   */
  public static async archiveTicketChannel(
    channel: TextChannel,
    creatorUserId: string,
    publicCode: string,
    archivedCategoryId: string | null,
  ): Promise<void> {
    try {
      // Rename channel
      const rawArchivedName = `fechado-${publicCode}`;
      const sanitizedArchivedName = sanitizeChannelName(rawArchivedName);
      await channel.setName(sanitizedArchivedName, 'VOOK Ticket: Channel Archived');

      // Move to archive category
      if (archivedCategoryId && channel.guild.channels.cache.has(archivedCategoryId)) {
        await channel.setParent(archivedCategoryId, {
          lockPermissions: false,
          reason: 'VOOK Ticket: Moved to Archived Category',
        });
      }

      // Remove creator's permission to view/write
      await channel.permissionOverwrites.delete(creatorUserId, 'VOOK Ticket: Archiving channel');

      logger.info({ channelId: channel.id }, 'Archived ticket channel successfully');
    } catch (err) {
      logger.error({ err, channelId: channel.id }, 'Error archiving ticket channel');
      throw err;
    }
  }

  /**
   * Deletes the ticket channel from Discord.
   */
  public static async deleteTicketChannel(channel: TextChannel): Promise<void> {
    try {
      await channel.delete('VOOK Ticket: Closing and deleting channel');
      logger.info({ channelId: channel.id }, 'Deleted ticket channel successfully');
    } catch (err) {
      logger.error({ err, channelId: channel.id }, 'Error deleting ticket channel');
      throw err;
    }
  }
}

export default TicketChannelService;
