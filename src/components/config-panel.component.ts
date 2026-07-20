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

interface ConfigPanelData {
  enabled: boolean;
  panelChannelId: string | null;
  logChannelId: string | null;
  activeCategoriesCount: number;
  openTicketsCount: number;
  closeMode: string;
  ticketLimitPerUser: number;
}

/**
 * Builds the V2 Components layout representing the founder config control center.
 */
export function buildConfigPanel(data: ConfigPanelData): ContainerBuilder {
  const container = new ContainerBuilder();

  const statusText = data.enabled ? '🟢 Ativo' : '🔴 Inativo';
  const panelChanText = data.panelChannelId ? `<#${data.panelChannelId}>` : '*Não configurado*';
  const logChanText = data.logChannelId ? `<#${data.logChannelId}>` : '*Não configurado*';
  const modeText = data.closeMode === 'archive' ? '📁 Arquivar' : '❌ Excluir';

  // 1. Header Section
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ⚙️ CONFIGURAÇÃO DE TICKETS\n\n' +
          `**Sistema:** ${statusText}\n` +
          `**Canal do painel:** ${panelChanText}\n` +
          `**Canal de logs:** ${logChanText}\n` +
          `**Categorias ativas:** ${data.activeCategoriesCount}\n` +
          `**Tickets abertos:** ${data.openTicketsCount}\n` +
          `**Modo de encerramento:** ${modeText}\n` +
          `**Limite por usuário:** ${data.ticketLimitPerUser}`,
      ),
    ),
  );

  // 2. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Navigation Buttons Row 1
  const channelsButton = new ButtonBuilder()
    .setCustomId('ticket:config:nav:channels')
    .setLabel('Configurar canais')
    .setStyle(ButtonStyle.Primary);

  const categoriesButton = new ButtonBuilder()
    .setCustomId('ticket:config:nav:categories')
    .setLabel('Gerenciar categorias')
    .setStyle(ButtonStyle.Primary);

  const teamButton = new ButtonBuilder()
    .setCustomId('ticket:config:nav:team')
    .setLabel('Configurar equipe')
    .setStyle(ButtonStyle.Primary);

  container.addActionRowComponents(
    new ActionRowBuilder<any>().addComponents(channelsButton, categoriesButton, teamButton),
  );

  // 4. Navigation Buttons Row 2
  const visualButton = new ButtonBuilder()
    .setCustomId('ticket:config:nav:visual')
    .setLabel('Editar visual')
    .setStyle(ButtonStyle.Secondary);

  const updatePanelButton = new ButtonBuilder()
    .setCustomId('ticket:config:nav:update-panel')
    .setLabel('Atualizar painel')
    .setStyle(ButtonStyle.Success);

  const diagnosticsButton = new ButtonBuilder()
    .setCustomId('ticket:config:nav:diagnostics')
    .setLabel('Ver diagnóstico')
    .setStyle(ButtonStyle.Secondary);

  container.addActionRowComponents(
    new ActionRowBuilder<any>().addComponents(visualButton, updatePanelButton, diagnosticsButton),
  );

  return container;
}

export default buildConfigPanel;
