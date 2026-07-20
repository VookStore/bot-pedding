import {
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { isFounder } from '../../shared/guards/founder.guard';
import { isGuild } from '../../shared/guards/guild.guard';
import CategoryRepository from '../../repositories/category.repository';

/**
 * Handles `/ticket-equipe configurar`
 */
export async function executeConfigureTeam(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await isGuild(interaction))) return;
  if (!(await isFounder(interaction))) return;

  const guildId = interaction.guildId!;
  const categories = await CategoryRepository.getAll(guildId);

  if (categories.length === 0) {
    await interaction.reply({
      components: [
        new ContainerBuilder().addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              '## ❌ Nenhuma categoria encontrada\n\nPor favor, crie pelo menos uma categoria antes de configurar os cargos da equipe.',
            ),
          ),
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const container = new ContainerBuilder();

  // 1. Header
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## 👥 CONFIGURAR EQUIPE POR CATEGORIA\n\n' +
          'Associe os cargos do Discord que terão permissão para visualizar, assumir e gerenciar tickets de uma categoria.\n\n' +
          '**Passo 1:** Selecione a categoria lógica abaixo.',
      ),
    ),
  );

  // 2. Dropdown Selector
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:team:select-category')
    .setPlaceholder('Escolha a categoria para configurar equipe...');

  selectMenu.addOptions(
    categories.map((c) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(c.name)
        .setValue(c.id)
        .setDescription(`Slug: ${c.slug}`)
        .setEmoji(c.emoji),
    ),
  );

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(selectMenu));

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export default executeConfigureTeam;
