'use strict';

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('transfer.js');

module.exports.info  = 'transfer money';

let account_array = [];
let approvals = {};
let txnPerBatch;
let allowerMoney;
let bc, contx;

module.exports.init = function(blockchain, context, args) {
    if(!args.hasOwnProperty('allowerMoney')) {
        return Promise.reject(new Error('mintable.approve - \'allowerMoney\' is missed in the arguments'));
    }
    allowerMoney = args.allowerMoney;

    if(!args.hasOwnProperty('txnPerBatch')) {
        args.txnPerBatch = 1;
    }
    txnPerBatch = args.txnPerBatch;

    bc = blockchain;
    contx = context;

    blockchain.bcObj.ethereumConfig.accounts.forEach(account => {
        account_array.push(account.address);
        approvals[account.address] = 0;
    });

    return Promise.resolve()
    
};

function getRandomAccount() {
    return account_array[Math.floor(Math.random() * account_array.length)]
}

function generateApprove() {
    let receiver = getRandomAccount();
    return {
        'verb': 'increaseAllowance',
        'args': [receiver, allowerMoney]
    }
}

module.exports.run = function() {
    let approve = generateApprove();
    approvals[approve.args[0]] = approve.args[1];
    return bc.invokeSmartContract(contx, 'mintable', 'v0', [approve], 100);
};

module.exports.end = function() {
    return Promise.resolve();
};

module.exports.approvals = approvals;
