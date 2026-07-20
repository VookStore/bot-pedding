import {
  ModalSubmitInteraction,
  MessageFlags,
  GuildMember,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import TicketRepository from '../repositories/ticket.repository';
import TicketPermissionService from '../services/ticket-permission.service';
import TicketService from '../services/ticket.service';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Handles the close modal submission: `ticket:close:modal:{ticketId}`
 */
export async function handleCloseModalSubmit(interaction: ModalSubmitInteraction, ticketId: string): Promise<void> {
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

  // 3. Defer response
  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

  // 4. Retrieve and sanitize input close reason
  const closeReason = interaction.fields.getTextInputValue('ticketCloseReason').trim();

  if (closeReason.length < 5 || closeReason.length > 1000) {
    await sendErrorResponse(
      interaction,
      'Conclusão inválida',
      'A conclusão deve conter entre 5 e 1000 caracteres válidos.',
      true,
    );
    return;
  }

  try {
    // 5. Finalize the ticket
    await TicketService.closeTicket(ticketId, closeReason, member);

    // 6. Return confirmation card
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ TICKET ENCERRADO\n\n' + 'O ticket foi finalizado e a rotina de arquivamento/exclusão foi iniciada.',
        ),
      ),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch (err: any) {
    let errorMsg = 'Não foi possível encerrar este ticket.';
    if (err.message === 'CLOSE_LOCKED') {
      errorMsg = 'Uma rotina de encerramento já está em execução para este ticket.';
    } else if (err.message === 'TICKET_ALREADY_CLOSED') {
      errorMsg = 'Este ticket já se encontra finalizado.';
    }

    await sendErrorResponse(interaction, 'Erro', errorMsg, true);
  }
}

export default handleCloseModalSubmit;
