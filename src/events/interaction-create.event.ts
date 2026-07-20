import {
  Interaction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  ChannelSelectMenuInteraction,
} from 'discord.js';
import logger from '../logger/logger';
import { sendErrorResponse } from '../components/errors.component';

// Command Handlers
import executeGeneralConfig from '../commands/ticket-config/general.command';
import executeManageCategories from '../commands/ticket-categories/categories.command';
import executeConfigureDestinations from '../commands/ticket-destinations/destinations.command';
import executeConfigureTeam from '../commands/ticket-team/team.command';
import executePanelCommand from '../commands/ticket-panel/panel.command';
import executeStatusCommand from '../commands/ticket-system/status.command';

// Interaction Handlers
import handleCategorySelect from '../interactions/category-select.interaction';
import handleSubjectModalSubmit from '../interactions/subject-modal.interaction';
import handleClaimButton from '../interactions/claim-button.interaction';
import handleAdminButton from '../interactions/admin-button.interaction';
import handleNotifyButton from '../interactions/notify-button.interaction';
import handleCloseButton from '../interactions/close-button.interaction';
import handleCloseModalSubmit from '../interactions/close-modal.interaction';
import handleAddMemberSelect from '../interactions/add-member-select.interaction';
import handleRemoveMemberSelect from '../interactions/remove-member-select.interaction';
import handleRenameButton from '../interactions/rename-button.interaction';
import handleRenameModalSubmit from '../interactions/rename-modal.interaction';
import handleTransferSelect from '../interactions/transfer-select.interaction';

import {
  handleConfigNavigation,
  handleDestinationCategorySelect,
  handleDestinationChannelSelect,
  handleTeamCategorySelect,
  handleTeamRolesSelect,
  handleCategoryCreateButton,
} from '../interactions/config-navigation.interaction';

import {
  handlePanelChannelSelect,
  handleLogChannelSelect,
  handleVisualModalSubmit,
  handleCategoryCreateModalSubmit,
  handleCategoryConfigSelect,
  handleCategoryToggle,
  handleCategoryDelete,
} from '../interactions/config-save.interaction';

/**
 * Main interaction routing router.
 */
