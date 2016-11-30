FROM storjlabs/node-storj:latest

EXPOSE 6382

ENV THOR_ENV development

RUN mkdir /bridge
RUN ln -s /storj-base/node_modules/ /bridge/node_modules

RUN yarn global add nodemon

COPY ./package.json /bridge/package.json
RUN yarn install --ignore-engines

WORKDIR /bridge

CMD npm run start-dev
