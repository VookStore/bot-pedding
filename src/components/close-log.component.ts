import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { formatDuration } from '../shared/utils/format-duration';

interface LogPayloadData {
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
}

/**
 * Builds the V2 message components layout for the final ticket log.
 */
export function buildCloseLogComponents(data: LogPayloadData): {
  components: ContainerBuilder[];
  actionRows?: ActionRowBuilder[];
} {
  const durationStr = formatDuration(data.openedAt, data.closedAt);
  const openTimestamp = Math.floor(data.openedAt.getTime() / 1000);
  const closeTimestamp = Math.floor(data.closedAt.getTime() / 1000);

  const container = new ContainerBuilder();

  // 1. Header with Client Avatar Thumbnail
  const headerSection = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## 📁 TICKET FINALIZADO'),
  );

  if (data.clientAvatarUrl) {
    headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(data.clientAvatarUrl));
  }
  container.addSectionComponents(headerSection);

  // 2. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Identification
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Identificação\n' +
        `**Ticket:** \`${data.ticketCode}\`\n` +
        `**Canal:** #${data.channelName}\n` +
        `**Categoria:** ${data.categoryName}\n` +
        `**Assunto:** ${data.subject}`,
    ),
  );

  // 4. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 5. Participants
  const staffMention = data.assignedId ? `<@${data.assignedId}>` : 'Não assumido';
  const membersList =
    data.additionalMembers.length > 0 ? data.additionalMembers.map((id) => `<@${id}>`).join(', ') : 'Nenhum';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Participantes\n' +
        `**Cliente:** <@${data.clientId}>\n` +
        `**Responsável:** ${staffMention}\n` +
        `**Fechado por:** <@${data.closedById}>\n` +
        `**Membros adicionais:** ${membersList}`,
    ),
  );

  // 6. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 7. Period
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Período\n' +
        `**Aberto em:** <t:${openTimestamp}:F>\n` +
        `**Finalizado em:** <t:${closeTimestamp}:F>\n` +
        `**Duração:** ${durationStr}`,
    ),
  );

  // 8. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 9. Conclusion
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Conclusão\n${data.closeReason}`));

  // 10. Link Button (if public transcript URL exists)
  if (data.transcriptUrl) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    const transcriptButton = new ButtonBuilder()
      .setLabel('Ver transcript')
      .setStyle(ButtonStyle.Link)
      .setURL(data.transcriptUrl);

    container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(transcriptButton));
  }

  return { components: [container] };
}
export default buildCloseLogComponents;
