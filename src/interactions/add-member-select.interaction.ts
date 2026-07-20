import {
  UserSelectMenuInteraction,
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
 * Handles adding member user select: `ticket:admin:add-member:{ticketId}`
 */
export async function handleAddMemberSelect(interaction: UserSelectMenuInteraction, ticketId: string): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  const targetUserId = interaction.values[0];

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

  // Prevent adding the author or bot
  if (targetUserId === ticket.createdByUserId) {
    await sendErrorResponse(interaction, 'Erro', 'Não é possível adicionar o próprio criador do ticket.', true);
    return;
  }
  if (targetUserId === interaction.client.user.id) {
    await sendErrorResponse(interaction, 'Erro', 'Não é possível adicionar o bot ao ticket.', true);
    return;
  }

  // 3. Defer response
  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

  try {
    // 4. Fetch target member from guild
    const guild = interaction.guild!;
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
      await sendErrorResponse(interaction, 'Erro', 'Este membro não foi encontrado no servidor.', true);
      return;
    }

    // 5. Add member to ticket
    await TicketService.addMember(ticketId, targetMember, member);

    // 6. Return confirmation card
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ Membro adicionado\n\n' + `<@${targetUserId}> agora possui acesso a este atendimento.`,
        ),
      ),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch (err: any) {
    let errorMsg = 'Não foi possível adicionar o participante.';
    if (err.message === 'MEMBER_ALREADY_EXISTS') {
      errorMsg = 'Este participante já possui acesso a este atendimento.';
    }
    await sendErrorResponse(interaction, 'Erro', errorMsg, true);
  }
}

export default handleAddMemberSelect;
