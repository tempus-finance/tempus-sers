import { expect } from "chai";
import * as signers from "@nomiclabs/hardhat-ethers/dist/src/signers";

export type Signer = signers.SignerWithAddress;

/**
 * Tries to get the Revert Message from an Error
 */
function getRevertMessage(e:Error): string {
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
export async function expectRevert(promise: Promise<any>): Promise<Chai.Assertion> {
  try {
    await promise;
    return expect('success');
  } catch (e) {
    return expect(getRevertMessage(e));
  }
}

export async function redeemTicket(token, signer, recipient, ticketId, tokenId): Promise<void> {
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

export async function redeemTicketToEnsName(token, signer, recipientEnsName, ticketId, tokenId): Promise<void> {
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