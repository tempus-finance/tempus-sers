require('dotenv').config();
import "@nomiclabs/hardhat-ethers";
import 'hardhat-deploy';
import 'hardhat-gas-reporter';

if (process.env.HARDHAT_FORK) {
  process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK;
}

function getNodeUrl(networkName: string) : string {
  const nodeUriEnvVar = 'ETH_NODE_URI_' + networkName.toUpperCase();
  
  const uri = process.env[nodeUriEnvVar];
  if (!uri) {
    throw new Error(
      `network ${networkName} node URI is not configured. Set ${nodeUriEnvVar} environment variables.`
    );
  }

  return uri;
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      // process.env.HARDHAT_FORK will specify the network that the fork is made from.
      forking: process.env.HARDHAT_FORK
        ? {
            url: getNodeUrl(process.env.HARDHAT_FORK),
            blockNumber: process.env.HARDHAT_FORK_NUMBER
              ? parseInt(process.env.HARDHAT_FORK_NUMBER)
              : undefined,
          }
        : undefined
    }
  },
  namedAccounts: {
    elonMuskEnsNameOwner: "0x983110309620D911731Ac0932219af06091b6744" // owner of the elonmusk.eth ENS name (https://app.ens.domains/name/elonmusk.eth)
  }
};
