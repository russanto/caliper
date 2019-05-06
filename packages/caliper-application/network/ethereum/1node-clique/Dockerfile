FROM ethereum/client-go:stable
COPY ./data/ /root/
VOLUME [ "/root/.ethereum/keystore/" ]
RUN geth init /root/genesis.json && geth import /root/bc.dat
ENTRYPOINT [ "geth" ]