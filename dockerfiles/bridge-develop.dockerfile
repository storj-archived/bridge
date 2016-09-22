FROM node:4.5

RUN apt-get update
RUN apt-get install -y git

RUN mkdir /bridge
WORKDIR /bridge

ADD ./dockerfiles/files/bridge.config.json /bridge/bridge.config.json
RUN mkdir -p $HOME/.storj-bridge/config
RUN mv /bridge/bridge.config.json $HOME/.storj-bridge/config/develop
RUN cp $HOME/.storj-bridge/config/develop $HOME/.storj-bridge/config/test

ADD ./package.json /bridge/package.json

RUN npm install
