FROM node:24
# [Reference](https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile)

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

WORKDIR /workspace

# Align node UID/GID with host to avoid permission issues on bind mounts
ARG NODE_UID=1000
ARG NODE_GID=1000

USER root

# Align node UID/GID with host to avoid permission issues on bind mounts
RUN set -eux; \
  # If some other user/group already uses the target IDs, try to move them away (best-effort)
  if getent group "${NODE_GID}" >/dev/null 2>&1; then \
    existing_group="$(getent group "${NODE_GID}" | cut -d: -f1)"; \
    if [ "${existing_group}" != "node" ]; then groupmod -g 1999 "${existing_group}" || true; fi; \
  fi; \
  if getent passwd "${NODE_UID}" >/dev/null 2>&1; then \
    existing_user="$(getent passwd "${NODE_UID}" | cut -d: -f1)"; \
    if [ "${existing_user}" != "node" ]; then usermod -u 1999 "${existing_user}" || true; fi; \
  fi; \
  groupmod -g "${NODE_GID}" node; \
  usermod  -u "${NODE_UID}" -g "${NODE_GID}" node; \
  chown -R node:node /home/node /commandhistory /usr/local/share/npm-global /home/node/.claude

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node

ENV ANTHROPIC_BASE_URL="http://host.docker.internal:1234"
ENV ANTHROPIC_AUTH_TOKEN="lmstudio"
