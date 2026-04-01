import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "fhenix-hardhat-plugin";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    fhenix: {
      url: "https://api.helium.fhenix.zone",
      chainId: 8008135,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
