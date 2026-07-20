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
 * Handles notify client button click: `ticket:notify:{ticketId}`
 */
export async function handleNotifyButton(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

  try {
    // 4. Trigger client notification
    const res = await TicketService.notifyClient(ticketId, member);

    // 5. Send confirmation feedback to staff
    let feedbackText = '## ✅ CLIENTE NOTIFICADO\n\nA notificação foi enviada no canal com sucesso.';
    if (res.dmSent) {
      feedbackText += '\n\n📬 Uma mensagem direta (DM) também foi entregue ao cliente.';
    } else {
      feedbackText += '\n\n⚠️ A mensagem direta não pôde ser entregue (DMs fechadas).';
    }

    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(feedbackText)),
    );

    await interaction.editReply({
      components: [successContainer],
    });
  } catch (err: any) {
    let errorMsg = 'Não foi possível notificar o cliente.';
    if (err.message === 'COOLDOWN_ACTIVE') {
      errorMsg = 'A notificação está em cooldown. Aguarde alguns minutos antes de notificar novamente.';
    }
    await sendErrorResponse(interaction, 'Erro', errorMsg, true);
  }
}

export default handleNotifyButton;
