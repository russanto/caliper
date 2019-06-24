async function init(mintableInstance, ethereumConfig) {
    let accountQuota = Math.floor(ethereumConfig.contracts.mintable.constructorArgs[0]/ethereumConfig.accounts.length);
    let promises = [];
    ethereumConfig.accounts.forEach(account => {
        promises.push(mintableInstance.methods.transfer(account.address, accountQuota).send({
            from: ethereumConfig.contractDeployerAddress
        }));
    });
    await Promise.all(promises);

    promises = [];
    allowanceQuota = Math.floor(accountQuota / (ethereumConfig.accounts.length * 2));
    ethereumConfig.accounts.forEach(allower => {
        ethereumConfig.accounts.forEach(spender => {
            promises.push(mintableInstance.methods.transfer(spender.address, accountQuota).send({
                from: allower.address
            }));
        });
    });

    return Promise.all(promises)
}

module.exports.init = init