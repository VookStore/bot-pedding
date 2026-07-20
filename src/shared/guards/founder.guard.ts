import { BaseInteraction } from 'discord.js';
import env from '../../config/env';
import { sendErrorResponse } from '../../components/errors.component';

/**
 * Validates if the user who triggered the interaction is registered as a bot founder.
 */
export async function isFounder(interaction: BaseInteraction): Promise<boolean> {
  const userId = interaction.user.id;
  if (!env.BOT_FOUNDER_IDS.includes(userId)) {
    await sendErrorResponse(
      interaction,
      'Acesso Negado',
      'Você não possui permissão para utilizar esta ferramenta de configuração do bot.',
      true,
    );
    return false;
  }
  return true;
}