export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  const correlationId = Math.random().toString(36).substring(2, 9);

  // 1. ROUTE SLASH COMMANDS
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    logger.info({ commandName, userId: interaction.user.id, correlationId }, 'Executing Slash Command');

    try {
      switch (commandName) {
        case 'ticket-config':
          await executeGeneralConfig(interaction);
          break;
        case 'ticket-categorias':
          await executeManageCategories(interaction);
          break;
        case 'ticket-destinos':
          await executeConfigureDestinations(interaction);
          break;
        case 'ticket-equipe':
          await executeConfigureTeam(interaction);
          break;
        case 'ticket-painel':
          await executePanelCommand(interaction);
          break;
        case 'ticket-sistema':
          await executeStatusCommand(interaction);
          break;
        default:
          await sendErrorResponse(
            interaction,
            'Comando desconhecido',
            'Este comando não foi mapeado pelo sistema.',
            true,
          );
      }
    } catch (err) {
      logger.error({ err, commandName, correlationId }, 'Slash Command Execution Failure');
      await sendErrorResponse(
        interaction,
        'Erro interno',
        'Não foi possível processar esta ação. Tente novamente mais tarde.',
        true,
      );
    }
    return;
  }

  // 2. ROUTE BUTTON CLICK INTERACTIONS
  if (interaction.isButton()) {
    const customId = interaction.customId;
    const parts = customId.split(':');
    logger.info({ customId, userId: interaction.user.id, correlationId }, 'Button Click Triggered');

    try {
      if (customId.startsWith('ticket:claim:')) {
        await handleClaimButton(interaction, parts[2]);
      } else if (customId.startsWith('ticket:admin:rename:')) {
        await handleRenameButton(interaction, parts[3]);
      } else if (customId.startsWith('ticket:admin:')) {
        await handleAdminButton(interaction, parts[2]);
      } else if (customId.startsWith('ticket:notify:')) {
        await handleNotifyButton(interaction, parts[2]);
      } else if (customId.startsWith('ticket:close:')) {
        await handleCloseButton(interaction, parts[2]);
      } else if (customId.startsWith('ticket:config:nav:')) {
        await handleConfigNavigation(interaction, parts[3]);
      } else if (customId === 'ticket:config:cat:create') {
        await handleCategoryCreateButton(interaction);
      } else if (customId.startsWith('ticket:config:cat:toggle:')) {
        await handleCategoryToggle(interaction, parts[5]);
      } else if (customId.startsWith('ticket:config:cat:delete:')) {
        await handleCategoryDelete(interaction, parts[5]);
      } else {
        await sendErrorResponse(interaction, 'Ação inválida', 'Botão não mapeado ou expirado.', true);
      }
    } catch (err) {
      logger.error({ err, customId, correlationId }, 'Button Interaction Failure');
      await sendErrorResponse(interaction, 'Erro', 'Não foi possível processar o clique do botão.', true);
    }
    return;
  }

  // 3. ROUTE SELECT MENU INTERACTIONS
  if (
    interaction.isStringSelectMenu() ||
    interaction.isUserSelectMenu() ||
    interaction.isChannelSelectMenu() ||
    interaction.isRoleSelectMenu()
  ) {
    const customId = interaction.customId;
    const parts = customId.split(':');
    logger.info({ customId, userId: interaction.user.id, correlationId }, 'Select Menu Changed');

    try {
      if (customId === 'ticket:create:category') {
        await handleCategorySelect(interaction as StringSelectMenuInteraction);
      } else if (customId.startsWith('ticket:admin:add-member:')) {
        await handleAddMemberSelect(interaction as UserSelectMenuInteraction, parts[3]);
      } else if (customId.startsWith('ticket:admin:remove-member:')) {
        await handleRemoveMemberSelect(interaction as StringSelectMenuInteraction, parts[3]);
      } else if (customId.startsWith('ticket:admin:transfer:')) {
        await handleTransferSelect(interaction as UserSelectMenuInteraction, parts[3]);
      } else if (customId === 'ticket:dest:select-category') {
        await handleDestinationCategorySelect(interaction);
      } else if (customId.startsWith('ticket:dest:select-channel:')) {
        await handleDestinationChannelSelect(interaction, parts[3]);
      } else if (customId === 'ticket:team:select-category') {
        await handleTeamCategorySelect(interaction);
      } else if (customId.startsWith('ticket:team:select-roles:')) {
        await handleTeamRolesSelect(interaction, parts[3]);
      } else if (customId === 'ticket:config:cat:select') {
        await handleCategoryConfigSelect(interaction as StringSelectMenuInteraction);
      } else if (customId === 'ticket:config:select-panel-channel') {
        await handlePanelChannelSelect(interaction as ChannelSelectMenuInteraction);
      } else if (customId === 'ticket:config:select-log-channel') {
        await handleLogChannelSelect(interaction as ChannelSelectMenuInteraction);
      } else {
        await sendErrorResponse(interaction, 'Seleção inválida', 'Este menu não foi mapeado.', true);
      }
    } catch (err) {
      logger.error({ err, customId, correlationId }, 'Select Menu Interaction Failure');
      await sendErrorResponse(interaction, 'Erro', 'Não foi possível gravar sua seleção.', true);
    }
    return;
  }

  // 4. ROUTE MODAL SUBMISSIONS
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    const parts = customId.split(':');
    logger.info({ customId, userId: interaction.user.id, correlationId }, 'Modal Submitted');

    try {
      if (customId.startsWith('ticket:create:subject:')) {
        await handleSubjectModalSubmit(interaction, parts[3]);
      } else if (customId.startsWith('ticket:admin:rename-modal:')) {
        await handleRenameModalSubmit(interaction, parts[3]);
      } else if (customId.startsWith('ticket:close:modal:')) {
        await handleCloseModalSubmit(interaction, parts[3]);
      } else if (customId === 'ticket:config:visual-modal') {
        await handleVisualModalSubmit(interaction);
      } else if (customId === 'ticket:config:cat:create-modal') {
        await handleCategoryCreateModalSubmit(interaction);
      } else {
        await sendErrorResponse(interaction, 'Formulário inválido', 'Os dados enviados são inválidos.', true);
      }
    } catch (err) {
      logger.error({ err, customId, correlationId }, 'Modal Submit Interaction Failure');
      await sendErrorResponse(interaction, 'Erro', 'Não foi possível processar o formulário.', true);
    }
  }
}

export default onInteractionCreate;
