'use strict';

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('transfer.js');

module.exports.info  = 'transfer money';

let account_array = [];
let allowed = {};
let balance;
let txnPerBatch;
let transferMoney, allowerMoney;
let bc, contx;

let countTransfer = 0, countTransferFrom = 0, countApproval = 0;

module.exports.init = async function(blockchain, context, args) {
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

    let queryBalance = await bc.queryState(contx, 'mintable', 'v0', [blockchain.bcObj.ethereumConfig.fromAddress], 'balanceOf');
    balance = queryBalance.GetResult().toNumber();

    console.log(balance);

    for (let i=0; i<blockchain.bcObj.ethereumConfig.accounts.length; i++) {
        let account = blockchain.bcObj.ethereumConfig.accounts[i].address;
        account_array.push(account);
        let queryAllowance = await bc.queryState(contx, 'mintable', 'v0', [account, blockchain.bcObj.ethereumConfig.fromAddress], 'allowance');
        allowed[account] = queryAllowance.GetResult().toNumber();
        console.log("Allowance:" + allowed[account]);
    }

    // To take away previously queryState from transaction count
    contx.engine.submitCallback(-1*(blockchain.bcObj.ethereumConfig.accounts.length+1));

    return Promise.resolve()  
};

function getRandomAccount() {
    return account_array[Math.floor(Math.random() * account_array.length)]
}

function generateTransfer() {
    if (balance - transferMoney < 0) {
        return false;
    }
    let receiver = getRandomAccount();
    balance -= transferMoney;
    countTransfer += 1;
    return {
        'verb': 'transfer',
        'args': [receiver, transferMoney]
    };
}

function generateApprove() {
    if (balance - allowerMoney < 0) {
        return false;
    }
    balance -= allowerMoney;
    let receiver = getRandomAccount();
    countApproval += 1;
    return {
        'verb': 'approve',
        'args': [receiver, allowerMoney]
    };
}

function generateTransferFrom() {
    let receiver = getRandomAccount();
    for (var granter in allowed) {
        if (allowed[granter] - allowerMoney >= 0) {
            allowed[granter] -= allowerMoney;
            countTransferFrom += 1;
            return {
                'verb': 'transferFrom',
                'args': [granter, receiver, allowerMoney]
            }
        }
    }
    return false;
}

/**
 * Generates simple workload
 * @returns {Object} array of json objects
 */
function generateWorkload() {
    let possibleCalls = [generateTransfer, generateTransferFrom];
    let workload = [];
    for(let i= 0; i < txnPerBatch; i++) {
        let initRandom = Math.floor(Math.random() * possibleCalls.length);
        let random = initRandom;
        while (true) {
            let methodCall = possibleCalls[random]();
            if (methodCall) {
                workload.push(methodCall);
                break;
            } else {
                random = (random + 1) % possibleCalls.length;
                if (random == initRandom) {
                    throw new Error("Can't generate a workload with available balances and allowances");
                }
            }
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
