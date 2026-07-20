import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

interface AdminPanelData {
  ticketId: string;
  // Manual members added to this ticket
  addedMembers: {
    userId: string;
    username: string;
  }[];
}

/**
 * Builds the ephemeral V2 admin control panel.
 */
export function buildAdminPanel(data: AdminPanelData): ContainerBuilder {
  const container = new ContainerBuilder();

  // 1. Header Section
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## 🔒 PAINEL ADMINISTRATIVO\n\n' +
          'Gerencie participantes e informações deste atendimento. Todas as alterações serão registradas no histórico do ticket.',
      ),
    ),
  );

  // 2. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Section: Add Member
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Adicionar membro\n' +
        'Selecione um usuário do servidor para conceder acesso de leitura e escrita ao ticket.',
    ),
  );

  const addMemberMenu = new UserSelectMenuBuilder()
    .setCustomId(`ticket:admin:add-member:${data.ticketId}`)
    .setPlaceholder('Selecione um membro para adicionar')
    .setMinValues(1)
    .setMaxValues(1);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(addMemberMenu));

  // 4. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 5. Section: Remove Member
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Remover membro\n' + 'Selecione um participante adicional para revogar o acesso ao ticket.',
    ),
  );

  const removeMemberMenu = new StringSelectMenuBuilder().setCustomId(`ticket:admin:remove-member:${data.ticketId}`);

  if (data.addedMembers.length > 0) {
    removeMemberMenu.setPlaceholder('Selecione um membro para remover');
    const options = data.addedMembers.map((m) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(m.username)
        .setValue(m.userId)
        .setDescription(`User ID: ${m.userId}`),
    );
    removeMemberMenu.addOptions(options);
  } else {
    removeMemberMenu.setPlaceholder('Nenhum membro adicional no ticket');
    removeMemberMenu.setDisabled(true);
    // Add dummy option to satisfy Discord's requirement of at least 1 option in select menus
    removeMemberMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Nenhum membro participante')
        .setValue('none')
        .setDescription('Nenhum membro adicionado manualmente'),
    );
  }

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(removeMemberMenu));

  // 6. Divider
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 7. Section: Transfer Owner & Action Button (Rename)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '### Transferir responsabilidade / Ações adicionais\n' +
        'Escolha um atendente da equipe para assumir a titularidade ou renomeie este canal.',
    ),
  );

  // User select menu for transfer staff responsibility
  const transferMenu = new UserSelectMenuBuilder()
    .setCustomId(`ticket:admin:transfer:${data.ticketId}`)
    .setPlaceholder('Selecione um atendente para transferir')
    .setMinValues(1)
    .setMaxValues(1);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(transferMenu));

  // Button to rename the channel
  const renameButton = new ButtonBuilder()
    .setCustomId(`ticket:admin:rename:${data.ticketId}`)
    .setLabel('Renomear canal')
    .setStyle(ButtonStyle.Secondary);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(renameButton));

  return container;
}

export default buildAdminPanel;
