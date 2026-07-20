import {
  Guild,
  GuildMember,
  TextChannel,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { Ticket } from '@prisma/client';
import SettingsRepository from '../repositories/settings.repository';
import CategoryRepository from '../repositories/category.repository';
import TicketRepository, { TicketStatus } from '../repositories/ticket.repository';
import AuditRepository from '../repositories/audit.repository';
import TicketChannelService from './ticket-channel.service';
import TicketLockService from './ticket-lock.service';
import TicketNotificationService from './ticket-notification.service';
import TicketTranscriptService from './ticket-transcript.service';
import TicketLogService from './ticket-log.service';
import buildOpenTicketPanel from '../components/open-ticket.component';
import buildCloseDmComponents from '../components/close-dm.component';
import { generateShortId } from '../shared/utils/sanitize-channel-name';
import logger from '../logger/logger';
import env from '../config/env';

export class TicketService {
  /**
   * Orchestrates the ticket creation process.
   */
  public static async openTicket(
    guild: Guild,
    creatorMember: GuildMember,
    categoryId: string,
    subject: string,
  ): Promise<{ ticket: Ticket; channel: TextChannel } | null> {
    const userId = creatorMember.id;
    const guildId = guild.id;
    const lockKey = `lock:create:${guildId}:${userId}`;

    // Acquire creation lock
    const locked = await TicketLockService.acquireLock(lockKey, 8000);
    if (!locked) {
      throw new Error('TICKET_ALREADY_OPEN');
    }

    try {
      // 1. Fetch settings and active category
      const settings = await SettingsRepository.getOrCreate(guildId);
      if (!settings.enabled) {
        throw new Error('SYSTEM_DISABLED');
      }

      const category = await CategoryRepository.getById(categoryId);
      if (!category || !category.active) {
        throw new Error('CATEGORY_UNAVAILABLE');
      }

      // Check Discord parent category link
      if (!category.discordParentCategoryId) {
        throw new Error('DESTINATION_NOT_CONFIGURED');
      }

      // Check total active tickets count in server
      const totalActive = await TicketRepository.countTotalActive(guildId);
      if (totalActive >= settings.totalOpenLimit) {
        throw new Error('TOTAL_LIMIT_REACHED');
      }

      // Check user specific ticket limit
      const userActive = await TicketRepository.countActiveByUser(guildId, userId);
      if (userActive >= settings.ticketLimitPerUser) {
        throw new Error('USER_LIMIT_REACHED');
      }

      // 2. Validate Bot permissions
      const me = guild.members.me;
      if (!me) {
        throw new Error('INTERNAL_ERROR');
      }

      const requiredPermissions = [
        'ViewChannel',
        'SendMessages',
        'ManageChannels',
        'ManageMessages',
        'ReadMessageHistory',
        'AttachFiles',
      ];
      const botPermissions = me.permissions;
      for (const perm of requiredPermissions) {
        if (!botPermissions.has(perm as never)) {
          throw new Error('MISSING_BOT_PERMISSIONS');
        }
      }

      // 3. Generate short public code
      let publicCode = generateShortId(6);
      let attempts = 0;
      // Guarantee uniqueness of publicCode
      while (attempts < 5) {
        const dup = await TicketRepository.getByPublicCode(guildId, publicCode);
        if (!dup) break;
        publicCode = generateShortId(6);
        attempts++;
      }

      // Fetch staff roles to apply overrides
      const staffRoles = await CategoryRepository.getRoles(categoryId);
      const staffRoleIds = staffRoles.map((r) => r.roleId);

      // 4. Create Discord Text Channel
      const channel = await TicketChannelService.createTicketChannel(
        guild,
        creatorMember,
        category.slug,
        publicCode,
        category.discordParentCategoryId,
        staffRoleIds,
      );

      // 5. Persist Ticket in Database
      const channelName = channel.name;
      const ticket = await TicketRepository.create({
        publicCode,
        guildId,
        channelId: channel.id,
        categoryId,
        createdByUserId: userId,
        subject,
        channelName,
        status: TicketStatus.OPEN,
      });

      // 6. Log Audit action
      await AuditRepository.logAction(guildId, ticket.id, 'TICKET_CREATED', userId, null, {
        subject,
        categorySlug: category.slug,
        channelName,
      });

      // 7. Send the V2 Open Ticket Dashboard Message
      const dashboardContainer = buildOpenTicketPanel({
        ticketId: ticket.id,
        ticketCode: publicCode,
        categoryName: category.name,
        subject,
        clientId: userId,
        assignedId: null,
        status: 'Aberto',
        createdAt: ticket.createdAt,
        logoUrl: settings.logoUrl,
        bannerUrl: category.bannerUrl || settings.ticketBannerUrl,
      });

      const dashboardMsg = await channel.send({
        components: [dashboardContainer],
        flags: MessageFlags.IsComponentsV2,
      });

      // Save the message ID for edits on claims/transfers
      await TicketRepository.update(ticket.id, {
        panelMessageId: dashboardMsg.id,
      });

      // Optional opening message
      if (category.openingMessage) {
        await channel.send({
          components: [
            new ContainerBuilder().addSectionComponents(
              new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(category.openingMessage),
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      return { ticket, channel };
    } finally {
      // Release lock
      await TicketLockService.releaseLock(lockKey);
    }
  }

  /**
   * Claims a ticket for a staff member.
   */
  public static async claimTicket(ticketId: string, staffMember: GuildMember): Promise<void> {
    const lockKey = `lock:claim:${ticketId}`;
    const locked = await TicketLockService.acquireLock(lockKey, 5000);
    if (!locked) {
      throw new Error('CLAIM_LOCKED');
    }

    try {
      const ticket = await TicketRepository.getById(ticketId);
      if (!ticket) throw new Error('TICKET_NOT_FOUND');
      if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_NOT_OPEN');

      // Update Database
      await TicketRepository.update(ticketId, {
        assignedToUserId: staffMember.id,
        claimedAt: new Date(),
      });

      // Log Audit
      await AuditRepository.logAction(ticket.guildId, ticketId, 'TICKET_CLAIMED', staffMember.id);

      // Fetch Guild settings
      const settings = await SettingsRepository.getOrCreate(ticket.guildId);

      // Edit dashboard message to update staff name & disable claim button
      const guild = staffMember.guild;
      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (channel && channel instanceof TextChannel && ticket.panelMessageId) {
        const dashboardMsg = await channel.messages.fetch(ticket.panelMessageId).catch(() => null);
        if (dashboardMsg) {
          const updatedPanel = buildOpenTicketPanel({
            ticketId,
            ticketCode: ticket.publicCode,
            categoryName: ticket.category.name,
            subject: ticket.subject,
            clientId: ticket.createdByUserId,
            assignedId: staffMember.id,
            status: 'Aberto (Em atendimento)',
            createdAt: ticket.createdAt,
            logoUrl: settings.logoUrl,
            bannerUrl: ticket.category.bannerUrl || settings.ticketBannerUrl,
          });

          await dashboardMsg.edit({
            components: [updatedPanel],
          });
        }

        // Send confirmation text in channel
        const claimAlert = new ContainerBuilder().addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Atendimento assumido\n\n<@${staffMember.id}> assumiu este atendimento e será o responsável principal pela solicitação.`,
            ),
          ),
        );

        await channel.send({
          components: [claimAlert],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } finally {
      await TicketLockService.releaseLock(lockKey);
    }
  }

  /**
   * Transfer responsibility of the ticket to a new staff member.
   */
  public static async transferTicket(
    ticketId: string,
    newStaffMember: GuildMember,
    actorMember: GuildMember,
  ): Promise<void> {
    const ticket = await TicketRepository.getById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');
    if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_NOT_OPEN');

    // Update DB
    await TicketRepository.update(ticketId, {
      assignedToUserId: newStaffMember.id,
    });

    // Log Audit
    await AuditRepository.logAction(
      ticket.guildId,
      ticketId,
      'RESPONSIBLE_TRANSFERRED',
      actorMember.id,
      newStaffMember.id,
    );

    // Fetch Guild Settings
    const settings = await SettingsRepository.getOrCreate(ticket.guildId);

    // Update Dashboard message
    const guild = actorMember.guild;
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (channel && channel instanceof TextChannel && ticket.panelMessageId) {
      const dashboardMsg = await channel.messages.fetch(ticket.panelMessageId).catch(() => null);
      if (dashboardMsg) {
        const updatedPanel = buildOpenTicketPanel({
          ticketId,
          ticketCode: ticket.publicCode,
          categoryName: ticket.category.name,
          subject: ticket.subject,
          clientId: ticket.createdByUserId,
          assignedId: newStaffMember.id,
          status: 'Aberto (Em atendimento)',
          createdAt: ticket.createdAt,
          logoUrl: settings.logoUrl,
          bannerUrl: ticket.category.bannerUrl || settings.ticketBannerUrl,
        });

        await dashboardMsg.edit({
          components: [updatedPanel],
        });
      }

      // Send transfer log message
      const transferAlert = new ContainerBuilder().addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Atendimento transferido\n\n<@${newStaffMember.id}> foi definido como o novo responsável por este atendimento por <@${actorMember.id}>.`,
          ),
        ),
      );

      await channel.send({
        components: [transferAlert],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }

  /**
   * Add a member to a ticket channel.
   */
  public static async addMember(ticketId: string, targetMember: GuildMember, actorMember: GuildMember): Promise<void> {
    const ticket = await TicketRepository.getById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');
    if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_NOT_OPEN');

    const guild = actorMember.guild;
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) throw new Error('CHANNEL_NOT_FOUND');

    // Check if user already exists in ticket members
    const exists = ticket.members.some((m) => m.userId === targetMember.id);
    if (exists || targetMember.id === ticket.createdByUserId) {
      throw new Error('MEMBER_ALREADY_EXISTS');
    }

    // Apply overwrite permissions
    await channel.permissionOverwrites.create(targetMember.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });

    // Save DB
    await TicketRepository.addMember(ticketId, targetMember.id, actorMember.id);

    // Audit Log
    await AuditRepository.logAction(ticket.guildId, ticketId, 'MEMBER_ADDED', actorMember.id, targetMember.id);

    // Send channel announcement
    const addAlert = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `<@${targetMember.id}> foi adicionado ao atendimento por <@${actorMember.id}>.`,
        ),
      ),
    );

    await channel.send({
      components: [addAlert],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  /**
   * Remove a member from the ticket channel.
   */
  public static async removeMember(ticketId: string, targetUserId: string, actorMember: GuildMember): Promise<void> {
    const ticket = await TicketRepository.getById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');
    if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_NOT_OPEN');

    // Assert that we don't remove creator or assignee
    if (targetUserId === ticket.createdByUserId) throw new Error('CANNOT_REMOVE_CREATOR');
    if (targetUserId === ticket.assignedToUserId) throw new Error('CANNOT_REMOVE_ASSIGNEE');

    const guild = actorMember.guild;
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) throw new Error('CHANNEL_NOT_FOUND');

    // Remove permissions overwrite
    await channel.permissionOverwrites.delete(targetUserId).catch(() => null);

    // Delete DB
    await TicketRepository.removeMember(ticketId, targetUserId);

    // Audit Log
    await AuditRepository.logAction(ticket.guildId, ticketId, 'MEMBER_REMOVED', actorMember.id, targetUserId);

    // Send channel announcement
    const removeAlert = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `<@${targetUserId}> foi removido deste atendimento por <@${actorMember.id}>.`,
        ),
      ),
    );

    await channel.send({
      components: [removeAlert],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  /**
   * Rename the ticket text channel.
   */
  public static async renameChannel(ticketId: string, newName: string, actorMember: GuildMember): Promise<void> {
    const ticket = await TicketRepository.getById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');
    if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_NOT_OPEN');

    const guild = actorMember.guild;
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) throw new Error('CHANNEL_NOT_FOUND');

    // Rename on Discord
    await channel.setName(newName);

    // Update DB
    await TicketRepository.update(ticketId, {
      channelName: newName,
    });

    // Audit Log
    await AuditRepository.logAction(ticket.guildId, ticketId, 'CHANNEL_RENAMED', actorMember.id, null, {
      newName,
    });
  }

  /**
   * Triggers a response request notification both in-channel and via DM to client.
   */
  public static async notifyClient(
    ticketId: string,
    actorMember: GuildMember,
  ): Promise<{ success: boolean; dmSent: boolean }> {
    const ticket = await TicketRepository.getById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');
    if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_NOT_OPEN');

    const guild = actorMember.guild;
    const settings = await SettingsRepository.getOrCreate(ticket.guildId);

    // Check rate limit (notification cooldown)
    const now = Date.now();
    const lastNotified = ticket.lastNotificationAt ? ticket.lastNotificationAt.getTime() : 0;
    const elapsedSeconds = (now - lastNotified) / 1000;

    if (elapsedSeconds < settings.notificationCooldownSeconds) {
      throw new Error('COOLDOWN_ACTIVE');
    }

    // Update notification timestamp
    await TicketRepository.update(ticketId, {
      lastNotificationAt: new Date(),
    });

    // Log Audit
    await AuditRepository.logAction(ticket.guildId, ticketId, 'CLIENT_NOTIFIED', actorMember.id);

    // 1. Send channel notification
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (channel && channel instanceof TextChannel) {
      const ticketUrl = `https://discord.com/channels/${guild.id}/${channel.id}`;

      const notifyAlert = new ContainerBuilder().addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### 🔔 Cliente notificado\n\n<@${ticket.createdByUserId}>, <@${actorMember.id}> está aguardando sua resposta neste atendimento.`,
          ),
        ),
      );

      notifyAlert.addActionRowComponents(
        new ActionRowBuilder<any>().addComponents(
          new ButtonBuilder().setLabel('Abrir atendimento').setStyle(ButtonStyle.Link).setURL(ticketUrl),
        ),
      );

      await channel.send({
        components: [notifyAlert],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 2. Dispatch DM to client
    const clientUser = await actorMember.client.users.fetch(ticket.createdByUserId).catch(() => null);
    let dmSent = false;
    if (clientUser) {
      dmSent = await TicketNotificationService.sendResponseRequestDm(
        actorMember.client,
        guild,
        clientUser,
        actorMember.user,
        {
          ticketCode: ticket.publicCode,
          categoryName: ticket.category.name,
          subject: ticket.subject,
          channelId: ticket.channelId,
        },
      );

      if (!dmSent) {
        await AuditRepository.logAction(
          ticket.guildId,
          ticketId,
          'CLIENT_DM_FAILED',
          actorMember.id,
          ticket.createdByUserId,
        );
      }
    }

    return { success: true, dmSent };
  }

  /**
   * Finalizes and closes the ticket. Generates transcripts, dispatches summary logs, DMs client, and deletes/archives channel.
   */
  public static async closeTicket(ticketId: string, closeReason: string, actorMember: GuildMember): Promise<void> {
    const lockKey = `lock:close:${ticketId}`;
    const locked = await TicketLockService.acquireLock(lockKey, 30000); // 30s lock for complete closing flow
    if (!locked) {
      throw new Error('CLOSE_LOCKED');
    }

    try {
      const ticket = await TicketRepository.getById(ticketId);
      if (!ticket) throw new Error('TICKET_NOT_FOUND');
      if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.CLOSING) {
        throw new Error('TICKET_ALREADY_CLOSED');
      }

      // Update status to CLOSING to block further actions
      await TicketRepository.update(ticketId, {
        status: TicketStatus.CLOSING,
      });

      // Log closure start
      await AuditRepository.logAction(ticket.guildId, ticketId, 'TICKET_CLOSE_STARTED', actorMember.id);

      const guild = actorMember.guild;
      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error('CHANNEL_NOT_FOUND');
      }

      // 1. Disable dashboard buttons in channel
      if (ticket.panelMessageId) {
        const dashboardMsg = await channel.messages.fetch(ticket.panelMessageId).catch(() => null);
        if (dashboardMsg) {
          // Construct disabled dashboard panel
          const settings = await SettingsRepository.getOrCreate(ticket.guildId);
          const closedPanel = buildOpenTicketPanel({
            ticketId,
            ticketCode: ticket.publicCode,
            categoryName: ticket.category.name,
            subject: ticket.subject,
            clientId: ticket.createdByUserId,
            assignedId: ticket.assignedToUserId,
            status: 'Finalizado (Encerrando)',
            createdAt: ticket.createdAt,
            logoUrl: settings.logoUrl,
            bannerUrl: ticket.category.bannerUrl || settings.ticketBannerUrl,
          });

          // Disable all buttons in action rows
          closedPanel.components.forEach((comp: any) => {
            if (comp.type === 1 || (comp.components && comp.components[0]?.type === 2)) {
              comp.components.forEach((btn: any) => {
                btn.disabled = true;
              });
            }
          });

          await dashboardMsg
            .edit({
              components: [closedPanel],
            })
            .catch((err) => logger.error(err, 'Failed to disable dashboard buttons'));
        }
      }

      // 2. Fetch transcript metadata references
      const creatorUser = await actorMember.client.users.fetch(ticket.createdByUserId).catch(() => null);
      const clientTag = creatorUser ? creatorUser.tag : ticket.createdByUserId;
      const clientAvatar = creatorUser ? creatorUser.displayAvatarURL({ size: 128 }) : '';

      const staffUser = ticket.assignedToUserId
        ? await actorMember.client.users.fetch(ticket.assignedToUserId).catch(() => null)
        : null;
      const assignedTag = staffUser ? staffUser.tag : 'Não assumido';

      const closedByTag = actorMember.user.tag;
      const openedAt = ticket.openedAt;
      const closedAt = new Date();

      // 3. Generate HTML Transcript
      let transcriptUrl: string | null = null;
      let transcriptStorageKey: string | null = null;
      let transcriptBuffer: Buffer;

      try {
        const res = await TicketTranscriptService.processTranscript(channel, {
          ticketCode: ticket.publicCode,
          serverName: guild.name,
          channelName: channel.name,
          categoryName: ticket.category.name,
          subject: ticket.subject,
          clientTag,
          assignedTag,
          closedByTag,
          openedAt,
          closedAt,
          closeReason,
        });

        transcriptUrl = res.transcriptUrl;
        transcriptStorageKey = res.transcriptStorageKey;
        transcriptBuffer = res.buffer;

        await AuditRepository.logAction(ticket.guildId, ticketId, 'TRANSCRIPT_CREATED', actorMember.id, null, {
          storageMode: env.TRANSCRIPT_STORAGE_MODE,
          hasUrl: !!transcriptUrl,
        });
      } catch (tErr) {
        logger.error(tErr, 'Failed to generate transcript');
        await AuditRepository.logAction(ticket.guildId, ticketId, 'TRANSCRIPT_FAILED', actorMember.id);
        // Create an empty fallback buffer to avoid crashes
        transcriptBuffer = Buffer.from('Failed to generate transcript', 'utf-8');
      }

      // 4. Update Ticket status to CLOSED in DB
      await TicketRepository.update(ticketId, {
        status: TicketStatus.CLOSED,
        closedAt,
        closedByUserId: actorMember.id,
        closeReason,
        transcriptUrl,
        transcriptStorageKey,
      });

      await AuditRepository.logAction(ticket.guildId, ticketId, 'TICKET_CLOSED', actorMember.id);

      // 5. Send DM to client
      if (creatorUser) {
        const { components: dmComponents } = buildCloseDmComponents({
          clientId: ticket.createdByUserId,
          staffId: actorMember.id,
          guildName: guild.name,
          ticketCode: ticket.publicCode,
          categoryName: ticket.category.name,
          subject: ticket.subject,
          openedAt,
          closedAt,
          closeReason,
          transcriptUrl,
        });

        const dmOptions: any = { components: dmComponents };
        if (!transcriptUrl && transcriptBuffer) {
          dmOptions.files = [
            {
              attachment: transcriptBuffer,
              name: `transcript-${ticket.publicCode}.html`,
            },
          ];
        }

        const dmSent = await TicketNotificationService.sendCloseDm(creatorUser, dmOptions);
        if (!dmSent) {
          await AuditRepository.logAction(
            ticket.guildId,
            ticketId,
            'CLIENT_DM_FAILED',
            actorMember.id,
            ticket.createdByUserId,
          );
        }
      }

      // 6. Send Close Log to staff log channel
      const addedMembers = ticket.members.map((m) => m.userId);
      await TicketLogService.sendCloseLog(actorMember.client, ticket.guildId, {
        ticketCode: ticket.publicCode,
        channelName: ticket.channelName,
        categoryName: ticket.category.name,
        subject: ticket.subject,
        clientId: ticket.createdByUserId,
        clientAvatarUrl: clientAvatar,
        assignedId: ticket.assignedToUserId,
        closedById: actorMember.id,
        additionalMembers: addedMembers,
        openedAt,
        closedAt,
        closeReason,
        transcriptUrl,
        localTranscriptBuffer: transcriptBuffer,
      });

      // 7. Execute Post-Close Strategy
      const settings = await SettingsRepository.getOrCreate(ticket.guildId);

      if (settings.closeMode === 'archive') {
        // Archive Strategy
        await TicketChannelService.archiveTicketChannel(
          channel,
          ticket.createdByUserId,
          ticket.publicCode,
          settings.archivedCategoryId,
        );
        await AuditRepository.logAction(ticket.guildId, ticketId, 'CHANNEL_ARCHIVED', actorMember.id);
      } else {
        // Delete Strategy: Wait delay delay then delete
        const deleteDelay = settings.deleteDelaySeconds * 1000;

        // Send delayed deletion notice
        const deleteNotice = new ContainerBuilder().addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Atendimento encerrado\n\nEste canal será excluído permanentemente em **${settings.deleteDelaySeconds} segundos**.`,
            ),
          ),
        );

        await channel.send({
          components: [deleteNotice],
          flags: MessageFlags.IsComponentsV2,
        });

        setTimeout(async () => {
          await TicketChannelService.deleteTicketChannel(channel).catch((err) =>
            logger.error(err, 'Failed to execute channel deletion after close delay'),
          );
          await AuditRepository.logAction(ticket.guildId, ticketId, 'CHANNEL_DELETED', actorMember.id);
        }, deleteDelay);
      }
    } finally {
      await TicketLockService.releaseLock(lockKey);
    }
  }
}

export default TicketService;
