FROM lsiobase/alpine:3.22 as base

ENV TZ=Etc/GMT

RUN \
  echo "**** install build packages ****" && \
  apk add --no-cache \
    git \
    nodejs \
    npm && \
  echo "**** cleanup ****" && \
  rm -rf \
    /root/.cache \
    /tmp/*

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ARG config=/config
VOLUME $config
ENV CONFIG_DIR=$config

COPY docker/root/ /

WORKDIR /app

FROM base as app

COPY --chown=abc:abc . /app

ENV NODE_ENV="production"
ENV IS_DOCKER=true
ENV FILES_ON_SERVER_DIR=/filesOnServer
ENV COLORED_STD=true

RUN npm install --omit=dev \
    && npm cache clean --force \
    && chown -R abc:abc node_modules \
    && rm -rf node_modules/@types
