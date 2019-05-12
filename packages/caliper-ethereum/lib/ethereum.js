/**
 * Copyright 2017 HUAWEI. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the Burrow class, which implements the Caliper's NBI for Hyperledger Burrow.
 */

'use strict';

const fs = require('fs');
const Web3 = require('web3');
const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('ethereum.js');

/**
 * Implements {BlockchainInterface} for a Geth backend.
 */
class Ethereum extends BlockchainInterface {

    /**
     * Create a new instance of the {Burrow} class.
     * @param {string} config_path The path of the Burrow network configuration file.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'ethereum';
        this.workspaceRoot = workspace_root;
        this.ethereumConfig = require(config_path).ethereum;
        let registryData = require(CaliperUtils.resolvePath(this.ethereumConfig.registry.path, workspace_root))
        this.web3 = new Web3(this.ethereumConfig.url);
        this.web3.transactionConfirmationBlocks = this.ethereumConfig.transactionConfirmationBlocks;
        this.registry = new this.web3.eth.Contract(registryData.abi, this.ethereumConfig.registry.address);
    }

    /**
     * Initialize the {Ethereum} object.
     * @return {object} Promise<boolean> True if the account got unlocked successful otherwise false.
     */
    init() {
        return this.web3.eth.personal.unlockAccount(this.ethereumConfig.contractDeployerAddress, this.ethereumConfig.contractDeployerAddressPassword, null)
    }

    /**
     * Deploy the smart contracts specified in the network configuration file.
     * @return {object} Promise execution for all the contract creations.
     */
    async installSmartContract() {
        logger.info("Installing contracts pointed in network file...")
        let promises = [];
        let self = this;
        for (const key of Object.keys(this.ethereumConfig.contracts)) {
            let contractData = require(CaliperUtils.resolvePath(this.ethereumConfig.contracts[key].path, this.workspaceRoot)); // TODO remove path property
            promises.push(new Promise(function(resolve, reject) {
                self.deployContract(contractData).then((contractInstance) => {
                    self.bindContract(key, contractInstance.address).then((receipt) => {
                        resolve()
                    })
                })
            }));
        }
        return Promise.all(promises);
    }

    /**
     * Return the Ethereum context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Ethereum context.
     * @async
     */
    async getContext(name, args) {
        let context = {fromAddress: this.ethereumConfig.fromAddress};
        context.web3 = new Web3(this.ethereumConfig.url);
        context.web3.transactionConfirmationBlocks = this.ethereumConfig.transactionConfirmationBlocks;
        context.contracts = {};
        await context.web3.eth.personal.unlockAccount(this.ethereumConfig.fromAddress, this.ethereumConfig.fromAddressPassword, null)
        for (const key of Object.keys(this.ethereumConfig.contracts)) {
            let contractData = require(CaliperUtils.resolvePath(this.ethereumConfig.contracts[key].path, this.workspaceRoot)); // TODO remove path property
            let contractAddress = await this.lookupContract(key);
            context.contracts[key] = new context.web3.eth.Contract(contractData.abi, contractAddress)
        }
        return context;
    }

    /**
     * Release the given Burrow context.
     * @param {object} context The Burrow context to release.
     * @async
     */
    async releaseContext(context) {
        // nothing to do
    }

    /**
     * Invoke a smart contract.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {Array} args Array of JSON formatted arguments for multiple transactions.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        args.forEach((item, index) => {
            promises.push(this.sendTransaction(context, contractID, contractVer, item, 100));
        });
        return Promise.all(promises);
    }

    /**
     * Submit a transaction to the ethereum context.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {Array} args Array of JSON formatted arguments for multiple transactions.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
     */
    async sendTransaction(context, contractID, contractVer, args, timeout) {
        let verb = args.verb;
        delete args.verb
        let status = new TxStatus();
        try {
            context.engine.submitCallback(1);
            let receipt = await context.contracts[contractID].methods[verb](...Object.values(args)).send({from: context.fromAddress});
            status.SetID(receipt.transactionHash);
            status.SetResult(receipt);
            status.SetVerification(true);
            status.SetStatusSuccess();
        } catch (err) {
            console.log(err);
            status.SetStatusFail();
            logger.error('Failed TX');
        }
        return Promise.resolve(status);
    }

    /**
     * Query the given smart contract according to the specified options.
     * @param {object} context The Ethereum context returned by {getContext}.
     * @param {string} contractID The name of the contract.
     * @param {string} contractVer The version of the contract.
     * @param {string} key The argument to pass to the smart contract query.
     * @param {string} [fcn=query] The contract query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, key, fcn = 'query') {
        let status = new TxStatus();

        if (context.engine) {
            context.engine.submitCallback(1);
        }

        try {
            let receipt = await context.contracts[contractID].methods[fcn](key).call();
            status.SetID(receipt.transactionHash);
            status.SetResult(receipt);
            status.SetVerification(true);
            status.SetStatusSuccess();
        } catch (err) {
            console.log(err);
            status.SetStatusFail();
        }
        return Promise.resolve(status);
    }

    /**
     * Get adapter specific transaction statistics.
     * @param {JSON} stats txStatistics object
     * @param {Array} results array of txStatus objects.
     */
    getDefaultTxStats(stats, results) {
        // empty
    }

    /**
     * Fetch the address for the contract with the given label from the registry
     * @param {string} contract_id
     * @return {string} The contract address
     */
    lookupContract(label) {
        return this.registry.methods.lookup(label).call();
    }

    /**
     * Binds the address to the label registering on the registry
     * @param {string} label label to bind address to
     * @param {string} address deployed contract address
     */
    bindContract(label, address) {
        return this.registry.methods.bind(label, address).send({from: this.ethereumConfig.contractDeployerAddress});
    }

    /**
     * Deploys a new contract using the given web3 instance
     * @param {JSON} contractData Contract data with abi and bytecode properties
     * @returns {Promise<web3.eth.Contract>} The deployed contract instance
     */
    deployContract(contractData) {
        let web3 = this.web3
        let contractDeployerAddress = this.ethereumConfig.contractDeployerAddress
        return new Promise(function(resolve, reject) {
            let contract = new web3.eth.Contract(contractData.abi);
            let contractDeploy = contract.deploy({
                data: contractData.bytecode
            });
            contractDeploy.send({
                from: contractDeployerAddress,
                gas: contractData.gas
            }).on('error', (error) => {
                reject(error)
            }).then((newContractInstance) => {
                logger.info("Deployed contract " + contractData.name + " at " + newContractInstance.options.address);
                resolve(newContractInstance)
            });
        });
    }
}

module.exports = Ethereum;
