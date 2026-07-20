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
 * Handles ticket transfer staff select menu selection: `ticket:admin:transfer:{ticketId}`
 */
export async function handleTransferSelect(interaction: UserSelectMenuInteraction, ticketId: string): Promise<void> {
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

  // 3. Defer response
  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

  try {
    const guild = interaction.guild!;
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

    if (!targetMember) {
      await sendErrorResponse(interaction, 'Erro', 'O atendente selecionado não foi encontrado no servidor.', true);
      return;
    }

    // 4. Validate that the target user has a staff role configured for the category
    const isTargetStaff = await TicketPermissionService.isStaff(targetMember, ticket.categoryId);
    if (!isTargetStaff) {
      await sendErrorResponse(
        interaction,
        'Membro inválido',
        'O usuário selecionado não possui cargos da equipe associados a esta categoria de atendimento.',
        true,
      );
      return;
    }

    // 5. Transfer ticket responsibility
    await TicketService.transferTicket(ticketId, targetMember, member);

    // 6. Return confirmation card
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ RESPONSÁVEL ALTERADO\n\n' +
            `A responsabilidade do atendimento foi transferida para <@${targetUserId}>.`,
        ),
      ),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch {
    await sendErrorResponse(interaction, 'Erro', 'Não foi possível transferir este ticket.', true);
  }
}

export default handleTransferSelect;
