FROM bryanchriswhite/devops:thor

RUN mkdir /bridge
WORKDIR /bridge

ADD . /bridge

RUN npm i

WORKDIR /storj-base
RUN thor setup:clone /bridge

WORKDIR /bridge

CMD node /bridge/bin/storj-bridge.js
