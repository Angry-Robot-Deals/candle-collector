# syntax=docker/dockerfile:1
# Multi-stage build with pnpm (Node 24 LTS). See pnpm.io/docker

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /usr/app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /usr/app/node_modules /usr/app/node_modules
COPY . .
RUN pnpm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=build /usr/app/node_modules /usr/app/node_modules
COPY --from=build /usr/app/dist /usr/app/dist
COPY --from=build /usr/app/package.json /usr/app/package.json
COPY --from=build /usr/app/prisma /usr/app/prisma
CMD ["pnpm", "run", "start:prod"]
