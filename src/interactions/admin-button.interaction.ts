import { ButtonInteraction, MessageFlags, GuildMember } from 'discord.js';
import TicketRepository from '../repositories/ticket.repository';
import TicketPermissionService from '../services/ticket-permission.service';
import buildAdminPanel from '../components/admin-panel.component';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Handles admin panel button click: `ticket:admin:{ticketId}`
 */
export async function handleAdminButton(interaction: ButtonInteraction, ticketId: string): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  // 1. Fetch ticket
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
    // 4. Fetch manual members and resolve usernames
    const rawMembers = await TicketRepository.getMembers(ticketId);
    const resolvedMembers = [];
    const guild = interaction.guild!;

    for (const rm of rawMembers) {
      const m = await guild.members.fetch(rm.userId).catch(() => null);
      resolvedMembers.push({
        userId: rm.userId,
        username: m ? m.user.tag : `User ID: ${rm.userId}`,
      });
    }

    // 5. Build and send admin panel
    const adminPanel = buildAdminPanel({
      ticketId,
      addedMembers: resolvedMembers,
    });

    await interaction.editReply({
      components: [adminPanel],
    });
  } catch {
    await sendErrorResponse(interaction, 'Erro', 'Não foi possível carregar o painel administrativo.', true);
  }
}

export default handleAdminButton;
