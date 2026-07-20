import {
  StringSelectMenuInteraction,
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
 * Handles removing member select menu selection: `ticket:admin:remove-member:{ticketId}`
 */
export async function handleRemoveMemberSelect(
  interaction: StringSelectMenuInteraction,
  ticketId: string,
): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  const targetUserId = interaction.values[0];
  if (targetUserId === 'none') {
    // Ignore dummy options
    await interaction.deferUpdate();
    return;
  }

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

  try {
    // 4. Remove member
    await TicketService.removeMember(ticketId, targetUserId, member);

    // 5. Return confirmation card
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ Membro removido\n\n' + `<@${targetUserId}> foi removido com sucesso deste atendimento.`,
        ),
      ),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch (err: any) {
    let errorMsg = 'Não foi possível remover o participante.';
    if (err.message === 'CANNOT_REMOVE_CREATOR') {
      errorMsg = 'Não é possível remover o criador do ticket.';
    } else if (err.message === 'CANNOT_REMOVE_ASSIGNEE') {
      errorMsg = 'Não é possível remover o atendente responsável.';
    }
    await sendErrorResponse(interaction, 'Erro', errorMsg, true);
  }
}

export default handleRemoveMemberSelect;
