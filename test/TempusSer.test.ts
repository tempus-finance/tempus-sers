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

describe("Shuffle", async () => {
  let lib;

  beforeEach(async () => {
    const ShuffleTest = await ethers.getContractFactory("ShuffleTest");
    lib = await ShuffleTest.deploy();
    await lib.deployed();
  });

  describe("Shuffle", async () =>
  {
    it("Permute should work", async () =>
    {
      (await expectRevert(lib.permute(0, 0, 0))).to.equal(
        "VM Exception while processing transaction: reverted with panic code 0x1 (Assertion error)"
      );
      expect(await lib.permute(1, 1, 0)).to.equal(0);
      expect(await lib.permute(1, 0xffffffff, 0)).to.equal(873951518);
      expect(await lib.permute(1, 0xffffffff, 0xffffffff)).to.equal(4108390583);
      // This is the idx<=len case
      (await expectRevert(lib.permute(0xffffffff, 1, 0xffffffff))).to.equal(
        "VM Exception while processing transaction: reverted with panic code 0x1 (Assertion error)"
      );
      expect(await lib.permute(0xffffffff, 0xffffffff, 0xffffffff)).to.equal(1899993531);
      expect(await lib.permute(0xffffffff, 0xffffffff, 0)).to.equal(3241938400);
      expect(await lib.permute(1, 11111, 0)).to.equal(9552);
      expect(await lib.permute(1, 11111, 0x1f7faa55)).to.equal(10073);
      expect(await lib.permute(222, 11111, 0x1f7faa55)).to.equal(3069);
    });
  });
});

describe("Tempus Sers", async () => {
  let owner:Signer, user:Signer;
  let token;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const TempusSers = await ethers.getContractFactory("TempusSers");
    token = await TempusSers.deploy("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/");
    await token.deployed();
  });


  async function redeemTicket(signer, recipient, ticketId, tokenId): Promise<void> {
    const domain = {
      name: 'Tempus Sers',
      version: '1',
      chainId: await signer.getChainId(),
      verifyingContract: token.address
    };

    const types = {
      ClaimSer: [
        { name: 'recipient', type: 'address' },
        { name: 'ticketId', type: 'uint256' },
        { name: 'tokenId', type: 'uint256' }
      ]
    };

    const value = {
       recipient,
       ticketId,
       tokenId
    };

    const signature = await signer._signTypedData(domain, types, value);
    return token.redeemTicket(recipient, ticketId, tokenId, signature);
  };

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
    it("Ensure seed changes on setting", async () =>
    {
      // NOTE: The starting seed value is 0, and setSeed can be called
      // as long as the seed is 0. In the case the "random" seed ends up
      // being 0 again, that means setSeed can be called again.
      //
      // For testing purposes we assume the probability of this is low.
      const prevSeed = await token.shuffleSeed();
      expect(prevSeed).to.equal(0);
      await token.setSeed();
      expect(await token.shuffleSeed()).to.not.equal(prevSeed);
    });
    it("Should allow to set seed once", async () =>
    {
      // NOTE: The same conditions apply here as above.
      await token.setSeed();
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
      const ticketId = 1;
      const tokenId = 5;
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(token.redeemTicket(user.address, ticketId, tokenId, 0))).to.equal("TempusSers: Invalid signature");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });
    it("Should fail with invalid signature", async () =>
    {
      const sig = "0x161c1cce058d3862a7ca0c331729d7b181d282be5c546a122f4eeab0c285aa072f81d40bb17a1504590ca524840498804554b7c907a8493674f968d20dcf7d421c";
      const ticketId = 1;
      const tokenId = 5;
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(token.redeemTicket(user.address, ticketId, tokenId, sig))).to.equal("TempusSers: Invalid signature");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });
    it("Should fail before seed is set", async () =>
    {
      const ticketId = 1;
      const tokenId = 0; // Can't use ticketToTokenId here and this will be wrong anyway
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(redeemTicket(owner, user.address, ticketId, tokenId))).to.equal("TempusSers: Seed not set yet");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });
    it("Should fail with invalid ticketId<>tokenId pair", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId)) - 1;
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(redeemTicket(owner, user.address, ticketId, tokenId))).to.equal("TempusSers: Invalid ticket/token pair");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });
    it("Should fail redeeming twice", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicket(owner, user.address, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      (await expectRevert(redeemTicket(owner, user.address, ticketId, tokenId))).to.equal("TempusSers: Ticket already claimed");
      expect(await token.claimedTickets(ticketId)).to.equal(true);
    });
    it("Should succeed with correct signature", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicket(owner, user.address, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(user.address);
    });
  });
});
