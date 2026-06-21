# =============================================================================
# Stage 1: builder — install all deps and compile TypeScript
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first — npm install is cached until package.json changes
COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# =============================================================================
# Stage 2: production — lean image with only compiled JS + prod deps
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
