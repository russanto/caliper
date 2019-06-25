'use strict';

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('transferFrom.js');

module.exports.info  = 'transfer money';

let account_array = [];
let allowed = {};
let transfered = {};
let txnPerBatch;
let allowerMoney;
let bc, contx;

module.exports.init = async function(blockchain, context, args) {
    if(!args.hasOwnProperty('allowerMoney')) {
        return Promise.reject(new Error('mintable.transfer - \'allowerMoney\' is missed in the arguments'));
    }
    allowerMoney = args.allowerMoney;

    if(!args.hasOwnProperty('txnPerBatch')) {
        args.txnPerBatch = 1;
    }
    txnPerBatch = args.txnPerBatch;

    bc = blockchain;
    contx = context;

    for (let i=0; i<blockchain.bcObj.ethereumConfig.accounts.length; i++) {
        let account = blockchain.bcObj.ethereumConfig.accounts[i].address;
        account_array.push(account);
        let queryAllowance = await bc.queryState(contx, 'mintable', 'v0', [account, blockchain.bcObj.ethereumConfig.fromAddress], 'allowance');
        allowed[account] = queryAllowance.GetResult();
    }
    
    return Promise.resolve();
    
};

function getRandomAccount() {
    return account_array[Math.floor(Math.random() * account_array.length)]
}

function generateTransferFrom() {
    let receiver = getRandomAccount();
    
    let granter = getRandomAccount();
    while (allowed[granter] <= 0) {
        granter = getRandomAccount();
    }

    return {
        'verb': 'transferFrom',
        'args': [granter, receiver, allowerMoney]
    };
}

module.exports.run = function() {
    return bc.invokeSmartContract(contx, 'mintable', 'v0', [generateTransferFrom()], 100);
};

module.exports.end = function() {
    return Promise.resolve();
};

module.exports.transfered = transfered; // to implement if needed
