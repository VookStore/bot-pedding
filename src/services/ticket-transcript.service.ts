import { TextChannel, Message } from 'discord.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import env from '../config/env';
import logger from '../logger/logger';
import { formatDuration } from '../shared/utils/format-duration';

interface TranscriptMetadata {
  ticketCode: string;
  serverName: string;
  channelName: string;
  categoryName: string;
  subject: string;
  clientTag: string;
  assignedTag: string;
  closedByTag: string;
  openedAt: Date;
  closedAt: Date;
  closeReason: string;
}

export class TicketTranscriptService {
  private static s3Client: S3Client | null = null;

  static {
    if (
      env.TRANSCRIPT_STORAGE_MODE === 's3' &&
      env.S3_ENDPOINT &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY &&
      env.S3_BUCKET
    ) {
      logger.info('Initializing S3/R2 client for transcript uploads...');
      this.s3Client = new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION || 'auto',
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  /**
   * Paginate and fetch all messages from a channel, sorted from oldest to newest.
   */
  public static async fetchAllMessages(channel: TextChannel): Promise<Message[]> {
    const allMessages: Message[] = [];
    let lastId: string | undefined = undefined;

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = { limit: 100 };
      if (lastId) {
        options.before = lastId;
      }

      const messages = (await channel.messages.fetch(options)) as any;
      if (messages.size === 0) {
        break;
      }

      messages.forEach((msg: any) => allMessages.push(msg));
      lastId = messages.last()?.id;

      if (messages.size < 100) {
        break;
      }
    }

    // Sort chronologically (oldest first)
    return allMessages.reverse();
  }

  /**
   * Generates a premium HTML transcript of the ticket conversation.
   */
  public static generateHtml(meta: TranscriptMetadata, messages: Message[]): string {
    const duration = formatDuration(meta.openedAt, meta.closedAt);

    // Escape helper
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Format content with basic markdown (bold, italic, code, links)
    const formatMessageContent = (content: string) => {
      let escaped = escapeHtml(content);

      // Code blocks
      escaped = escaped.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>');
      // Inline code
      escaped = escaped.replace(/`([^`]+?)`/g, '<code>$1</code>');
      // Bold
      escaped = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
      // Italic
      escaped = escaped.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
      // Links
      escaped = escaped.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
      );
      // Newlines
      escaped = escaped.replace(/\n/g, '<br>');

      return escaped;
    };

    // Build message elements HTML
    const messagesHtml = messages
      .map((msg) => {
        const isBot = msg.author.bot;
        const avatarUrl = msg.author.displayAvatarURL({ size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const timestampStr = msg.createdAt.toLocaleString('pt-BR');

        let contentHtml = '';
        if (msg.content) {
          contentHtml = `<div class="msg-text">${formatMessageContent(msg.content)}</div>`;
        }

        // Attachments
        let attachmentsHtml = '';
        if (msg.attachments.size > 0) {
          attachmentsHtml = '<div class="msg-attachments">';
          msg.attachments.forEach((att) => {
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name || '');
            if (isImage) {
              attachmentsHtml += `<div class="attachment-image"><img src="${att.url}" alt="${escapeHtml(att.name || 'Image')}" /></div>`;
            } else {
              attachmentsHtml += `<div class="attachment-file">📁 <a href="${att.url}" target="_blank">${escapeHtml(att.name || 'Anexo')}</a> (${(att.size / 1024).toFixed(1)} KB)</div>`;
            }
          });
          attachmentsHtml += '</div>';
        }

        return `
        <div class="message-card ${isBot ? 'bot-message' : ''}">
          <img class="avatar" src="${avatarUrl}" alt="${escapeHtml(msg.author.username)}" />
          <div class="msg-body">
            <div class="msg-header">
              <span class="username">${escapeHtml(msg.author.username)}</span>
              ${isBot ? '<span class="bot-badge">BOT</span>' : ''}
              <span class="timestamp">${timestampStr}</span>
            </div>
            ${contentHtml}
            ${attachmentsHtml}
          </div>
        </div>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Transcript - ${escapeHtml(meta.ticketCode)}</title>
        <style>
          body {
            background-color: #0f111a;
            color: #e2e8f0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            background-color: #1a1d29;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 25px;
            border-left: 4px solid #5865f2;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .header h1 {
            margin-top: 0;
            color: #ffffff;
            font-size: 24px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 14px;
          }
          .meta-item strong {
            color: #94a3b8;
          }
          .conclusion-box {
            background-color: #242838;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            font-size: 14px;
            border-left: 3px solid #10b981;
          }
          .conclusion-box h3 {
            margin-top: 0;
            margin-bottom: 8px;
            color: #10b981;
          }
          .chat-history {
            background-color: #161824;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .chat-history h2 {
            font-size: 18px;
            margin-top: 0;
            margin-bottom: 20px;
            color: #ffffff;
            border-bottom: 1px solid #2e303f;
            padding-bottom: 10px;
          }
          .message-card {
            display: flex;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #242635;
          }
          .message-card:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            margin-right: 15px;
            background-color: #2f3136;
          }
          .msg-body {
            flex-grow: 1;
          }
          .msg-header {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
          }
          .username {
            font-weight: bold;
            color: #ffffff;
            margin-right: 8px;
          }
          .bot-badge {
            background-color: #5865f2;
            color: #ffffff;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 5px;
            border-radius: 3px;
            margin-right: 8px;
          }
          .timestamp {
            font-size: 12px;
            color: #64748b;
          }
          .msg-text {
            font-size: 14px;
            line-height: 1.5;
            word-break: break-word;
          }
          .msg-text a {
            color: #5865f2;
            text-decoration: none;
          }
          .msg-text a:hover {
            text-decoration: underline;
          }
          pre {
            background-color: #0c0d14;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 5px 0;
          }
          code {
            font-family: Consolas, Monaco, monospace;
            background-color: #0c0d14;
            padding: 2px 4px;
            border-radius: 3px;
          }
          pre code {
            padding: 0;
            background-color: transparent;
          }
          .msg-attachments {
            margin-top: 10px;
          }
          .attachment-image img {
            max-width: 100%;
            max-height: 350px;
            border-radius: 6px;
            margin-top: 5px;
          }
          .attachment-file {
            background-color: #242838;
            padding: 8px 12px;
            border-radius: 6px;
            display: inline-block;
            font-size: 13px;
            margin-top: 5px;
          }
          .attachment-file a {
            color: #e2e8f0;
            text-decoration: none;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            margin-top: 30px;
            padding-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Histórico de Atendimento VOOK</h1>
            <div class="meta-grid">
              <div class="meta-item"><strong>Ticket:</strong> ${escapeHtml(meta.ticketCode)}</div>
              <div class="meta-item"><strong>Servidor:</strong> ${escapeHtml(meta.serverName)}</div>
              <div class="meta-item"><strong>Canal:</strong> #${escapeHtml(meta.channelName)}</div>
              <div class="meta-item"><strong>Categoria:</strong> ${escapeHtml(meta.categoryName)}</div>
              <div class="meta-item"><strong>Cliente:</strong> ${escapeHtml(meta.clientTag)}</div>
              <div class="meta-item"><strong>Responsável:</strong> ${escapeHtml(meta.assignedTag)}</div>
              <div class="meta-item"><strong>Fechado por:</strong> ${escapeHtml(meta.closedByTag)}</div>
              <div class="meta-item"><strong>Aberto em:</strong> ${meta.openedAt.toLocaleString('pt-BR')}</div>
              <div class="meta-item"><strong>Finalizado em:</strong> ${meta.closedAt.toLocaleString('pt-BR')}</div>
              <div class="meta-item"><strong>Duração:</strong> ${duration}</div>
            </div>
            <div class="conclusion-box">
              <h3>Conclusão do Atendimento</h3>
              <div>${formatMessageContent(meta.closeReason)}</div>
            </div>
          </div>
          <div class="chat-history">
            <h2>Mensagens do Canal</h2>
            ${messagesHtml}
          </div>
          <div class="footer">
            Gerado automaticamente por VOOK Tickets &bull; ${new Date().getFullYear()}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates a transcript and uploads it to S3/R2, or writes it locally.
   * Returns an object containing the transcriptUrl (if uploaded) and the raw HTML Buffer.
   */
  public static async processTranscript(
    channel: TextChannel,
    meta: TranscriptMetadata,
  ): Promise<{ transcriptUrl: string | null; transcriptStorageKey: string | null; buffer: Buffer }> {
    try {
      const messages = await this.fetchAllMessages(channel);
      const htmlContent = this.generateHtml(meta, messages);
      const buffer = Buffer.from(htmlContent, 'utf-8');

      const fileName = `transcript-${meta.ticketCode}-${Date.now()}.html`;

      // 1. Attempt S3/R2 upload if configured
      if (this.s3Client && env.S3_BUCKET) {
        try {
          const storageKey = `transcripts/${meta.ticketCode}/${fileName}`;
          logger.info({ bucket: env.S3_BUCKET, key: storageKey }, 'Uploading transcript to S3/R2 storage...');

          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: env.S3_BUCKET,
              Key: storageKey,
              Body: buffer,
              ContentType: 'text/html; charset=utf-8',
              // Note: depending on the bucket, ACL public-read is optional or configured on bucket policies
            }),
          );

          const publicBaseUrl = env.S3_PUBLIC_BASE_URL || `https://${env.S3_BUCKET}.s3.amazonaws.com`;
          const transcriptUrl = `${publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;

          logger.info({ url: transcriptUrl }, 'Transcript successfully uploaded to S3.');
          return { transcriptUrl, transcriptStorageKey: storageKey, buffer };
        } catch (s3Err) {
          logger.error(s3Err, 'S3 upload failed. Falling back to local transcript storage.');
        }
      }

      // 2. Local fallback
      const localDir = env.TRANSCRIPT_LOCAL_PATH;
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      const localFilePath = path.join(localDir, fileName);
      fs.writeFileSync(localFilePath, buffer);
      logger.info({ path: localFilePath }, 'Transcript saved to local disk storage.');

      return {
        transcriptUrl: null,
        transcriptStorageKey: localFilePath,
        buffer,
      };
    } catch (err) {
      logger.error(err, 'Error processing transcript generation');
      throw err;
    }
  }
}

export default TicketTranscriptService;
