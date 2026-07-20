import { BaseInteraction, GuildMember } from 'discord.js';
import prisma from '../../database/prisma';
import TicketPermissionService from '../../services/ticket-permission.service';
import { sendErrorResponse } from '../../components/errors.component';

/**
 * Validates if the user is authorized to perform administrative actions on the ticket channel.
 */
export async function isStaffGuard(interaction: BaseInteraction): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (!member) {
    await sendErrorResponse(interaction, 'Acesso Negado', 'Permissões indisponíveis neste contexto.', true);
    return false;
  }

  const channelId = interaction.channelId;
  if (!channelId) {
    await sendErrorResponse(interaction, 'Acesso Negado', 'Este comando deve ser executado dentro de um canal.', true);
    return false;
  }

  // Look up the ticket associated with this channel
  const ticket = await prisma.ticket.findUnique({
    where: { channelId },
  });

  if (!ticket) {
    await sendErrorResponse(
      interaction,
      'Acesso Negado',
      'Este canal não é um ticket ativo ou registrado no sistema.',
      true,
    );
    return false;
  }

  // Validate permission
  const hasPerm = await TicketPermissionService.canManageTicket(member, ticket);
  if (!hasPerm) {
    await sendErrorResponse(
      interaction,
      'Acesso Negado',
      'Você não possui permissão para utilizar esta ferramenta de atendimento.',
      true,
    );
    return false;
  }

  return true;
}

export default isStaffGuard;
