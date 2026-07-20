import {
  ModalSubmitInteraction,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import TicketService from '../services/ticket.service';
import { sendErrorResponse } from '../components/errors.component';
import logger from '../logger/logger';

/**
 * Handles the subject modal submission: `ticket:create:subject:{categoryId}`
 */
export async function handleSubjectModalSubmit(interaction: ModalSubmitInteraction, categoryId: string): Promise<void> {
  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) return;

  // 1. Defer response immediately to prevent Discord timeouts
  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

  // 2. Retrieve and sanitize input subject
  let subject = interaction.fields.getTextInputValue('ticketSubject');

  // Sanitization
  subject = subject
    .replace(/<@!?&?[0-9]+>|@everyone|@here/g, '') // Remove user, role, everyone, here mentions
    .replace(/[\r\n]+/g, ' ') // Strip line breaks
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  // Validate length and space requirements
  if (subject.length < 5 || subject.length > 100) {
    await sendErrorResponse(
      interaction,
      'Assunto inválido',
      'O assunto deve conter entre 5 e 100 caracteres válidos.',
      true,
    );
    return;
  }

  try {
    // 3. Open ticket channel
    const res = await TicketService.openTicket(guild, member as any, categoryId, subject);

    if (!res) {
      await sendErrorResponse(interaction, 'Erro interno', 'Não foi possível criar seu canal de atendimento.', true);
      return;
    }

    // 4. Respond with access link button
    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ CANAL CRIADO\n\n' +
            `Seu canal de atendimento foi criado com sucesso em <#${res.channel.id}>. Clique no botão abaixo para acessar.`,
        ),
      ),
    );

    const accessButton = new ButtonBuilder()
      .setLabel('Acessar Canal')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guild.id}/${res.channel.id}`);

    successContainer.addActionRowComponents(new ActionRowBuilder<any>().addComponents(accessButton));

    await interaction.editReply({
      components: [successContainer],
    });
  } catch (err: any) {
    logger.error(err, 'Failed to create ticket channel on modal submit');

    // Translate business error messages into user friendly messages
    let errorTitle = 'Erro de Abertura';
    let errorMsg = 'Não foi possível abrir o seu atendimento neste momento. Tente novamente mais tarde.';

    if (err.message === 'TICKET_ALREADY_OPEN' || err.message === 'USER_LIMIT_REACHED') {
      errorTitle = 'Ticket já aberto';
      errorMsg = 'Você já possui um atendimento em andamento neste servidor.';
    } else if (err.message === 'CATEGORY_UNAVAILABLE') {
      errorTitle = 'Categoria indisponível';
      errorMsg = 'Esta categoria está temporariamente indisponível. Selecione outra.';
    } else if (err.message === 'DESTINATION_NOT_CONFIGURED') {
      errorTitle = 'Destino não configurado';
      errorMsg = 'Esta categoria ainda não possui um destino configurado. A equipe técnica já foi informada.';
    } else if (err.message === 'MISSING_BOT_PERMISSIONS') {
      errorTitle = 'Sem permissão';
      errorMsg = 'Não foi possível criar o canal porque o bot não possui as permissões necessárias (Gerenciar Canais).';
    } else if (err.message === 'TOTAL_LIMIT_REACHED') {
      errorTitle = 'Limite atingido';
      errorMsg = 'O limite de atendimentos simultâneos foi atingido no servidor. Aguarde a conclusão de algum ticket.';
    }

    await sendErrorResponse(interaction, errorTitle, errorMsg, true);
  }
}

export default handleSubjectModalSubmit;
