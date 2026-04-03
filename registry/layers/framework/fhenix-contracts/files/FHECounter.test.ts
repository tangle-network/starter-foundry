import { expect } from "chai";
import hre from "hardhat";
import { FhenixClient, EncryptionTypes } from "fhenixjs";

describe("FHECounter", function () {
  let counter: any;
  let client: FhenixClient;
  let owner: any;

  beforeEach(async function () {
    [owner] = await hre.ethers.getSigners();
    client = new FhenixClient({ provider: hre.ethers.provider });

    const Counter = await hre.ethers.getContractFactory("FHECounter");
    counter = await Counter.deploy();
    await counter.waitForDeployment();
  });

  it("should start at zero", async function () {
    const permit = await client.generatePermit(await counter.getAddress(), owner);
    const sealed = await counter.getCount(permit.publicKey);
    const count = client.unseal(await counter.getAddress(), sealed);
    expect(count).to.equal(0n);
  });

  it("should increment with encrypted amount", async function () {
    const encrypted = await client.encrypt_uint32(5);
    await counter.increment(encrypted);

    const permit = await client.generatePermit(await counter.getAddress(), owner);
    const sealed = await counter.getCount(permit.publicKey);
    const count = client.unseal(await counter.getAddress(), sealed);
    expect(count).to.equal(5n);
  });
});
