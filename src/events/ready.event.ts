import { Client } from 'discord.js';
import logger from '../logger/logger';
import prisma from '../database/prisma';

/**
 * Handles the ready event.
 */
export async function onReady(client: Client): Promise<void> {
  logger.info(`Logged in as ${client.user?.tag}!`);

  // Ensure DB connection
  try {
    await prisma.$connect();
    logger.info('Prisma Client connected to PostgreSQL successfully.');
  } catch (err) {
    logger.fatal(err, 'Database connection failed on startup. Bot may fail queries.');
  }
}

export default onReady;
