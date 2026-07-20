import {
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { isFounder } from '../../shared/guards/founder.guard';
import { isGuild } from '../../shared/guards/guild.guard';
import CategoryRepository from '../../repositories/category.repository';

/**
 * Handles `/ticket-categorias gerenciar`
 */
export async function executeManageCategories(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await isGuild(interaction))) return;
  if (!(await isFounder(interaction))) return;

  const guildId = interaction.guildId!;
  const categories = await CategoryRepository.getAll(guildId);

  // Build the list text
  const catLines =
    categories
      .map((c) => {
        const status = c.active ? '🟢 Ativa' : '🔴 Inativa';
        const parentId = c.discordParentCategoryId ? `<#${c.discordParentCategoryId}>` : '*Não vinculado*';
        return `- **${c.name}** (\`${c.slug}\`) ${c.emoji}\n  Status: ${status} | Destino: ${parentId}\n  Descrição: *${c.description}*`;
      })
      .join('\n\n') || '*Nenhuma categoria cadastrada.*';

  const container = new ContainerBuilder();

  // 1. Header & Category List
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## 📂 GERENCIAR CATEGORIAS\n\n' +
          'Abaixo estão listadas todas as categorias de atendimento cadastradas no servidor:\n\n' +
          catLines,
      ),
    ),
  );

  // 2. Separator
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Category Select Dropdown
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:config:cat:select')
    .setPlaceholder('Selecione uma categoria para ações...');

  if (categories.length > 0) {
    selectMenu.addOptions(
      categories.map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(c.name)
          .setValue(c.id)
          .setDescription(`Slug: ${c.slug}`)
          .setEmoji(c.emoji),
      ),
    );
  } else {
    selectMenu.setPlaceholder('Nenhuma categoria cadastrada');
    selectMenu.setDisabled(true);
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Vazio')
        .setValue('none')
        .setDescription('Crie uma categoria clicando no botão abaixo'),
    );
  }
  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(selectMenu));

  // 4. Action Buttons
  const createButton = new ButtonBuilder()
    .setCustomId('ticket:config:cat:create')
    .setLabel('Criar Categoria')
    .setStyle(ButtonStyle.Success);

  const toggleButton = new ButtonBuilder()
    .setCustomId('ticket:config:cat:toggle')
    .setLabel('Alternar Status')
    .setStyle(ButtonStyle.Secondary);

  const deleteButton = new ButtonBuilder()
    .setCustomId('ticket:config:cat:delete')
    .setLabel('Excluir Categoria')
    .setStyle(ButtonStyle.Danger);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(createButton, toggleButton, deleteButton));

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export default executeManageCategories;
