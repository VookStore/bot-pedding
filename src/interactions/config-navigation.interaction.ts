import {
  ButtonInteraction,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  RoleSelectMenuBuilder,
  TextChannel,
} from 'discord.js';
import SettingsRepository from '../repositories/settings.repository';
import CategoryRepository from '../repositories/category.repository';
import executeManageCategories from '../commands/ticket-categories/categories.command';
import executeConfigureTeam from '../commands/ticket-team/team.command';
import executeStatusCommand from '../commands/ticket-system/status.command';
import buildMainPanel from '../components/main-panel.component';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Routes setup panel buttons to their correct submenus or modals.
 */
export async function handleConfigNavigation(interaction: ButtonInteraction, action: string): Promise<void> {
  const guildId = interaction.guildId!;

  if (action === 'channels') {
    // Render Channel Selection Menu
    const container = new ContainerBuilder();
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ⚙️ CONFIGURAR CANAIS\n\n' +
            'Selecione os canais de texto correspondentes abaixo:\n' +
            '1. **Canal do Painel**: Onde o painel público de abertura de tickets será enviado.\n' +
            '2. **Canal de Logs**: Onde os históricos e logs de tickets fechados serão gravados.',
        ),
      ),
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    // Channel Select Menu for Panel Channel
    const panelMenu = new ChannelSelectMenuBuilder()
      .setCustomId('ticket:config:select-panel-channel')
      .setPlaceholder('Escolha o canal do painel público')
      .addChannelTypes(ChannelType.GuildText);

    // Channel Select Menu for Log Channel
    const logMenu = new ChannelSelectMenuBuilder()
      .setCustomId('ticket:config:select-log-channel')
      .setPlaceholder('Escolha o canal de logs de encerramento')
      .addChannelTypes(ChannelType.GuildText);

    container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(panelMenu));
    container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(logMenu));

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'categories') {
    // Delegate to executeManageCategories by converting interaction
    await executeManageCategories(interaction as any);
    return;
  }

  if (action === 'team') {
    // Delegate to executeConfigureTeam
    await executeConfigureTeam(interaction as any);
    return;
  }

  if (action === 'diagnostics') {
    // Delegate to executeStatusCommand
    await executeStatusCommand(interaction as any);
    return;
  }

  if (action === 'update-panel') {
    // Hot-update the public panel message
    const settings = await SettingsRepository.getOrCreate(guildId);
    if (!settings.panelChannelId || !settings.panelMessageId) {
      await sendErrorResponse(
        interaction,
        'Painel não enviado',
        'O painel público de atendimento ainda não foi enviado neste servidor. Use `/ticket-painel enviar` primeiro.',
        true,
      );
      return;
    }

    const channel = await interaction.guild!.channels.fetch(settings.panelChannelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) {
      await sendErrorResponse(interaction, 'Canal inválido', 'O canal do painel não foi encontrado.', true);
      return;
    }

    const message = await channel.messages.fetch(settings.panelMessageId).catch(() => null);
    if (!message) {
      await sendErrorResponse(
        interaction,
        'Mensagem não encontrada',
        'A mensagem original do painel foi deletada.',
        true,
      );
      return;
    }

    const activeCategories = await CategoryRepository.getActive(guildId);
    if (activeCategories.length === 0) {
      await sendErrorResponse(interaction, 'Erro', 'Não existem categorias ativas para exibir.', true);
      return;
    }

    const mainPanel = buildMainPanel({
      title: settings.panelTitle,
      description: settings.panelDescription,
      notice: settings.panelNotice,
      logoUrl: settings.logoUrl,
      bannerUrl: settings.panelBannerUrl,
      categories: activeCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        emoji: c.emoji,
      })),
    });

    await message.edit({
      components: [mainPanel],
    });

    await interaction.reply({
      components: [
        new ContainerBuilder().addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## ✅ Painel público atualizado com sucesso!'),
          ),
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'visual') {
    // Open visual customization Modal
    const settings = await SettingsRepository.getOrCreate(guildId);

    const modal = new ModalBuilder().setCustomId('ticket:config:visual-modal').setTitle('Configurar Visual do Painel');

    // Title Input
    const titleInput = new TextInputBuilder()
      .setCustomId('panelTitle')
      .setPlaceholder('## 📂 ATENDIMENTO VOOK')
      .setStyle(TextInputStyle.Short)
      .setValue(settings.panelTitle)
      .setMaxLength(100)
      .setRequired(true);

    const titleLabel = new LabelBuilder().setLabel('Título do painel').setTextInputComponent(titleInput);

    // Description Input
    const descInput = new TextInputBuilder()
      .setCustomId('panelDescription')
      .setPlaceholder('Explicação sobre como funciona o suporte...')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(settings.panelDescription)
      .setMaxLength(800)
      .setRequired(true);

    const descLabel = new LabelBuilder().setLabel('Descrição principal').setTextInputComponent(descInput);

    // Logo Input
    const logoInput = new TextInputBuilder()
      .setCustomId('logoUrl')
      .setPlaceholder('https://i.imgur.com/...png')
      .setStyle(TextInputStyle.Short)
      .setValue(settings.logoUrl)
      .setMaxLength(250)
      .setRequired(true);

    const logoLabel = new LabelBuilder().setLabel('URL da Logomarca (Thumbnail)').setTextInputComponent(logoInput);

    // Banner Input
    const bannerInput = new TextInputBuilder()
      .setCustomId('panelBannerUrl')
      .setPlaceholder('https://i.imgur.com/...png')
      .setStyle(TextInputStyle.Short)
      .setValue(settings.panelBannerUrl || '')
      .setMaxLength(250)
      .setRequired(false);

    const bannerLabel = new LabelBuilder()
      .setLabel('URL do Banner de Fundo (Opcional)')
      .setTextInputComponent(bannerInput);

    modal.addLabelComponents(titleLabel);
    modal.addLabelComponents(descLabel);
    modal.addLabelComponents(logoLabel);
    modal.addLabelComponents(bannerLabel);

    await interaction.showModal(modal);
  }
}

