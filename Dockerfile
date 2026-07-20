# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json tsconfig.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build typescript compilation and prisma client generation
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy generated Prisma Client and build output
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/scripts ./dist/scripts

# Create local transcripts directory and set correct permissions
RUN mkdir -p /usr/src/app/data/transcripts && chown -R node:node /usr/src/app

USER node

# Run migrations and start the application
CMD ["node", "dist/app.js"]
