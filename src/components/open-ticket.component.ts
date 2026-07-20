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
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';

interface OpenTicketPanelData {
  ticketId: string;
  ticketCode: string;
  categoryName: string;
  subject: string;
  clientId: string;
  assignedId: string | null;
  status: string;
  createdAt: Date;
  logoUrl: string;
  bannerUrl?: string | null;
}

/**
 * Builds the V2 Components layout representing the primary ticket control panel inside the channel.
 */
export function buildOpenTicketPanel(data: OpenTicketPanelData): ContainerBuilder {
  const container = new ContainerBuilder();

  // 1. Header Section
  const header = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '## 📂 ATENDIMENTO VOOK\n\n' +
        `Olá, <@${data.clientId}>. Seu atendimento foi criado com sucesso.\n\n` +
        'A equipe responsável já recebeu sua solicitação. Utilize este canal para fornecer todas as informações necessárias e aguarde até que um atendente assuma o ticket.',
    ),
  );

  if (data.logoUrl) {
    header.setThumbnailAccessory(new ThumbnailBuilder().setURL(data.logoUrl));
  }
  container.addSectionComponents(header);

  // 2. Separator with divider line
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Information Display
  const timestamp = Math.floor(data.createdAt.getTime() / 1000);
  const staffMention = data.assignedId ? `<@${data.assignedId}>` : 'Aguardando atendimento';
  const infoText =
    '### Informações do atendimento\n' +
    `**Categoria:** ${data.categoryName}\n` +
    `**Assunto:** ${data.subject}\n` +
    `**Ticket:** \`${data.ticketCode}\`\n` +
    `**Cliente:** <@${data.clientId}>\n` +
    `**Responsável:** ${staffMention}\n` +
    `**Status:** ${data.status}\n` +
    `**Criado em:** <t:${timestamp}:F>`;

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(infoText));

  // 4. Banner image (using MediaGallery V2)
  if (data.bannerUrl) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(data.bannerUrl)),
    );
  }

  // 5. Separator
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));

  // 6. Action buttons row (exactly four buttons)
  const isClaimed = !!data.assignedId;
  const claimButton = new ButtonBuilder()
    .setCustomId(`ticket:claim:${data.ticketId}`)
    .setLabel(isClaimed ? 'Ticket assumido' : 'Assumir Ticket')
    .setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setDisabled(isClaimed);

  const adminButton = new ButtonBuilder()
    .setCustomId(`ticket:admin:${data.ticketId}`)
    .setLabel('Painel Admin')
    .setStyle(ButtonStyle.Secondary);

  const notifyButton = new ButtonBuilder()
    .setCustomId(`ticket:notify:${data.ticketId}`)
    .setLabel('Notificar Cliente')
    .setStyle(ButtonStyle.Secondary);

  const closeButton = new ButtonBuilder()
    .setCustomId(`ticket:close:${data.ticketId}`)
    .setLabel('Finalizar Ticket')
    .setStyle(ButtonStyle.Danger);

  container.addActionRowComponents(
    new ActionRowBuilder<any>().addComponents(claimButton, adminButton, notifyButton, closeButton),
  );

  return container;
}

export default buildOpenTicketPanel;
