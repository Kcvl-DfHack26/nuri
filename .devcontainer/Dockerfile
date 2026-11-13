FROM oven/bun:1.4.4 AS bun
FROM ghcr.io/terraform-linters/tflint:v0.66.0 AS tflint
FROM node:26.13.0-bookworm

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
COPY --from=ghcr.io/opentofu/opentofu:1.13.8 /usr/local/bin/tofu /usr/local/bin/tofu
COPY --from=tflint /usr/local/bin/tflint /usr/local/bin/tflint
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git gnupg openssh-client postgresql-client sudo unzip \
    && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main' > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y --no-install-recommends google-cloud-cli \
    && rm -rf /var/lib/apt/lists/* \
    && echo 'node ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/node
RUN BUN_INSTALL=/usr/local bun install --global @openai/codex@0.166.0
RUN mkdir -p /workspace/node_modules /workspace/apps/mobile/node_modules /workspace/apps/api/node_modules /workspace/packages/shared/node_modules /home/node/.bun /home/node/.expo /home/node/.config/gcloud && chown -R node:node /workspace /home/node
USER node
WORKDIR /workspace
