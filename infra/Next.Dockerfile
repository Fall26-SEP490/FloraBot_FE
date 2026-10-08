FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.10.0
COPY . .
RUN pnpm install --frozen-lockfile
ENV API_PROXY_TARGET=http://gateway:8080
RUN pnpm --filter @florabot/web build

FROM node:24-bookworm-slim
WORKDIR /workspace
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /workspace /workspace
USER node
WORKDIR /workspace/apps/web
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
