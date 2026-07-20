import {
  ChatInputCommandInteraction,
  MessageFlags,
  TextChannel,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { isFounder } from '../../shared/guards/founder.guard';
import { isGuild } from '../../shared/guards/guild.guard';
import SettingsRepository from '../../repositories/settings.repository';
import CategoryRepository from '../../repositories/category.repository';
import buildMainPanel from '../../components/main-panel.component';
import { sendErrorResponse } from '../../components/errors.component';

/**
 * Handles `/ticket-painel enviar`, `/ticket-painel atualizar`, and `/ticket-painel remover`
 */
export async function executePanelCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await isGuild(interaction))) return;
  if (!(await isFounder(interaction))) return;

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  const settings = await SettingsRepository.getOrCreate(guildId);
  const activeCategories = await CategoryRepository.getActive(guildId);

  if (activeCategories.length === 0) {
    await sendErrorResponse(
      interaction,
      'Sem categorias ativas',
      'Não é possível gerenciar o painel porque não existem categorias ativas cadastradas no banco de dados.',
      true,
    );
    return;
  }

  // Fetch target channel
  if (!settings.panelChannelId) {
    await sendErrorResponse(
      interaction,
      'Canal do painel não configurado',
      'Defina o canal do painel nas configurações gerais antes de realizar esta operação.',
      true,
    );
    return;
  }

  const guild = interaction.guild!;
  const channel = await guild.channels.fetch(settings.panelChannelId).catch(() => null);
  if (!channel || !(channel instanceof TextChannel)) {
    await sendErrorResponse(
      interaction,
      'Canal do painel inválido',
      'O canal do painel configurado no banco de dados não foi encontrado ou não é um canal de texto válido.',
      true,
    );
    return;
  }

  // 1. SEND SUBCOMMAND
  if (subcommand === 'enviar') {
    const mainPanel = buildMainPanel({
      title: settings.panelTitle,
      description: settings.panelDescription,
      notice: settings.panelNotice,
      logoUrl: settings.logoUrl,
      bannerUrl: settings.panelBannerUrl,
      categories: activeCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        emoji: c.emoji,
      })),
    });

    const msg = await channel.send({
      components: [mainPanel],
      flags: MessageFlags.IsComponentsV2,
    });

    // Save message ID to settings
    await SettingsRepository.update(guildId, {
      panelMessageId: msg.id,
    });

    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ PAINEL ENVIADO\n\n' +
            `O painel público de atendimento foi enviado com sucesso no canal <#${settings.panelChannelId}>.`,
        ),
      ),
    );

    await interaction.reply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // 2. UPDATE SUBCOMMAND
  if (subcommand === 'atualizar') {
    if (!settings.panelMessageId) {
      await sendErrorResponse(
        interaction,
        'Painel não encontrado',
        'O painel público de atendimento ainda não foi enviado neste servidor. Utilize `/ticket-painel enviar` primeiro.',
        true,
      );
      return;
    }

    const message = await channel.messages.fetch(settings.panelMessageId).catch(() => null);
    if (!message) {
      await sendErrorResponse(
        interaction,
        'Mensagem do painel não encontrada',
        'A mensagem original do painel foi excluída ou não está disponível. Por favor, envie uma nova com `/ticket-painel enviar`.',
        true,
      );
      return;
    }

    const mainPanel = buildMainPanel({
      title: settings.panelTitle,
      description: settings.panelDescription,
      notice: settings.panelNotice,
      logoUrl: settings.logoUrl,
      bannerUrl: settings.panelBannerUrl,
      categories: activeCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        emoji: c.emoji,
      })),
    });

    await message.edit({
      components: [mainPanel],
    });

    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ PAINEL ATUALIZADO\n\n' +
            `A mensagem do painel em <#${settings.panelChannelId}> foi atualizada com a nova configuração de categorias e visual.`,
        ),
      ),
    );

    await interaction.reply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // 3. REMOVE SUBCOMMAND
  if (subcommand === 'remover') {
    if (!settings.panelMessageId) {
      await sendErrorResponse(
        interaction,
        'Painel não enviado',
        'Não existe nenhuma mensagem de painel registrada para ser removida.',
        true,
      );
      return;
    }

    const message = await channel.messages.fetch(settings.panelMessageId).catch(() => null);
    if (message) {
      await message.delete().catch(() => null);
    }

    await SettingsRepository.update(guildId, {
      panelMessageId: null,
    });

    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ✅ PAINEL REMOVIDO\n\n' +
            'A mensagem do painel foi removida com sucesso. O ID do painel foi limpo nas configurações.',
        ),
      ),
    );

    await interaction.reply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }
}

export default executePanelCommand;
