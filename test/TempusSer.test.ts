import { ethers } from "hardhat";
import { expect, use } from "chai";
import { BigNumber, Contract, utils as ethersUtils } from "ethers";
import * as signers from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { solidity } from "ethereum-waffle";
import { MerkleTree } from "merkletreejs";
import * as keccak256 from "keccak256";

/**
 * Insert helpers for event matching.
 */
use(solidity);

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
      expect(await lib.permute(0, 1, 0)).to.equal(0);
      expect(await lib.permute(1, 0xffffffff, 0)).to.equal(873951518);
      expect(await lib.permute(1, 0xffffffff, 0xffffffff)).to.equal(4108390583);
      // This is the idx<=len case
      (await expectRevert(lib.permute(0xffffffff, 1, 0xffffffff))).to.equal(
        "VM Exception while processing transaction: reverted with panic code 0x1 (Assertion error)"
      );
      expect(await lib.permute(0xfffffffe, 0xffffffff, 0xffffffff)).to.equal(2234533823);
      expect(await lib.permute(0xfffffffe, 0xffffffff, 0)).to.equal(1953920120);
      expect(await lib.permute(1, 11111, 0)).to.equal(9552);
      expect(await lib.permute(1, 11111, 0x1f7faa55)).to.equal(10073);
      expect(await lib.permute(222, 11111, 0x1f7faa55)).to.equal(3069);

      expect(await lib.permute(0, 1, 0x1f7faa55)).to.equal(0);

      expect(await lib.permute(0, 2, 0x1f7faa55)).to.equal(1);
      expect(await lib.permute(1, 2, 0x1f7faa55)).to.equal(0);

      expect(await lib.permute(0, 3, 0x1f7faa55)).to.equal(1);
      expect(await lib.permute(1, 3, 0x1f7faa55)).to.equal(0);
      expect(await lib.permute(2, 3, 0x1f7faa55)).to.equal(2);
    });
  });
});

interface Claim {
  recipient:string;
  ticketId:number;
}

class ClaimList {
  list:Array<Claim>;
  tree:MerkleTree;

  constructor(addresses:Array<string>) {
    // Take the addresses and assign a ticketId to them (from the range of 1..n).
    this.list = addresses.map((e, i) => {
      return { recipient: e, ticketId: i + 1};
    });

    // Create the merkle tree.
    const leaves = this.list.map((e) => {
      return this.encodeLeaf(e.recipient, e.ticketId);
    });
    this.tree = new MerkleTree(leaves, keccak256, { hashLeaves: false, sortPairs: true });
  }

  // Preprocess a single tree element. ABI encoding is important here as the contract must do the same.
  encodeLeaf(recipient, ticketId) {
    return ethersUtils.keccak256(ethersUtils.defaultAbiCoder.encode([ "address", "uint256" ], [ recipient, ticketId ]));
  }

  // Get the merkle root.
  public getRoot(): string {
    return this.tree.getHexRoot();
  }

  // Create a proof for a given recipient/ticketId combination. Does not validate it is part of the tree.
  public getProof(recipient:string, ticketId:number): Array<string> {
    return this.tree.getHexProof(this.encodeLeaf(recipient, ticketId));
  }

  // Returns the list of all possible claims.
  public getList(): Array<Claim> {
    return this.list;
  }

  // Helper function for testing. Generates a list of claims.
  static generate(count:number): ClaimList {
    let addresses = [];
    for (let i = 1; i <= count; i++) {
      // Here we generate addresses in the form of 0x100000000000000000000000000000000000nnnn
      let address = BigNumber.from("0x1000000000000000000000000000000000000000").add(BigNumber.from(i));
      // Convert it to checksummed address
      let checksummedAddress = ethersUtils.getAddress(address.toHexString());
      addresses.push(checksummedAddress);
    }
    return new ClaimList(addresses);
  }
}

