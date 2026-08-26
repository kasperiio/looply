FROM cgr.dev/chainguard/nginx:latest AS runtime-base

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/usr/sbin/nginx", "-t"]

# CI target: dist/ is built natively in the workflow, so this stage is pure
# COPY — multi-arch assembly needs no QEMU and runs in seconds.
FROM runtime-base AS prebuilt

COPY dist /usr/share/nginx/html

# Default target: self-contained build for local `docker compose up --build`.
FROM cgr.dev/chainguard/node:latest-dev AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# --chown so a host-built dist/ in the context stays writable for Vite's
# out-dir cleanup (the image runs as the non-root node user)
COPY --chown=node:node . .

# Vite inlines VITE_* vars at build time, so the key must be a build arg
ARG VITE_CARTO_KEY
ENV VITE_CARTO_KEY=$VITE_CARTO_KEY
RUN npm run build

FROM runtime-base AS full

COPY --from=build /app/dist /usr/share/nginx/html
