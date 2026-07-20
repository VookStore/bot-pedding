import { Client, GatewayIntentBits, Partials } from 'discord.js';
import logger from './logger/logger';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required for message backup / transcripts
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
  allowedMentions: {
    parse: ['users'], // Strict security: do not parse role mentions or @everyone/@here by default
    repliedUser: true,
  },
});

client.on('error', (err) => {
  logger.error(err, 'Discord client error');
});

client.on('warn', (msg) => {
  logger.warn({ msg }, 'Discord client warning');
});

export default client;
