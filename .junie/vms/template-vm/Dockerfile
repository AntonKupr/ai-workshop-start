# syntax=docker/dockerfile:1.7
#
# Starter VM template for `/demo`. The base image already ships Chromium,
# Node.js, xterm, a window manager, and an ffmpeg recorder configured for
# the demo agent. The project root is mounted at /workspace inside the
# running VM.
#
# Add extra language runtimes or system packages as your app needs.
#
# Full docs: https://junie.jetbrains.com/docs/junie-cli-demo.html
FROM registry.jetbrains.team/p/junie-cli/containers/demo-base:2

# The base ships Node 20; Skill Atlas needs >=24 (package.json "engines") and runs its TypeScript
# sources directly, which only recent Node can do. Node 24 goes into /opt and comes first on PATH,
# so the base image's own Node stays where the demo tooling expects it.
ARG NODE_VERSION=24.22.0
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) arch=x64 ;; \
      arm64) arch=arm64 ;; \
      *) echo "unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.gz" -o /tmp/node.tar.gz; \
    mkdir -p /opt/node; \
    tar -xzf /tmp/node.tar.gz -C /opt/node --strip-components=1; \
    rm /tmp/node.tar.gz
ENV PATH=/opt/node/bin:$PATH
