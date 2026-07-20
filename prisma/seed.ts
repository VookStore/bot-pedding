import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const guildId = process.env.DEVELOPER_GUILD_ID || 'default_guild';
  
  console.log(`🌱 Seeding database for guild: ${guildId}...`);

  // 1. Upsert Guild Settings
  const settings = await prisma.guildSettings.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      enabled: true,
      ticketLimitPerUser: 1,
      totalOpenLimit: 50,
      notificationCooldownSeconds: 300,
      closeMode: 'delete',
      deleteDelaySeconds: 10,
      panelTitle: '## 📂 ATENDIMENTO VOOK',
      panelDescription: 'Bem-vindo à Central de Atendimento VOOK.\n\nSelecione o motivo do seu contato para iniciar um atendimento privado com nossa equipe. Após escolher uma categoria, informe um assunto claro e aguarde o retorno de um responsável.',
      panelNotice: '### Antes de abrir um atendimento\n\n* Abra apenas um ticket por solicitação.\n* Escolha a categoria correspondente ao seu assunto.\n* Explique sua necessidade de maneira clara e objetiva.\n* Não mencione a equipe repetidamente; seu atendimento será respondido assim que possível.',
      logoUrl: 'https://i.imgur.com/83pZmqv.png', // VOOK Default Logo placeholder
    },
  });
  console.log(`✅ Guild settings upserted for: ${settings.guildId}`);

  // 2. Create Default Categories
  const defaultCategories = [
    {
      name: 'Orçamento',
      slug: 'orcamento',
      description: 'Solicite uma proposta para planos, sistemas ou projetos personalizados.',
      emoji: '🛒',
      sortOrder: 0,
      channelNamePattern: 'ticket-orcamento-{code}',
      openingMessage: 'Seu atendimento de **Orçamento** foi criado. Por favor, detalhe seu projeto.',
    },
    {
      name: 'Dúvidas',
      slug: 'duvidas',
      description: 'Tire dúvidas sobre nossos serviços, planos, funcionamento ou suporte.',
      emoji: '📂',
      sortOrder: 1,
      channelNamePattern: 'ticket-duvidas-{code}',
      openingMessage: 'Seu atendimento de **Dúvidas** foi criado. Como podemos ajudar você?',
    },
    {
      name: 'Parcerias',
      slug: 'parcerias',
      description: 'Envie uma proposta comercial ou solicitação de parceria para análise.',
      emoji: '🤝',
      sortOrder: 2,
      channelNamePattern: 'ticket-parcerias-{code}',
      openingMessage: 'Seu atendimento de **Parcerias** foi criado. Por favor, apresente sua proposta.',
    },
  ];

  for (const cat of defaultCategories) {
    await prisma.ticketCategory.upsert({
      where: {
        guildId_slug: {
          guildId,
          slug: cat.slug,
        },
      },
      update: {
        name: cat.name,
        description: cat.description,
        emoji: cat.emoji,
        sortOrder: cat.sortOrder,
        active: true,
      },
      create: {
        guildId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        emoji: cat.emoji,
        sortOrder: cat.sortOrder,
        active: true,
        channelNamePattern: cat.channelNamePattern,
        openingMessage: cat.openingMessage,
      },
    });
    console.log(`✅ Category seeded: ${cat.name} (${cat.emoji})`);
  }

  console.log('🌱 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
