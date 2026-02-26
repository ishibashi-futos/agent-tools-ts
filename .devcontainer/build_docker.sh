#!/bin/bash

docker build --no-cache \
  --build-arg NODE_UID="$(id -u)" \
  --build-arg NODE_GID="$(id -g)" \
  -t claude:node24 .
