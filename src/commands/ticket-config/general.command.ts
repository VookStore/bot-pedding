import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { isFounder } from '../../shared/guards/founder.guard';
import { isGuild } from '../../shared/guards/guild.guard';
import SettingsRepository from '../../repositories/settings.repository';
import TicketRepository from '../../repositories/ticket.repository';
import CategoryRepository from '../../repositories/category.repository';
import buildConfigPanel from '../../components/config-panel.component';

/**
 * Handles `/ticket-config geral`
 */
export async function executeGeneralConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await isGuild(interaction))) return;
  if (!(await isFounder(interaction))) return;

  const guildId = interaction.guildId!;

  // Fetch configurations
  const settings = await SettingsRepository.getOrCreate(guildId);
  const openCount = await TicketRepository.countTotalActive(guildId);
  const categories = await CategoryRepository.getAll(guildId);
  const activeCategoriesCount = categories.filter((c) => c.active).length;

  // Build V2 config dashboard
  const configPanel = buildConfigPanel({
    enabled: settings.enabled,
    panelChannelId: settings.panelChannelId,
    logChannelId: settings.logChannelId,
    activeCategoriesCount,
    openTicketsCount: openCount,
    closeMode: settings.closeMode,
    ticketLimitPerUser: settings.ticketLimitPerUser,
  });

  await interaction.reply({
    components: [configPanel],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export default executeGeneralConfig;
