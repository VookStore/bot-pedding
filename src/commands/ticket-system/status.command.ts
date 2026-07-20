import {
  ChatInputCommandInteraction,
  MessageFlags,
  TextChannel,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { isFounder } from '../../shared/guards/founder.guard';
import { isGuild } from '../../shared/guards/guild.guard';
import prisma from '../../database/prisma';
import SettingsRepository from '../../repositories/settings.repository';
import CategoryRepository from '../../repositories/category.repository';
import TicketRepository from '../../repositories/ticket.repository';
import logger from '../../logger/logger';

/**
 * Handles `/ticket-sistema status`
 */
export async function executeStatusCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await isGuild(interaction))) return;
  if (!(await isFounder(interaction))) return;

  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  // Defer reply to prevent timeouts during fetches
  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

  try {
    // 1. Check Database connection
    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch (err) {
      logger.error(err, 'Database check failed during diagnostics');
    }

    const dbStatusText = dbConnected ? '🟢 Conectado' : '🔴 Desconectado';

    // 2. Fetch configurations
    const settings = await SettingsRepository.getOrCreate(guildId);
    const categories = await CategoryRepository.getAll(guildId);
    const activeCount = categories.filter((c) => c.active).length;
    const openCount = await TicketRepository.countTotalActive(guildId);

    // 3. Verify public panel status
    let panelStatus = '🔴 Não configurado';
    if (settings.panelChannelId && settings.panelMessageId) {
      const channel = await guild.channels.fetch(settings.panelChannelId).catch(() => null);
      if (channel && channel instanceof TextChannel) {
        const msg = await channel.messages.fetch(settings.panelMessageId).catch(() => null);
        panelStatus = msg
          ? `🟢 Encontrado em <#${settings.panelChannelId}>`
          : `🔴 Mensagem excluída (Canal: <#${settings.panelChannelId}>)`;
      } else {
        panelStatus = '🔴 Canal inválido';
      }
    }

    // 4. Verify log channel status
    let logStatus = '🔴 Não configurado';
    if (settings.logChannelId) {
      const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
      logStatus =
        channel && channel instanceof TextChannel
          ? `🟢 Configurado em <#${settings.logChannelId}>`
          : '🔴 Canal inválido';
    }

    // 5. Build categories summary
    const catDetails: string[] = [];
    for (const cat of categories) {
      const statusText = cat.active ? '🟢' : '🔴';
      const destText = cat.discordParentCategoryId ? `<#${cat.discordParentCategoryId}>` : '*Não vinculado*';

      // Fetch roles count
      const roles = await CategoryRepository.getRoles(cat.id);
      const rolesText = roles.length > 0 ? roles.map((r) => `@${r.roleNameSnapshot}`).join(', ') : '*Nenhum cargo*';

      catDetails.push(
        `- ${statusText} **${cat.name}**\n` + `  Destino Discord: ${destText}\n` + `  Equipe Staff: ${rolesText}`,
      );
    }

    const catSummary = catDetails.join('\n\n') || '*Nenhuma categoria cadastrada.*';

    // 6. Fetch recent errors (last 3 audit action logs of type ERROR)
    const recentErrors = await prisma.ticketActionLog.findMany({
      where: {
        guildId,
        action: 'ERROR',
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    const errorDetails =
      recentErrors.length > 0
        ? recentErrors
            .map(
              (e) =>
                `- [<t:${Math.floor(e.createdAt.getTime() / 1000)}:R>] Metadata: \`${e.metadata ? String(e.metadata).substring(0, 150) : 'Sem metadados'}\``,
            )
            .join('\n')
        : '🟢 Nenhum erro registrado recentemente.';

    // 7. Assemble final diagnostics container
    const container = new ContainerBuilder();

    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## 📊 DIAGNÓSTICOS DO SISTEMA VOOK\n\n' +
            '**Bot de Tickets:** Online 🟢\n' +
            `**Banco de Dados:** ${dbStatusText}\n` +
            `**Painel Público:** ${panelStatus}\n` +
            `**Canal de Logs:** ${logStatus}\n` +
            `**Tickets Abertos:** ${openCount} (Limite Global: ${settings.totalOpenLimit})\n` +
            `**Categorias Ativas:** ${activeCount} / ${categories.length}`,
        ),
      ),
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Configuração de Categorias\n\n' + catSummary),
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Erros Recentes do Sistema\n\n' + errorDetails),
    );

    await interaction.editReply({
      components: [container],
    });
  } catch (err) {
    logger.error(err, 'Failed to complete system diagnostics');

    const errorContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '## ❌ Erro de diagnóstico\n\nNão foi possível processar a verificação de status do bot.',
        ),
      ),
    );
    await interaction.editReply({
      components: [errorContainer],
    });
  }
}

export default executeStatusCommand;
