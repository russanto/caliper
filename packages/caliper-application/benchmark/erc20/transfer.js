'use strict';

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('transfer.js');

module.exports.info  = 'transfer money';

let account_array = [];
let balances = {};
let txnPerBatch;
let transferMoney, allowerMoney;
let bc, contx;

let countTransfer = 0, countTransferFrom = 0, countApproval = 0;

module.exports.init = function(blockchain, context, args) {
    if(!args.hasOwnProperty('transferMoney')) {
        return Promise.reject(new Error('mintable.transfer - \'transferMoney\' is missed in the arguments'));
    }
    transferMoney = args.transferMoney;

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
        account_array.push(account.address)
        balances[account.address] = {
            balance: blockchain.bcObj.ethereumConfig.contracts.mintable.constructorArgs[0] / blockchain.bcObj.ethereumConfig.accounts.length,
            allowance: {}
        };
    });

    blockchain.bcObj.ethereumConfig.accounts.forEach(allower => {
        blockchain.bcObj.ethereumConfig.accounts.forEach(receiver => {
            balances[receiver.address].allowance[allower.address] = 0;
        });
    });

    return Promise.resolve()
    
};

function getRandomAccount() {
    return account_array[Math.floor(Math.random() * account_array.length)]
}

function generateTransfer() {
    let sender = getRandomAccount();
    let receiver = getRandomAccount();
    balances[sender].balance -= transferMoney;
    balances[receiver].balance += transferMoney;
    return {
        'fromAddress': sender,
        'verb': 'transfer',
        'args': [receiver, transferMoney]
    }
}

function generateApprove() {
    let approver = getRandomAccount();
    let receiver = getRandomAccount();
    balances[approver].balance -= allowerMoney;
    balances[receiver].allowance[approver] += allowerMoney;
    return {
        'fromAddress': approver,
        'verb': 'approve',
        'args': [receiver, allowerMoney]
    }
}

function generateTransferFrom() {
    let sender = getRandomAccount();
    let receiver = getRandomAccount();
    let granter = false;
    for (var potentialGranter in balances[sender].allowance) {
        if (balances[sender].allowance[potentialGranter] && balances[sender].allowance[potentialGranter] >= allowerMoney) {
            granter = potentialGranter;
        }
    }
    if (!granter) {
        return false;
    }
    balances[receiver].balance += allowerMoney;
    balances[sender].allowance[granter] -= allowerMoney;
    return {
        'fromAddress': sender,
        'verb': 'transferFrom',
        'args': [granter, receiver, allowerMoney]
    }
}

/**
 * Generates simple workload
 * @returns {Object} array of json objects
 */
function generateWorkload() {
    let workload = [];
    for(let i= 0; i < txnPerBatch; i++) {
        let verbID = Math.floor(Math.random() * 3);

        switch (verbID) {
            case 0:
                countTransfer += 1;
                workload.push(generateTransfer());
                break;
            case 1:
                countApproval += 1;
                workload.push(generateApprove());
                break;
            case 2:
                let methodCall = generateTransferFrom();
                if (methodCall) {
                    countTransferFrom += 1;
                    workload.push(methodCall);
                } else {
                    countApproval += 1;
                    workload.push(generateApprove());
                }
                break;
        }
        
    }
    return workload;
}

module.exports.run = function() {
    let args = generateWorkload();
    return bc.invokeSmartContract(contx, 'mintable', 'v0', args, 100);
};

module.exports.end = function() {
    console.log("Transfer: " + countTransfer + " - Approval: " + countApproval + " - TransferFrom: " + countTransferFrom);
    return Promise.resolve();
};

module.exports.account_array = account_array;
