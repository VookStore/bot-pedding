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
 * Handles `/ticket-destinos configurar`
 */
export async function executeConfigureDestinations(interaction: ChatInputCommandInteraction): Promise<void> {
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
              '## ❌ Nenhuma categoria encontrada\n\nPor favor, crie pelo menos uma categoria antes de configurar destinos.',
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
        '## 📂 VINCULAR CATEGORIAS DISCORD\n\n' +
          'Vincule cada categoria lógica (ex. Orçamento) a uma categoria física de canais no seu servidor do Discord.\n\n' +
          '**Passo 1:** Selecione a categoria lógica abaixo.',
      ),
    ),
  );

  // 2. Select Menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:dest:select-category')
    .setPlaceholder('Escolha a categoria a vincular...');

  selectMenu.addOptions(
    categories.map((c) => {
      const parentName = c.discordParentCategoryId ? ` (Atual ID: ${c.discordParentCategoryId})` : '';
      return new StringSelectMenuOptionBuilder()
        .setLabel(c.name)
        .setValue(c.id)
        .setDescription(`Slug: ${c.slug}${parentName}`)
        .setEmoji(c.emoji);
    }),
  );

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(selectMenu));

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export default executeConfigureDestinations;
