import {
  ButtonInteraction,
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
 * Handles claiming ticket button click: `ticket:claim:{ticketId}`
 */
export async function handleClaimButton(interaction: ButtonInteraction, ticketId: string): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  // 1. Fetch ticket to validate permission
  const ticket = await TicketRepository.getById(ticketId);
  if (!ticket) {
    await sendErrorResponse(interaction, 'Não encontrado', 'Este ticket não foi encontrado no banco de dados.', true);
    return;
  }

  // 2. Validate staff permission
  const isStaff = await TicketPermissionService.isStaff(member, ticket.categoryId);
  if (!isStaff) {
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

  try {
    // 4. Claim the ticket
    await TicketService.claimTicket(ticketId, member);

    // 5. Send success confirmation
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ TICKET ASSUMIDO\n\n' + 'Você assumiu a responsabilidade por este atendimento com sucesso.',
        ),
      ),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch (err: any) {
    let errorMsg = 'Não foi possível assumir este atendimento.';
    if (err.message === 'CLAIM_LOCKED') {
      errorMsg = 'Outro atendente está tentando assumir este ticket neste momento.';
    } else if (err.message === 'TICKET_NOT_OPEN') {
      errorMsg = 'Este ticket não está mais aberto ou já foi assumido.';
    }

    await sendErrorResponse(interaction, 'Erro', errorMsg, true);
  }
}

export default handleClaimButton;
