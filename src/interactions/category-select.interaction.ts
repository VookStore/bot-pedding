import { StringSelectMenuInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } from 'discord.js';
import TicketRepository from '../repositories/ticket.repository';
import SettingsRepository from '../repositories/settings.repository';
import CategoryRepository from '../repositories/category.repository';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Handles the category select menu interaction: `ticket:create:category`
 */
export async function handleCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const categoryId = interaction.values[0];
  const userId = interaction.user.id;

  try {
    // 1. Fetch settings and check limits before opening the modal
    const settings = await SettingsRepository.getOrCreate(guildId);

    // Check if user reached their active ticket limit
    const activeCount = await TicketRepository.countActiveByUser(guildId, userId);
    if (activeCount >= settings.ticketLimitPerUser) {
      await sendErrorResponse(
        interaction,
        'Ticket já aberto',
        'Você já possui um atendimento em andamento neste servidor. Encerre o anterior para abrir um novo.',
        true,
      );
      return;
    }

    // Check category status
    const category = await CategoryRepository.getById(categoryId);
    if (!category || !category.active) {
      await sendErrorResponse(
        interaction,
        'Categoria indisponível',
        'Esta categoria de atendimento está temporariamente indisponível. Selecione outra opção ou procure a equipe.',
        true,
      );
      return;
    }

    // 2. Build the Subject Modal with V2 Components
    const modal = new ModalBuilder().setCustomId(`ticket:create:subject:${categoryId}`).setTitle('Abrir atendimento');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticketSubject')
      .setPlaceholder('Exemplo: orçamento para um bot personalizado')
      .setStyle(TextInputStyle.Short)
      .setMinLength(5)
      .setMaxLength(100)
      .setRequired(true);

    const label = new LabelBuilder()
      .setLabel('Assunto do atendimento')
      .setDescription('Resuma em poucas palavras o motivo do contato.')
      .setTextInputComponent(subjectInput);

    modal.addLabelComponents(label);

    // Show the modal to the user
    await interaction.showModal(modal);
  } catch {
    await sendErrorResponse(
      interaction,
      'Erro interno',
      'Não foi possível carregar o formulário. Tente novamente.',
      true,
    );
  }
}

export default handleCategorySelect;
