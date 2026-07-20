import {
  Client,
  Guild,
  User,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import logger from '../logger/logger';

export class TicketNotificationService {
  /**
   * Dispatches an ephemeral notification DM to the client when staff requests a response.
   * Returns true on success, false if DM is blocked or failed.
   */
  public static async sendResponseRequestDm(
    _client: Client,
    guild: Guild,
    clientUser: User,
    staffUser: User,
    data: {
      ticketCode: string;
      categoryName: string;
      subject: string;
      channelId: string;
    },
  ): Promise<boolean> {
    try {
      const ticketUrl = `https://discord.com/channels/${guild.id}/${data.channelId}`;

      // Build Components V2 Container
      const container = new ContainerBuilder();

      // 1. Header
      container.addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '## 🔔 A EQUIPE ESTÁ AGUARDANDO VOCÊ\n\n' +
              `Olá, <@${clientUser.id}>.\n\n` +
              `<@${staffUser.id}> enviou uma notificação porque sua resposta é necessária para continuar o atendimento \`${data.ticketCode}\`.`,
          ),
        ),
      );

      // 2. Details
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Servidor:** ${guild.name}\n` + `**Categoria:** ${data.categoryName}\n` + `**Assunto:** ${data.subject}`,
        ),
      );

      // 3. Separator & Action button
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));

      const linkButton = new ButtonBuilder().setLabel('Acessar ticket').setStyle(ButtonStyle.Link).setURL(ticketUrl);

      container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(linkButton));

      // Send DM
      const dmChannel = await clientUser.createDM();
      await dmChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      logger.info({ userId: clientUser.id, ticketCode: data.ticketCode }, 'Response request notification DM delivered');
      return true;
    } catch (err) {
      logger.warn(
        { err, userId: clientUser.id, ticketCode: data.ticketCode },
        'Failed to deliver response request notification DM (DM likely closed)',
      );
      return false;
    }
  }

  /**
   * Dispatches the final ticket summary DM to the client upon closure.
   */
  public static async sendCloseDm(
    clientUser: User,
    dmOptions: {
      components: ContainerBuilder[];
      files?: any[];
    },
  ): Promise<boolean> {
    try {
      const dmChannel = await clientUser.createDM();
      await dmChannel.send({
        ...dmOptions,
        flags: MessageFlags.IsComponentsV2,
      });
      logger.info({ userId: clientUser.id }, 'Ticket closure summary DM delivered');
      return true;
    } catch (err) {
      logger.warn({ err, userId: clientUser.id }, 'Failed to deliver ticket closure summary DM (DM likely closed)');
      return false;
    }
  }
}

export default TicketNotificationService;
