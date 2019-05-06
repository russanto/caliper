pragma solidity >=0.4.22 <0.6.0;

contract registry {
    mapping(string => address) private contracts;

    function bind(string memory contract_id, address addr) public {
        contracts[contract_id] = addr;
    }

    function lookup(string memory contract_id) public view returns (address addr) {
        addr = contracts[contract_id];
    }
}