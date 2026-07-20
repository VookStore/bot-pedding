import { Guild } from 'discord.js';
import logger from '../logger/logger';

/**
 * Handles guildDelete event (bot leaves a server).
 */
export async function onGuildDelete(guild: Guild): Promise<void> {
  logger.info({ guildId: guild.id, name: guild.name }, 'Bot removed from guild.');
}

export default onGuildDelete;
