FROM storjlabs/docker-nodejs:4.1.1

RUN mkdir /bridge
WORKDIR /bridge

ADD ./docker/bridge.config.json /bridge/bridge.config.json
RUN mkdir -p $HOME/.storj-bridge/config
RUN mv /bridge/bridge.config.json $HOME/.storj-bridge/config/develop

ADD ./package.json /bridge/package.json

RUN npm install
