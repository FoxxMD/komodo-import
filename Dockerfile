FROM node:22-alpine as base

RUN apk add --no-cache dumb-init git

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ENV TZ=Etc/GMT \
    NODE_ENV="production" \
    IS_DOCKER=true \
    COLORED_STD=true \
    MOUNT_DIR=/filesOnServer

FROM base as builder

WORKDIR /usr/src/app

COPY --chown=node:node . /usr/src/app

RUN npm install --omit=dev \
    && npm cache clean --force \
    && chown -R node:node node_modules \
    && rm -rf node_modules/@types

FROM base as app

USER 1000

WORKDIR /usr/src/app

COPY --chown=node:node --from=builder /usr/src/app /usr/src/app

CMD ["dumb-init", "node", "/usr/src/app/node_modules/.bin/tsx", "/usr/src/app/src/index.ts"]