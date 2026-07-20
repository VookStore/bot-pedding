import {
  ChannelSelectMenuInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import SettingsRepository from '../repositories/settings.repository';
import CategoryRepository from '../repositories/category.repository';
import { sanitizeChannelName } from '../shared/utils/sanitize-channel-name';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Handles panel channel selection.
 */
export async function handlePanelChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const targetChannelId = interaction.values[0];

  await SettingsRepository.update(guildId, {
    panelChannelId: targetChannelId,
  });

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ CANAL DO PAINEL ATUALIZADO\n\n' +
          `O canal do painel de tickets foi definido para <#${targetChannelId}>.`,
      ),
    ),
  );

  await interaction.reply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/**
 * Handles log channel selection.
 */
export async function handleLogChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const targetChannelId = interaction.values[0];

  await SettingsRepository.update(guildId, {
    logChannelId: targetChannelId,
  });

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ CANAL DE LOGS ATUALIZADO\n\n' +
          `O canal de logs de encerramento foi definido para <#${targetChannelId}>.`,
      ),
    ),
  );

  await interaction.reply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/**
 * Handles visual settings modal submit.
 */
export async function handleVisualModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  const panelTitle = interaction.fields.getTextInputValue('panelTitle');
  const panelDescription = interaction.fields.getTextInputValue('panelDescription');
  const logoUrl = interaction.fields.getTextInputValue('logoUrl');
  const panelBannerUrl = interaction.fields.getTextInputValue('panelBannerUrl') || null;

  await SettingsRepository.update(guildId, {
    panelTitle,
    panelDescription,
    logoUrl,
    panelBannerUrl,
  });

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ VISUAL CONFIGURADO\n\n' + 'As configurações visuais do painel público foram atualizadas com sucesso.',
      ),
    ),
  );

  await interaction.reply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/**
 * Handles category creation modal submit.
 */
export async function handleCategoryCreateModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  const name = interaction.fields.getTextInputValue('catName').trim();
  const slug = sanitizeChannelName(interaction.fields.getTextInputValue('catSlug'));
  const emoji = interaction.fields.getTextInputValue('catEmoji').trim();
  const description = interaction.fields.getTextInputValue('catDescription').trim();

  // Validate duplicate slug
  const duplicate = await CategoryRepository.getBySlug(guildId, slug);
  if (duplicate) {
    await sendErrorResponse(
      interaction,
      'Slug duplicado',
      `Já existe uma categoria registrada com o slug \`${slug}\`. Por favor, escolha outro.`,
      true,
    );
    return;
  }

  // Fetch all categories to determine sort order
  const existing = await CategoryRepository.getAll(guildId);
  const nextOrder = existing.length;

  await CategoryRepository.create({
    guildId,
    name,
    slug,
    emoji,
    description,
    active: true,
    sortOrder: nextOrder,
    discordParentCategoryId: null,
    channelNamePattern: `ticket-${slug}-{code}`,
    openingMessage: `Seu atendimento de **${name}** foi iniciado. Descreva sua solicitação.`,
    bannerUrl: null,
  });

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ CATEGORIA CRIADA\n\n' +
          `A categoria **${name}** (${emoji}) foi cadastrada com sucesso e está pronta para uso!`,
      ),
    ),
  );

  await interaction.reply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/**
 * Handles dropdown select to target category configuration.
 */
export async function handleCategoryConfigSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const categoryId = interaction.values[0];

  if (categoryId === 'none') {
    await interaction.deferUpdate();
    return;
  }

  const category = await CategoryRepository.getById(categoryId);
  if (!category) {
    await sendErrorResponse(interaction, 'Não encontrada', 'Categoria não encontrada.', true);
    return;
  }

  const categories = await CategoryRepository.getAll(guildId);

  // Build the list text
  const catLines = categories
    .map((c) => {
      const isSelected = c.id === categoryId ? '👉 ' : '';
      const status = c.active ? '🟢 Ativa' : '🔴 Inativa';
      return `${isSelected}- **${c.name}** (\`${c.slug}\`) ${c.emoji}\n  Status: ${status}`;
    })
    .join('\n\n');

  const container = new ContainerBuilder();

  // 1. Header with details
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## 📂 CATEGORIA SELECIONADA: ${category.name} ${category.emoji}\n\n` +
          'Use os botões de ação abaixo para alterar as configurações desta categoria:\n\n' +
          catLines,
      ),
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Re-build selector to preserve navigation
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:config:cat:select')
    .setPlaceholder('Mudar categoria selecionada...');

  selectMenu.addOptions(
    categories.map((c) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(c.name)
        .setValue(c.id)
        .setDefault(c.id === categoryId)
        .setEmoji(c.emoji),
    ),
  );
  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(selectMenu));

  // Category Action Buttons with state injected in Custom ID
  const createButton = new ButtonBuilder()
    .setCustomId('ticket:config:cat:create')
    .setLabel('Criar Categoria')
    .setStyle(ButtonStyle.Success);

  const toggleButton = new ButtonBuilder()
    .setCustomId(`ticket:config:cat:toggle:${categoryId}`)
    .setLabel('Alternar Status')
    .setStyle(ButtonStyle.Secondary);

  const deleteButton = new ButtonBuilder()
    .setCustomId(`ticket:config:cat:delete:${categoryId}`)
    .setLabel('Excluir Categoria')
    .setStyle(ButtonStyle.Danger);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(createButton, toggleButton, deleteButton));

  await interaction.update({
    components: [container],
  });
}

/**
 * Handles Category Active Status Toggling.
 */
export async function handleCategoryToggle(interaction: ButtonInteraction, categoryId: string): Promise<void> {
  const category = await CategoryRepository.getById(categoryId);
  if (!category) {
    await sendErrorResponse(interaction, 'Não encontrada', 'Categoria não encontrada.', true);
    return;
  }

  // Toggle active status
  const nextStatus = !category.active;
  await CategoryRepository.update(categoryId, {
    active: nextStatus,
  });

  const statusText = nextStatus ? '🟢 Ativada' : '🔴 Desativada';

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ CATEGORIA ATUALIZADA\n\n' + `A categoria **${category.name}** foi definida como **${statusText}**.`,
      ),
    ),
  );

  await interaction.reply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/**
 * Handles Category Soft Deleting.
 */
export async function handleCategoryDelete(interaction: ButtonInteraction, categoryId: string): Promise<void> {
  const category = await CategoryRepository.getById(categoryId);
  if (!category) {
    await sendErrorResponse(interaction, 'Não encontrada', 'Categoria não encontrada.', true);
    return;
  }

  // Check if there are active open tickets in this category
  const activeTickets = await CategoryRepository.countActiveTickets(categoryId);
  if (activeTickets > 0) {
    await sendErrorResponse(
      interaction,
      'Não é possível excluir',
      `Existem ${activeTickets} tickets abertos vinculados a esta categoria. Conclua-os antes de excluir.`,
      true,
    );
    return;
  }

  // Soft delete category
  await CategoryRepository.softDelete(categoryId);

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ CATEGORIA EXCLUÍDA\n\n' + `A categoria **${category.name}** foi excluída com sucesso.`,
      ),
    ),
  );

  await interaction.reply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}
