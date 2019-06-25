/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @file, definition of the Ethereum class, which implements the Caliper's NBI for Ethereum Web3 interface.
 */

'use strict';

const fs = require('fs');
const Web3 = require('web3');
const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('ethereum.js');

/**
 * Implements {BlockchainInterface} for a web3 Ethereum backend.
 */
class Ethereum extends BlockchainInterface {

    /**
     * Create a new instance of the {Ethereum} class.
     * @param {string} config_path The path of the network configuration file.
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
        this.web3.transactionPollingTimeout = this.ethereumConfig.transactionPollingTimeout;
        this.web3.transactionBlockTimeout = this.ethereumConfig.transactionBlockTimeout;
        this.registry = new this.web3.eth.Contract(registryData.abi, this.ethereumConfig.registry.address);
    }

    /**
     * Initialize the {Ethereum} object.
     * @return {object} Promise<boolean> True if the account got unlocked successful otherwise false.
     */
    init() {
        return this.web3.eth.personal.unlockAccount(this.ethereumConfig.contractDeployerAddress, this.ethereumConfig.contractDeployerAddressPassword, null);
    }

    /**
     * Deploy smart contracts specified in the network configuration file.
     * @return {object} Promise execution for all the contract creations.
     */
    async installSmartContract() {
        logger.info("Installing contracts pointed in network file...")
        let promises = [];
        let self = this;
        logger.info("Creating contracts...")
        for (const key of Object.keys(this.ethereumConfig.contracts)) {
            let contractData = require(CaliperUtils.resolvePath(this.ethereumConfig.contracts[key].path, this.workspaceRoot));
            contractData.constructorArgs = this.ethereumConfig.contracts[key].constructorArgs
            promises.push(new Promise(function(resolve, reject) {
                self.deployContract(contractData).then((contractInstance) => {
                    if (self.ethereumConfig.contracts[key].hasOwnProperty('init')) {
                        logger.info("Executing init script for " + key)
                        let initContractModule = require(CaliperUtils.resolvePath(self.ethereumConfig.contracts[key].init, self.workspaceRoot));
                        initContractModule.init(contractInstance, self.ethereumConfig).then((results) => {
                            self.bindContract(key, contractInstance.address).then((receipts) => {
                                logger.info("Contract " + key + " ready at " + contractInstance.address);
                                resolve();
                            })
                        })
                    } else {
                        self.bindContract(key, contractInstance.address).then((receipt) => {
                            logger.info("Contract " + key + " ready at " + contractInstance.address);
                            resolve();
                        })
                    }  
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
        context.web3 = this.web3;
        context.contracts = {};
        await context.web3.eth.personal.unlockAccount(this.ethereumConfig.fromAddress, this.ethereumConfig.fromAddressPassword, null)
        if (this.ethereumConfig.unlockAllPassword) {
            let promises = [];
            this.ethereumConfig.accounts.forEach(account => {
                promises.push(this.web3.eth.personal.unlockAccount(account.address, this.ethereumConfig.unlockAllPassword, null));
            });
            await Promise.all(promises);
        }
        for (const key of Object.keys(this.ethereumConfig.contracts)) {
            let contractData = require(CaliperUtils.resolvePath(this.ethereumConfig.contracts[key].path, this.workspaceRoot)); // TODO remove path property
            let contractAddress = await this.lookupContract(key);
            context.contracts[key] = new context.web3.eth.Contract(contractData.abi, contractAddress)
        }
        return context;
    }

    /**
     * Release the given Ethereum context.
     * @param {object} context The Ethereum context to release.
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
     * @param {Array} invokeData Array of methods calls.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async invokeSmartContract(context, contractID, contractVer, invokeData, timeout) {
        let promises = [];
        invokeData.forEach((item, index) => {
            promises.push(this.sendTransaction(context, contractID, contractVer, item, timeout));
        });
        return Promise.all(promises);
    }

    /**
     * Submit a transaction to the ethereum context.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {Object} methodCall Array of JSON containing methods data.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
     */
    async sendTransaction(context, contractID, contractVer, methodCall, timeout) {
        let status = new TxStatus();
        context.engine.submitCallback(1);
        try {
            let fromAddress = methodCall.fromAddress ? methodCall.fromAddress : context.fromAddress;
            let receipt = null;
            if (methodCall.args) {
                receipt = await context.contracts[contractID].methods[methodCall.verb](...methodCall.args).send({from: fromAddress});
            } else {
                receipt = await context.contracts[contractID].methods[methodCall.verb]().send({from: fromAddress});
            }
            status.SetID(receipt.transactionHash);
            status.SetResult(receipt);
            status.SetVerification(true);
            status.SetStatusSuccess();
        } catch (err) {
            status.SetStatusFail();
            logger.error(err);
        }
        return Promise.resolve(status);
    }

    /**
     * Query the given smart contract according to the specified options.
     * @param {object} context The Ethereum context returned by {getContext}.
     * @param {string} contractID The name of the contract.
     * @param {string} contractVer The version of the contract.
     * @param {Array} keys Argument to pass to the smart contract query.
     * @param {string} [fcn=query] The contract query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, keys, fcn = 'query') {
        let status = new TxStatus();

        if (context.engine) {
            context.engine.submitCallback(1);
        }

        try {
            let receipt = await context.contracts[contractID].methods[fcn](...keys).call();
            status.SetID(null);
            status.SetResult(receipt);
            status.SetVerification(true);
            status.SetStatusSuccess();
        } catch (err) {
            status.SetStatusFail();
            logger.error('Failed reading ' + keys + ' on function ' + fcn);
            logger.error(err);
        }
        return Promise.resolve(status);
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
     * @param {JSON} contractData Contract data with abi, bytecode and gas properties
     * @returns {Promise<web3.eth.Contract>} The deployed contract instance
     */
    deployContract(contractData) {
        let web3 = this.web3
        let contractDeployerAddress = this.ethereumConfig.contractDeployerAddress
        return new Promise(function(resolve, reject) {
            let contract = new web3.eth.Contract(contractData.abi);
            let contractDeployData = {
                data: contractData.bytecode
            }
            if (contractData.hasOwnProperty("constructorArgs") && Array.isArray(contractData.constructorArgs)) {
                contractDeployData.arguments = contractData.constructorArgs
            }
            let contractDeploy = contract.deploy(contractDeployData);
            contractDeploy.send({
                from: contractDeployerAddress,
                gas: contractData.gas
            }).on('error', (error) => {
                reject(error)
            }).then((newContractInstance) => {
                resolve(newContractInstance)
            });
        });
    }
}

module.exports = Ethereum;
