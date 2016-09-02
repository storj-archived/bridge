FROM storjlabs/docker-nodejs:4.1.1

# Apt
RUN apt-get update
RUN apt-get install -y git wget curl
RUN apt-get install -y rabbitmq-server
RUN service rabbitmq-server start
RUN mkdir /bridge
WORKDIR /bridge

ADD ./docker/bridge.config /bridge/bridge.config
RUN mkdir -p $HOME/.storj-bridge/config
RUN mv /bridge/bridge.config $HOME/.storj-bridge/config/develop

ADD ./package.json /bridge/package.json

# Install node modules for production (i.e. don't install devdeps)
RUN npm install
