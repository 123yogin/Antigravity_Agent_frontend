# Use Node.js 20 as base
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js app
# Note: We use static export or just run in dev mode for this local project
# For simplicity in this operator UI, we'll run in dev or build
RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
