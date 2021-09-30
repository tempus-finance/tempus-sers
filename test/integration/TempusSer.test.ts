import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  ethers,
  getNamedAccounts
} from 'hardhat';
import * as NameHash from 'eth-ens-namehash';

import { Signer, redeemTicket, redeemTicketToEnsName } from "../utils";

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

  describe("Redeem", async () =>
  {
    it("Should succeed with correct signature (standard address whitelisted)", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicket(token, owner, user.address, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(user.address);
    });
    it("Should succeed with correct signature (ENS name whitelisted)", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicketToEnsName(token, owner, TEST_ENS_NAME, ticketId, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(elonMuskEnsNameOwner.address);
    });
  });
});
