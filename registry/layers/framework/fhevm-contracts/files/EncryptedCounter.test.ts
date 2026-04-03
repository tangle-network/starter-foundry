import { expect } from "chai";
import hre from "hardhat";
import { FhevmClient } from "@fhevm-sdk/core";

describe("EncryptedCounter", function () {
  let counter: any;
  let client: FhevmClient;
  let owner: any;

  beforeEach(async function () {
    [owner] = await hre.ethers.getSigners();
    client = await FhevmClient.create({ provider: hre.ethers.provider });

    const Counter = await hre.ethers.getContractFactory("EncryptedCounter");
    counter = await Counter.deploy();
    await counter.waitForDeployment();
  });

  it("should increment with encrypted amount", async function () {
    const encrypted = await client.encrypt64(5);
    await counter.increment(encrypted);
  });
});