describe("Tempus Sers", async () => {
  let owner:Signer, user:Signer;
  let token;
  let claimList:ClaimList;

  before(async () => {
    claimList = ClaimList.generate(1111);
  });

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const TempusSers = await ethers.getContractFactory("TempusSers");
    token = await TempusSers.deploy("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/", claimList.getRoot());
    await token.deployed();
  });

  async function proveTicket(recipient:string, ticketId:number): Promise<void> {
    const proof = claimList.getProof(recipient, ticketId);
    return token.proveTicket(recipient, ticketId, proof);
  }

  async function redeemTicket(signer, recipient, ticketId): Promise<void> {
    const domain = {
      name: 'Tempus Sers',
      version: '1',
      chainId: await signer.getChainId(),
      verifyingContract: token.address
    };

    const types = {
      ClaimSer: [
        { name: 'recipient', type: 'address' },
        { name: 'ticketId', type: 'uint256' }
      ]
    };

    const value = {
       recipient,
       ticketId
    };

    const signature = await signer._signTypedData(domain, types, value);
    return token.redeemTicket(recipient, ticketId, signature);
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
      expect((await token.MAX_SUPPLY()).toString()).to.equal("3333");
      expect(await token.shuffleSeed()).to.equal(0);
      expect(await token.baseTokenURI()).to.equal("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/");
    });

    it("Should sanitize base URI", async () =>
    {
      const TempusSers = await ethers.getContractFactory("TempusSers");
      let token2 = await TempusSers.deploy("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs", claimList.getRoot());
      await token2.deployed();
      expect(await token2.baseTokenURI()).to.equal("ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/");
    });

    it("Should fail on empy base URI", async () =>
    {
      const TempusSers = await ethers.getContractFactory("TempusSers");
      (await expectRevert(TempusSers.deploy("", claimList.getRoot()))).to.equal("TempusSers: URI cannot be empty");
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
      (await expectRevert(token.redeemTicket(user.address, ticketId, 0))).to.equal("TempusSers: Invalid signature");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should fail with invalid signature", async () =>
    {
      const sig = "0x161c1cce058d3862a7ca0c331729d7b181d282be5c546a122f4eeab0c285aa072f81d40bb17a1504590ca524840498804554b7c907a8493674f968d20dcf7d421c";
      const ticketId = 1;
      const tokenId = 5;
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(token.redeemTicket(user.address, ticketId, sig))).to.equal("TempusSers: Invalid signature");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should fail before seed is set", async () =>
    {
      const ticketId = 1;
      const tokenId = 0; // Can't use ticketToTokenId here and this will be wrong anyway
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(redeemTicket(owner, user.address, ticketId))).to.equal("TempusSers: Seed not set yet");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      expect(await token.originalMinter(tokenId)).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should fail redeeming twice", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      await redeemTicket(owner, user.address, ticketId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      (await expectRevert(redeemTicket(owner, user.address, ticketId))).to.equal("TempusSers: Ticket already claimed");
      expect(await token.claimedTickets(ticketId)).to.equal(true);
    });

    it("Should succeed with correct signature", async () =>
    {
      await token.setSeed();
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      const tokenURI = (await token.baseTokenURI()) + tokenId + ".json";
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      // Transfer(0, to, tokenId);
      expect(await redeemTicket(owner, user.address, ticketId))
        .to.emit(token, "Transfer").withArgs("0x0000000000000000000000000000000000000000", user.address, tokenId)
        .to.emit(token, "PermanentURI").withArgs(tokenURI, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(user.address);
    });

    it("Should fail with invalid ticket id (0)", async () =>
    {
      await token.setSeed();

      const ticketId = 0;
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(redeemTicket(owner, user.address, ticketId))).to.equal("TempusSers: Invalid ticket id");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
    });

    it("Should fail with invalid ticket id (>maxSupply)", async () =>
    {
      await token.setSeed();

      const maxSupply = await token.MAX_SUPPLY();
      const ticketId = maxSupply + 1;
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      (await expectRevert(redeemTicket(owner, user.address, ticketId))).to.equal("TempusSers: Invalid ticket id");
      expect(await token.claimedTickets(ticketId)).to.equal(false);
    });

    it("Should work with redeeming all tickets", async () => {
      await token.setSeed();
      const maxSupply = await token.MAX_SUPPLY();
      for (let ticketId = 1; ticketId <= maxSupply; ticketId++) {
        const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
        const tokenURI = (await token.baseTokenURI()) + tokenId + ".json";
        expect(await token.claimedTickets(ticketId)).to.equal(false);
        // Transfer(0, to, tokenId);
        expect(await redeemTicket(owner, user.address, ticketId))
          .to.emit(token, "Transfer").withArgs("0x0000000000000000000000000000000000000000", user.address, tokenId)
          .to.emit(token, "PermanentURI").withArgs(tokenURI, tokenId);
        expect(await token.claimedTickets(ticketId)).to.equal(true);
        expect(await token.originalMinter(tokenId)).to.equal(user.address);
      }
    }).timeout(300000);
  });

  describe("Prove", async () =>
  {
    it("Should succeed with correct proof", async () =>
    {
      await token.setSeed();
      const recipient = "0x1000000000000000000000000000000000000001";
      const ticketId = 1;
      const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
      const tokenURI = (await token.baseTokenURI()) + tokenId + ".json";
      expect(await token.claimedTickets(ticketId)).to.equal(false);
      // Transfer(0, to, tokenId);
      expect(await proveTicket(recipient, ticketId))
        .to.emit(token, "Transfer").withArgs("0x0000000000000000000000000000000000000000", recipient, tokenId)
        .to.emit(token, "PermanentURI").withArgs(tokenURI, tokenId);
      expect(await token.claimedTickets(ticketId)).to.equal(true);
      expect(await token.originalMinter(tokenId)).to.equal(recipient);
    });

    it("Should allow claiming all addresses", async () =>
    {
      await token.setSeed();
      const maxSupply = await token.MAX_SUPPLY();

      const claims = claimList.getList();
      for (let i = 0; i < claims.length; i++) {
        if ((i + 1) > maxSupply) {
          // Sanity check.
          break;
        }
        const recipient = claims[i].recipient;
        const ticketId = claims[i].ticketId;

        const tokenId = await token.ticketToTokenId(BigNumber.from(ticketId));
        const tokenURI = (await token.baseTokenURI()) + tokenId + ".json";
        expect(await token.claimedTickets(ticketId)).to.equal(false);
        // Transfer(0, to, tokenId);
        expect(await proveTicket(recipient, ticketId))
          .to.emit(token, "Transfer").withArgs("0x0000000000000000000000000000000000000000", recipient, tokenId)
          .to.emit(token, "PermanentURI").withArgs(tokenURI, tokenId);
        expect(await token.claimedTickets(ticketId)).to.equal(true);
        expect(await token.originalMinter(tokenId)).to.equal(recipient);
      };
    }).timeout(300000);
  });
});
