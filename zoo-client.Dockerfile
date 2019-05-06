FROM node:8-jessie
COPY . /caliper
WORKDIR /caliper
RUN npm install && npm run bootstrap
WORKDIR /caliper/packages/caliper-application/scripts
CMD [ "/bin/sh", "-c", "node start-zoo-client.js -a $ZOO_SERVER:2181 -n ../network/$BLOCKCHAIN/$BC_CONF.json" ]