'use strict';

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('transfer.js');

module.exports.info  = 'transfer money';

let account_array = [];
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
    });

    return Promise.resolve()
    
};

function getRandomAccount() {
    return account_array[Math.floor(Math.random() * account_array.length)]
}

/**
 * Generates simple workload
 * @returns {Object} array of json objects
 */
function generateWorkload() {
    let workload = [];
    for(let i= 0; i < txnPerBatch; i++) {
        let address = getRandomAccount();
        account_array.push(address);

        workload.push({
            'verb': 'transfer',
            'to': address,
            'value': transferMoney
        });
    }
    return workload;
}

module.exports.run = function() {
    let args = generateWorkload();
    return bc.invokeSmartContract(contx, 'mintable', 'v0', args, 100);
};

module.exports.end = function() {
    return Promise.resolve();
};

module.exports.account_array = account_array;
