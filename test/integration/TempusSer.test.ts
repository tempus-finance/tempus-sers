import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  ethers,
  getNamedAccounts
} from 'hardhat';
import * as NameHash from 'eth-ens-namehash';

import { Signer, expectRevert } from "../utils";

const TEST_ENS_NAME = NameHash.hash("elonmusk.eth");
describe("Tempus Sers", async () => {
  let owner:Signer, user:Signer, elonMuskEnsNameOwner:Signer;
  let token;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const { elonMuskEnsNameOwner: elonMuskEnsNameOwnerAccount } = await getNamedAccounts();
    elonMuskEnsNameOwner = await ethers.getSigner(elonMuskEnsNameOwnerAccount);
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

  async function redeemTicketToEnsName(signer, recipientEnsName, ticketId, tokenId): Promise<void> {
    const domain = {
      name: 'Tempus Sers',
      version: '1',
      chainId: await signer.getChainId(),
      verifyingContract: token.address
    };

    const types = {
      ClaimSer: [
        { name: 'recipientEnsName', type: 'bytes32' },
        { name: 'ticketId', type: 'uint256' },
        { name: 'tokenId', type: 'uint256' }
      ]
    };

    const value = {
      recipientEnsName,
      ticketId,
      tokenId
    };

    const signature = await signer._signTypedData(domain, types, value);
    return token.redeemTicketToEnsName(value.recipientEnsName, ticketId, tokenId, signature);
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
    it("Should succeed with correct signature (standard address whitelisted)", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicket(owner, user.address, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(user.address);
    });
    it("Should succeed with correct signature (ENS name whitelisted)", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicket(owner, user.address, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(user.address);
    });
    it.only("Should succeed with correct signature (ENS name whitelisted)", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicketToEnsName(owner, TEST_ENS_NAME, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(elonMuskEnsNameOwner.address);
    });
  });
});