/**
 * Handles Category Destination Selection Step 1 (Selecting Category logical structure).
 */
export async function handleDestinationCategorySelect(interaction: any): Promise<void> {
  const categoryId = interaction.values[0];

  const category = await CategoryRepository.getById(categoryId);
  if (!category) {
    await sendErrorResponse(interaction, 'Erro', 'Categoria não encontrada no banco de dados.', true);
    return;
  }

  const container = new ContainerBuilder();
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## 📂 CONFIGURAR DESTINO: ${category.name}\n\n` +
          'Selecione a categoria de canal do Discord para onde os tickets deste motivo serão criados.',
      ),
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Channel Select Menu filtered to GuildCategory type
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`ticket:dest:select-channel:${categoryId}`)
    .setPlaceholder('Escolha a categoria Discord física')
    .addChannelTypes(ChannelType.GuildCategory);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(channelMenu));

  await interaction.update({
    components: [container],
  });
}

/**
 * Handles Category Destination Selection Step 2 (Selecting Physical Discord Category).
 */
export async function handleDestinationChannelSelect(interaction: any, categoryId: string): Promise<void> {
  const targetChannelId = interaction.values[0];
  const guild = interaction.guild!;

  // Verify target channel exists and is category
  const targetChannel = await guild.channels.fetch(targetChannelId).catch(() => null);
  if (!targetChannel || targetChannel.type !== ChannelType.GuildCategory) {
    await sendErrorResponse(
      interaction,
      'Erro',
      'A categoria selecionada é inválida ou não pôde ser encontrada.',
      true,
    );
    return;
  }

  // Update Database
  await CategoryRepository.update(categoryId, {
    discordParentCategoryId: targetChannelId,
  });

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ DESTINO VINCULADO\n\n' +
          `A categoria **${targetChannel.name}** foi configurada como destino padrão dos tickets desta categoria lógica.`,
      ),
    ),
  );

  await interaction.update({
    components: [successContainer],
  });
}

