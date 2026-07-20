import prisma from '../database/prisma';
import { GuildSettings } from '@prisma/client';

export class SettingsRepository {
  /**
   * Fetch settings for a specific guild. Creates a default entry if not present.
   */
  public static async getOrCreate(guildId: string): Promise<GuildSettings> {
    const settings = await prisma.guildSettings.findUnique({
      where: { guildId },
    });

    if (settings) {
      return settings;
    }

    return await prisma.guildSettings.create({
      data: {
        guildId,
        enabled: true,
        ticketLimitPerUser: 1,
        totalOpenLimit: 50,
        notificationCooldownSeconds: 300,
        closeMode: 'delete',
        deleteDelaySeconds: 10,
        panelTitle: '## 📂 ATENDIMENTO VOOK',
        panelDescription:
          'Bem-vindo à Central de Atendimento VOOK.\n\nSelecione o motivo do seu contato para iniciar um atendimento privado com nossa equipe. Após escolher uma categoria, informe um assunto claro e aguarde o retorno de um responsável.',
        panelNotice:
          '### Antes de abrir um atendimento\n\n* Abra apenas um ticket por solicitação.\n* Escolha a categoria correspondente ao seu assunto.\n* Explique sua necessidade de maneira clara e objetiva.\n* Não mencione a equipe repetidamente; seu atendimento será respondido assim que possível.',
        logoUrl: 'https://i.imgur.com/83pZmqv.png',
      },
    });
  }

  /**
   * Update guild-specific settings.
   */
  public static async update(
    guildId: string,
    data: Partial<Omit<GuildSettings, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<GuildSettings> {
    return await prisma.guildSettings.update({
      where: { guildId },
      data,
    });
  }
}

export default SettingsRepository;
