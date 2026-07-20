import { BaseInteraction } from 'discord.js';
import { sendErrorResponse } from '../../components/errors.component';

/**
 * Validates that the interaction occurred within a Discord Guild.
 */
export async function isGuild(interaction: BaseInteraction): Promise<boolean> {
  if (!interaction.guildId || !interaction.guild) {
    await sendErrorResponse(
      interaction,
      'Apenas em Servidores',
      'Este comando só pode ser utilizado dentro de um servidor do Discord.',
      true,
    );
    return false;
  }
  return true;
}
export default isGuild;
