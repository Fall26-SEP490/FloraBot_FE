FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.10.0
COPY . .
RUN pnpm install --frozen-lockfile
ARG SITE_URL=http://localhost:8088
RUN PUBLIC_API_URL=/api PUBLIC_PORTAL_URL=/login SITE_URL=$SITE_URL pnpm --filter @florabot/landing build
RUN VITE_BASE_PATH=/portal/ VITE_LANDING_URL=/ pnpm --filter @florabot/portal build
RUN VITE_BASE_PATH=/kiosk/ pnpm --filter @florabot/kiosk build

FROM caddy:2-alpine
COPY --from=build /workspace/apps/landing/dist /srv/landing
COPY --from=build /workspace/apps/portal/dist /srv/portal
COPY --from=build /workspace/apps/kiosk/dist /srv/kiosk
