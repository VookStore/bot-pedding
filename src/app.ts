import { client } from './client';
import { onReady } from './events/ready.event';
import { onInteractionCreate } from './events/interaction-create.event';
import { onGuildDelete } from './events/guild-delete.event';
import env from './config/env';
import logger from './logger/logger';
import prisma from './database/prisma';

// Register Event Listeners
client.once('ready', () => onReady(client));
client.on('interactionCreate', onInteractionCreate);
client.on('guildDelete', onGuildDelete);

async function bootstrap() {
  try {
    logger.info('Bootstrapping VOOK Ticket Bot...');

    // Login client
    await client.login(env.DISCORD_TOKEN);
    logger.info('Discord Gateway authentication initialized.');
  } catch (error) {
    logger.fatal(error, 'Bootstrap failed due to an unhandled exception');
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Graceful Shutdown Management
const handleShutdown = async (signal: string) => {
  logger.warn({ signal }, 'Termination signal received. Initiating graceful shutdown...');

  try {
    logger.info('Destroying Discord client connection...');
    client.destroy();

    logger.info('Disconnecting Prisma Client database pool...');
    await prisma.$disconnect();

    logger.info('Graceful shutdown completed successfully. Exiting.');
    process.exit(0);
  } catch (err) {
    logger.error(err, 'Failed to complete graceful shutdown steps cleanly');
    process.exit(1);
  }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection caught globally');
});

process.on('uncaughtException', (error) => {
  logger.fatal(error, 'Uncaught Exception caught globally. Crashing process.');
  process.exit(1);
});

bootstrap();
