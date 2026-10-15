# Sanad Commerce — production image (multi-stage).
# Build:   docker build -t sanad:latest .
# Compose: docker compose up --build   (db + migrate + app)

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY server ./server
COPY scripts ./scripts
COPY src ./src
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
ENV DATABASE_URL="postgresql://sanad:sanad@localhost:5432/sanad"
RUN node node_modules/prisma/build/index.js generate \
 && npx vite build \
 && node scripts/build-server.mjs

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 1001 sanad
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Pre-generated Prisma client (built without the CLI in this stage).
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Native bindings required at runtime (argon2, pg).
COPY --from=build /app/node_modules/argon2 ./node_modules/argon2
COPY --from=build /app/node_modules/pg ./node_modules/pg
COPY --from=build /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg
RUN chown -R sanad:sanad /app
USER sanad
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '5000') + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "dist-server/server.cjs"]
