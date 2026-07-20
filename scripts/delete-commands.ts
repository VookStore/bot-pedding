import { REST, Routes } from 'discord.js';
import env from '../src/config/env';
import logger from '../src/logger/logger';

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

async function deleteCommands() {
  try {
    logger.info('Started clearing application (/) commands...');

    if (env.DEVELOPER_GUILD_ID) {
      logger.info(`Deleting commands from Developer Guild: ${env.DEVELOPER_GUILD_ID}`);
      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEVELOPER_GUILD_ID),
        { body: [] },
      );
      logger.info('Successfully cleared application commands in developer guild.');
    } else {
      logger.info('Deleting global commands...');
      await rest.put(
        Routes.applicationCommands(env.DISCORD_CLIENT_ID),
        { body: [] },
      );
      logger.info('Successfully cleared application commands globally.');
    }
  } catch (error) {
    logger.error(error, 'Error deleting slash commands');
    process.exit(1);
  }
}

deleteCommands();
