FROM ethereum/client-go:stable
COPY ./data/ /root/
VOLUME [ "/root/.ethereum/keystore/" ]
RUN geth init /root/genesis.json && geth import /root/bc.dat && geth makedag 0 /root/.ethash && geth makedag 30000 /root/.ethash
ENTRYPOINT [ "geth" ]