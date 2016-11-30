FROM storjlabs/node-storj:bridge-latest

# TODO: use `production` but first we have to fix packages `engines` to be all compatible with 6.x
#ENV THOR_ENV production
ENV THOR_ENV development

RUN mkdir /bridge
RUN ln -s /storj-base/node_modules/ /bridge/node_modules

COPY ./package.json /bridge/package.json
COPY ./bin /bridge/bin
COPY ./lib /bridge/lib
COPY ./index.js /bridge/index.js

RUN yarn install --ignore-engines

WORKDIR /bridge

CMD npm run start-prod
