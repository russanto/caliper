'use strict';

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('transfer.js');

module.exports.info  = 'transfer money';

let account_array = [];
let transfers = {};
let txnPerBatch;
let transferMoney;
let bc, contx;

module.exports.init = function(blockchain, context, args) {
    if(!args.hasOwnProperty('transferMoney')) {
        return Promise.reject(new Error('mintable.transfer - \'transferMoney\' is missed in the arguments'));
    }
    transferMoney = args.transferMoney;

    if(!args.hasOwnProperty('txnPerBatch')) {
        args.txnPerBatch = 1;
    }
    txnPerBatch = args.txnPerBatch;

    bc = blockchain;
    contx = context;

    blockchain.bcObj.ethereumConfig.accounts.forEach(account => {
        account_array.push(account.address)
        transfers[account.address] = 0
    });

    return Promise.resolve()
    
};

function getRandomAccount() {
    return account_array[Math.floor(Math.random() * account_array.length)]
}

function generateTransfer() {
    let receiver = getRandomAccount();
    return {
        'verb': 'transfer',
        'args': [receiver, transferMoney]
    }
}

module.exports.run = function() {
    let transfer = generateTransfer()
    transfers[transfer.args[0]] += transfer.args[1];
    return bc.invokeSmartContract(contx, 'mintable', 'v0', [transfer], 100);
};

module.exports.end = function() {
    return Promise.resolve();
};

module.exports.transfers = transfers;
