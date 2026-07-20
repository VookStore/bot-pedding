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
import { sanitizeChannelName } from '../shared/utils/sanitize-channel-name';
import { sendErrorResponse } from '../components/errors.component';

/**
 * Handles the rename modal submission: `ticket:admin:rename-modal:{ticketId}`
 */
export async function handleRenameModalSubmit(interaction: ModalSubmitInteraction, ticketId: string): Promise<void> {
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

  // 4. Retrieve and sanitize input name
  const rawInput = interaction.fields.getTextInputValue('newChannelName');
  let sanitized = sanitizeChannelName(rawInput);

  // Preserve 'ticket-' prefix if required
  if (!sanitized.startsWith('ticket-')) {
    sanitized = `ticket-${sanitized}`;
  }

  if (sanitized.length < 3 || sanitized.length > 90) {
    await sendErrorResponse(
      interaction,
      'Nome inválido',
      'O nome do canal deve conter entre 3 e 90 caracteres normativos.',
      true,
    );
    return;
  }

  try {
    // 5. Apply rename operation
    await TicketService.renameChannel(ticketId, sanitized, member);

    // 6. Respond with confirmation
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ CANAL RENOMEADO\n\n' + `O canal foi renomeado com sucesso para \`${sanitized}\`.`,
        ),
      ),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch {
    await sendErrorResponse(
      interaction,
      'Erro',
      'Não foi possível renomear o canal. Verifique permissões do bot e rate limits.',
      true,
    );
  }
}

export default handleRenameModalSubmit;
