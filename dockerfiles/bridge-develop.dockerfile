FROM bryanchriswhite/devops:thor

RUN apt-get update
RUN apt-get install -y git

RUN mkdir /bridge
WORKDIR /bridge

ADD ./dockerfiles/files/bridge.config.develop.json /bridge/bridge.config.develop.json
RUN mkdir -p $HOME/.storj-bridge/config
RUN mv /bridge/bridge.config.develop.json $HOME/.storj-bridge/config/develop

ADD ./dockerfiles/files/bridge.config.test.json /bridge/bridge.config.test.json
RUN mkdir -p $HOME/.storj-bridge/config
RUN mv /bridge/bridge.config.test.json $HOME/.storj-bridge/config/test

ADD ./package.json /bridge/package.json

RUN npm i -g nodemon
RUN npm i
