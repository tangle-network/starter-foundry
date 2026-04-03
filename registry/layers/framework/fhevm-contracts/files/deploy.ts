import { ethers } from "hardhat";

async function main() {
  const Counter = await ethers.getContractFactory("EncryptedCounter");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();
  console.log("EncryptedCounter deployed to:", await counter.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
