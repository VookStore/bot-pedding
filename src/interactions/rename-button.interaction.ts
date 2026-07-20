import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  GuildMember,
} from 'discord.js';
import TicketRepository from '../repositories/ticket.repository';
import TicketPermissionService from '../services/ticket-permission.service';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Handles rename channel button click inside the admin panel: `ticket:admin:rename:{ticketId}`
 */
export async function handleRenameButton(interaction: ButtonInteraction, ticketId: string): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  // 1. Fetch ticket to validate permission
  const ticket = await TicketRepository.getById(ticketId);
  if (!ticket) {
    await sendErrorResponse(interaction, 'Não encontrado', 'Este ticket não foi encontrado.', true);
    return;
  }

  // 2. Validate permission
  const hasPerm = await TicketPermissionService.canManageTicket(member, ticket);
  if (!hasPerm) {
    await sendErrorResponse(
      interaction,
      'Acesso negado',
      'Você não possui permissão para utilizar esta ferramenta de atendimento.',
      true,
    );
    return;
  }

  try {
    // 3. Build Modal
    const modal = new ModalBuilder()
      .setCustomId(`ticket:admin:rename-modal:${ticketId}`)
      .setTitle('Renomear atendimento');

    const input = new TextInputBuilder()
      .setCustomId('newChannelName')
      .setPlaceholder('ticket-orcamento-novo-assunto')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(90)
      .setValue(ticket.channelName)
      .setRequired(true);

    const label = new LabelBuilder()
      .setLabel('Novo nome do canal')
      .setDescription('Defina um novo nome amigável para este canal de atendimento.')
      .setTextInputComponent(input);

    modal.addLabelComponents(label);

    // Show the modal
    await interaction.showModal(modal);
  } catch {
    await sendErrorResponse(interaction, 'Erro', 'Não foi possível abrir o formulário de renomeação.', true);
  }
}

export default handleRenameButton;
