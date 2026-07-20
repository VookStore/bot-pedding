import { Client, TextChannel, MessageFlags, AttachmentBuilder } from 'discord.js';
import SettingsRepository from '../repositories/settings.repository';
import buildCloseLogComponents from '../components/close-log.component';
import logger from '../logger/logger';

export class TicketLogService {
  /**
   * Dispatches the final ticket log to the configured log channel.
   * If transcript is local, attaches the HTML file directly.
   */
  public static async sendCloseLog(
    client: Client,
    guildId: string,
    data: {
      ticketCode: string;
      channelName: string;
      categoryName: string;
      subject: string;
      clientId: string;
      clientAvatarUrl: string;
      assignedId: string | null;
      closedById: string;
      additionalMembers: string[];
      openedAt: Date;
      closedAt: Date;
      closeReason: string;
      transcriptUrl: string | null;
      localTranscriptPath?: string; // If local mode
      localTranscriptBuffer?: Buffer; // Buffer containing the transcript
    },
  ): Promise<void> {
    try {
      const settings = await SettingsRepository.getOrCreate(guildId);
      const logChannelId = settings.logChannelId;

      if (!logChannelId) {
        logger.warn(
          { guildId, ticketCode: data.ticketCode },
          'No log channel configured for this server. Log not sent.',
        );
        return;
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn({ guildId }, 'Guild not found in client cache when sending log.');
        return;
      }

      const channel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.warn({ logChannelId, guildId }, 'Log channel not found or is not a text channel.');
        return;
      }

      // Build Components V2
      const { components } = buildCloseLogComponents(data);

      const messageOptions: {
        components: any[];
        flags: number;
        files?: any[];
      } = {
        components,
        flags: MessageFlags.IsComponentsV2,
      };

      // If transcript is local and buffer is provided, attach it as a file
      if (!data.transcriptUrl && data.localTranscriptBuffer) {
        const attachment = new AttachmentBuilder(data.localTranscriptBuffer, {
          name: `transcript-${data.ticketCode}.html`,
          description: `History for ticket ${data.ticketCode}`,
        });
        messageOptions.files = [attachment];
      }

      await channel.send(messageOptions);
      logger.info({ guildId, ticketCode: data.ticketCode }, 'Successfully sent final ticket log.');
    } catch (err) {
      logger.error({ err, guildId, ticketCode: data.ticketCode }, 'Failed to dispatch final ticket log');
    }
  }
}

export default TicketLogService;
