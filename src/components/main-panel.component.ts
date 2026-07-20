import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

interface CategoryOptionData {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

interface MainPanelData {
  title: string;
  description: string;
  notice: string;
  logoUrl: string;
  bannerUrl?: string | null;
  categories: CategoryOptionData[];
}

/**
 * Builds the public V2 support panel containing description text, rules, banners, and the category selection menu.
 */
export function buildMainPanel(data: MainPanelData): ContainerBuilder {
  const container = new ContainerBuilder();

  // 1. Welcome Section
  const welcomeSection = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${data.title}\n\n${data.description}`),
  );

  if (data.logoUrl) {
    welcomeSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(data.logoUrl));
  }
  container.addSectionComponents(welcomeSection);

  // 2. Divider line
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // 3. Before Opening Notice Section
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(data.notice));

  // 4. Media Banner (if configured)
  if (data.bannerUrl) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(data.bannerUrl)),
    );
  }

  // 5. Separator
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));

  // 6. Dropdown Category Selector
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:create:category')
    .setPlaceholder('Selecione o motivo do seu atendimento');

  const options = data.categories.map((cat) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(cat.name)
      .setValue(cat.id)
      .setDescription(cat.description.substring(0, 100)); // Cap description at 100 chars (Discord API limit)

    if (cat.emoji) {
      option.setEmoji(cat.emoji);
    }

    return option;
  });

  selectMenu.addOptions(options);

  container.addActionRowComponents(new ActionRowBuilder<any>().addComponents(selectMenu));

  return container;
}

export default buildMainPanel;
