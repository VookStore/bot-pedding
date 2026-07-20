import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import env from '../src/config/env';
import logger from '../src/logger/logger';

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-config')
    .setDescription('Configurações gerais do sistema de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('geral')
        .setDescription('Abre o painel de configuração geral do sistema de tickets'),
    ),
  new SlashCommandBuilder()
    .setName('ticket-categorias')
    .setDescription('Gerenciamento de categorias de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('gerenciar')
        .setDescription('Abre o painel de gerenciamento de categorias'),
    ),
  new SlashCommandBuilder()
    .setName('ticket-destinos')
    .setDescription('Vincular categorias lógicas a categorias físicas do Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('configurar')
        .setDescription('Vincula uma categoria a uma categoria de canal do Discord'),
    ),
  new SlashCommandBuilder()
    .setName('ticket-equipe')
    .setDescription('Configurar cargos da equipe por categoria')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('configurar')
        .setDescription('Associa cargos de atendimento a uma categoria'),
    ),
  new SlashCommandBuilder()
    .setName('ticket-painel')
    .setDescription('Gerenciamento do painel público de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enviar')
        .setDescription('Envia o painel de tickets no canal configurado'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('atualizar')
        .setDescription('Atualiza a mensagem do painel de tickets existente'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remover')
        .setDescription('Exclui o painel de tickets do canal'),
    ),
  new SlashCommandBuilder()
    .setName('ticket-sistema')
    .setDescription('Verificar status e diagnóstico do sistema')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Exibe diagnósticos detalhados do bot e banco de dados'),
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

async function deploy() {
  try {
    logger.info('Started refreshing application (/) commands.');

    if (env.DEVELOPER_GUILD_ID) {
      logger.info(`Deploying commands to Developer Guild: ${env.DEVELOPER_GUILD_ID}`);
      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEVELOPER_GUILD_ID),
        { body: commands },
      );
      logger.info('Successfully registered application commands in developer guild.');
    } else {
      logger.info('No Developer Guild ID set. Deploying commands globally...');
      await rest.put(
        Routes.applicationCommands(env.DISCORD_CLIENT_ID),
        { body: commands },
      );
      logger.info('Successfully registered application commands globally.');
    }
  } catch (error) {
    logger.error(error, 'Error registering slash commands');
    process.exit(1);
  }
}

deploy();
