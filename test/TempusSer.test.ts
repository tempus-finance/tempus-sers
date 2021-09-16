import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import * as signers from "@nomiclabs/hardhat-ethers/dist/src/signers";

export type Signer = signers.SignerWithAddress;
export type SignerOrAddress = Signer|string;

/**
 * Tries to get the Revert Message from an Error
 */
export function getRevertMessage(e:Error): string {
  const expectedErrorMsg = "VM Exception while processing transaction: revert ";
  let idx = e.message.indexOf(expectedErrorMsg);
  if (idx !== -1) {
    return e.message.substr(idx + expectedErrorMsg.length);
  }
  let msgStart = e.message.indexOf('\'');
  if (msgStart !== -1) {
    return e.message.substr(msgStart + 1, e.message.length - msgStart - 2);
  }
  return e.message; // something else failed
}

/**
 * Expect called promise to revert with message
 * (await expectRevert(c.f(..))).to.equal("expected revert msg");
 */
async function expectRevert(promise: Promise<any>): Promise<Chai.Assertion> {
  try {
    await promise;
    return expect('success');
  } catch (e) {
    return expect(getRevertMessage(e));
  }
}

describe("Tempus Sers", async () => {
  let owner:Signer, user:Signer;
  let token;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const TempusSers = await ethers.getContractFactory("TempusSers");
    token = await TempusSers.deploy("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/");
    await token.deployed();
  });

  describe("Deploy", async () =>
  {
    it("Should set the right owner and initial supply", async () =>
    {
      expect(await token.owner()).to.equal(owner.address);
      expect((await token.balanceOf(owner.address)).toString()).to.equal("0"); // Ensure no pre-minting
      expect((await token.totalSupply()).toString()).to.equal("0");
    });

    it("Should set name and symbol", async () =>
    {
      expect(await token.name()).to.equal("Tempus Sers");
      expect(await token.symbol()).to.equal("SERS");
    });

    it("Should set initial properties", async () =>
    {
      expect((await token.MAX_SUPPLY()).toString()).to.equal("11111");
      expect(await token.shuffleSeed()).to.equal(0);
      expect(await token.baseTokenURI()).to.equal("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/");
    });
  });

  describe("Seed and shuffle", async () =>
  {
    it("Should allow to set seed once", async () =>
    {
      await token.setSeed();
      // Can't actually the seed due to blockchain differs between runs
      // expect(await token.shuffelSeed()).to.equal(...)
      (await expectRevert(token.setSeed())).to.equal("TempusSers: Seed already set");
    });
    it("Should not allow to shuffle before seed is set", async () =>
    {
      (await expectRevert(token.ticketToTokenId(BigNumber.from(1)))).to.equal("TempusSers: Seed not set yet");
    });
    it("Should allow to shuffle after seed is set", async () =>
    {
      await token.setSeed();
      // Can't actually check the value due to the seed (blockhash) differs between runs
      // expect((await token.ticketToTokenId(BigNumber.from(1))).toString()).to.equal("8984");
      await token.ticketToTokenId(BigNumber.from(1));
    });
  });

  describe("Redeem", async () =>
  {
    it("Should fail with short signature", async () =>
    {
      (await expectRevert(token.redeemTicket(user.address, 1, 5, 0, 0))).to.equal("TempusSers: Invalid signature");
    });
    it("Should fail with invalid signature", async () =>
    {
      // TODO
    });
    it("Should succeed with correct signature", async () =>
    {
      // TODO
      // Call token.redeemTicket
      // Check token.claimedTickets, token.originalMinter, token.rarity
    });
  });
});
