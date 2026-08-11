FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libreoffice-core \
       libreoffice-writer \
       fonts-liberation \
       fonts-dejavu-core \
       fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY server.mjs ./

ENV PORT=10000

EXPOSE 10000

CMD ["node", "server.mjs"]
