import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

/**
 * Creates a standard Components V2 error container.
 */
export function createErrorContainer(title: string, message: string): ContainerBuilder {
  return new ContainerBuilder().addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ ${title}\n\n${message}`)),
  );
}

/**
 * Responds to an interaction with a Components V2 error container.
 */
export async function sendErrorResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interaction: any,
  title: string,
  message: string,
  ephemeral = true,
): Promise<any> {
  const container = createErrorContainer(title, message);
  const flags = ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2;

  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply({
        components: [container],
        flags, // Note: some versions allow editing flags, but editReply keeps ephemeral state from deferReply
      });
    }
    return await interaction.reply({
      components: [container],
      flags,
    });
  } catch {
    // Fallback if the interaction has expired or cannot be replied to
    return null;
  }
}
