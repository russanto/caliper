FROM node:8-jessie
COPY . /caliper
WORKDIR /caliper
RUN npm install && npm run bootstrap
WORKDIR /caliper/packages/caliper-application/scripts
CMD [ "/bin/bash", "-c", "node run-benchmark.js -c ../benchmark/$BENCHMARK/config-$BLOCKCHAIN.yaml -n ../network/$BLOCKCHAIN/$BC_CONF/$BLOCKCHAIN.json" ]