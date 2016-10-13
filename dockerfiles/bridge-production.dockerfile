FROM node:4.5

RUN mkdir /bridge
WORKDIR /bridge

ADD . /bridge

RUN npm i

CMD node /bridge/bin/storj-bridge.js
