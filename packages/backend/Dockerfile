# ---- RayVerify backend (NestJS) — multi-stage build ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace @rayverify/backend --workspace @rayverify/shared --include-workspace-root || npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate --workspace @rayverify/backend \
 && npm run build --workspace @rayverify/backend

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
# Run as non-root for least privilege.
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/backend/dist ./dist
COPY --from=build /app/packages/backend/prisma ./prisma
COPY --from=build /app/packages/backend/package.json ./
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
