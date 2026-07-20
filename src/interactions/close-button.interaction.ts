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
 * Handles close ticket button click: `ticket:close:{ticketId}`
 */
export async function handleCloseButton(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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
    const modal = new ModalBuilder().setCustomId(`ticket:close:modal:${ticketId}`).setTitle('Finalizar atendimento');

    const input = new TextInputBuilder()
      .setCustomId('ticketCloseReason')
      .setPlaceholder('Exemplo: suporte finalizado após configuração do bot no servidor.')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(1000)
      .setRequired(true);

    const label = new LabelBuilder()
      .setLabel('Conclusão do atendimento')
      .setDescription('Informe de forma clara como a solicitação foi resolvida ou o motivo do encerramento.')
      .setTextInputComponent(input);

    modal.addLabelComponents(label);

    // Show the modal
    await interaction.showModal(modal);
  } catch {
    await sendErrorResponse(interaction, 'Erro', 'Não foi possível abrir o formulário de encerramento.', true);
  }
}

export default handleCloseButton;
