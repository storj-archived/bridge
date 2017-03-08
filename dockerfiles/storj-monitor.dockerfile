FROM storjlabs/node-base:6.9.4

ENV NODE_ENV production

# Should we use a user here?

RUN mkdir /bridge
RUN mkdir /etc/storj

COPY . /bridge/

WORKDIR /bridge

# Could use --production to run faster
RUN npm install

CMD ["node", "bin/storj-monitor"]
