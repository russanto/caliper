async function init(mintableInstance, ethereumConfig) {
    let accountQuota = Math.floor(ethereumConfig.contracts.mintable.constructorArgs[0]/ethereumConfig.accounts.length);
    let promises = [];
    ethereumConfig.accounts.forEach(account => {
        promises.push(mintableInstance.methods.transfer(account.address, accountQuota).send({
            from: ethereumConfig.contractDeployerAddress
        }));
    });
    return Promise.all(promises);
}

module.exports.init = init