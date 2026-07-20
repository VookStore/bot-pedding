import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

interface DmPayloadData {
  clientId: string;
  staffId: string;
  guildName: string;
  ticketCode: string;
  categoryName: string;
  subject: string;
  openedAt: Date;
  closedAt: Date;
  closeReason: string;
  transcriptUrl: string | null;
}

/**
 * Builds the V2 message components layout for the client resolution DM.
 */
export function buildCloseDmComponents(data: DmPayloadData): {
  components: ContainerBuilder[];
} {
  const openTimestamp = Math.floor(data.openedAt.getTime() / 1000);
  const closeTimestamp = Math.floor(data.closedAt.getTime() / 1000);

  const container = new ContainerBuilder();

  // 1. Header Section
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ ATENDIMENTO FINALIZADO\n\n' +
          `Olá, <@${data.clientId}>. Seu atendimento foi finalizado por <@${data.staffId}> no servidor **${data.guildName}**.`,
      ),
    ),
  );

  // 2. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Summary
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Resumo\n' +
        `**Ticket:** \`${data.ticketCode}\`\n` +
        `**Categoria:** ${data.categoryName}\n` +
        `**Assunto:** ${data.subject}\n` +
        `**Aberto em:** <t:${openTimestamp}:F>\n` +
        `**Finalizado em:** <t:${closeTimestamp}:F>`,
    ),
  );

  // 4. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 5. Conclusion
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Conclusão\n${data.closeReason}`));

  // 6. Link Button (if public transcript URL exists)
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

export default buildCloseDmComponents;