/**
 * Handles Category Staff Role Selection Step 1 (Selecting Category logical structure).
 */
export async function handleTeamCategorySelect(interaction: any): Promise<void> {
  const categoryId = interaction.values[0];

  const category = await CategoryRepository.getById(categoryId);
  if (!category) {
    await sendErrorResponse(interaction, 'Erro', 'Categoria não encontrada no banco de dados.', true);
    return;
  }

  const container = new ContainerBuilder();
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## 👥 CONFIGURAR CARGOS: ${category.name}\n\n` +
          'Selecione os cargos do Discord que terão permissões de atendimento. Você pode selecionar múltiplos cargos.',
      ),
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Role Select Menu
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(`ticket:team:select-roles:${categoryId}`)
    .setPlaceholder('Selecione os cargos autorizados')
    .setMinValues(1)
    .setMaxValues(10); // Permit multiple roles

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(roleMenu));

  await interaction.update({
    components: [container],
  });
}

/**
 * Handles Category Staff Role Selection Step 2 (Saving Role IDs).
 */
export async function handleTeamRolesSelect(interaction: any, categoryId: string): Promise<void> {
  const roleIds = interaction.values as string[];
  const guild = interaction.guild!;

  const category = await CategoryRepository.getById(categoryId);
  if (!category) {
    await sendErrorResponse(interaction, 'Erro', 'Categoria de atendimento não encontrada.', true);
    return;
  }

  const roleMappings = [];
  for (const rid of roleIds) {
    const role = guild.roles.cache.get(rid);
    if (role) {
      roleMappings.push({
        roleId: rid,
        roleNameSnapshot: role.name,
      });
    }
  }

  // Update Database
  await CategoryRepository.setRoles(categoryId, roleMappings);

  const rolesTextList = roleMappings.map((r) => `@${r.roleNameSnapshot}`).join(', ');

  const successContainer = new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## ✅ CARGOS VINCULADOS\n\n' +
          `Os cargos foram associados à categoria **${category.name}**:\n` +
          `**Cargos:** ${rolesTextList}`,
      ),
    ),
  );

  await interaction.update({
    components: [successContainer],
  });
}

/**
 * Handles Category Creation Button Trigger (Spawns category creation Modal).
 */
export async function handleCategoryCreateButton(interaction: any): Promise<void> {
  const modal = new ModalBuilder().setCustomId('ticket:config:cat:create-modal').setTitle('Criar categoria');

  // Name Input
  const nameInput = new TextInputBuilder()
    .setCustomId('catName')
    .setPlaceholder('Exemplo: Orçamento')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(40)
    .setRequired(true);

  const nameLabel = new LabelBuilder().setLabel('Nome da categoria').setTextInputComponent(nameInput);

  // Slug Input
  const slugInput = new TextInputBuilder()
    .setCustomId('catSlug')
    .setPlaceholder('exemplo-orcamento')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(30)
    .setRequired(true);

  const slugLabel = new LabelBuilder()
    .setLabel('Slug (Apenas letras minúsculas e hífens)')
    .setTextInputComponent(slugInput);

  // Emoji Input
  const emojiInput = new TextInputBuilder()
    .setCustomId('catEmoji')
    .setPlaceholder('🛒')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(true);

  const emojiLabel = new LabelBuilder().setLabel('Emoji sugerido').setTextInputComponent(emojiInput);

  // Description Input
  const descInput = new TextInputBuilder()
    .setCustomId('catDescription')
    .setPlaceholder('Descreva brevemente a finalidade desta categoria...')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(100)
    .setRequired(true);

  const descLabel = new LabelBuilder().setLabel('Descrição').setTextInputComponent(descInput);

  modal.addLabelComponents(nameLabel);
  modal.addLabelComponents(slugLabel);
  modal.addLabelComponents(emojiLabel);
  modal.addLabelComponents(descLabel);

  await interaction.showModal(modal);
}
