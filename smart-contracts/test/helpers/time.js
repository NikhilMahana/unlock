const helpers = require('@nomicfoundation/hardhat-network-helpers')
const { network, ethers } = require('hardhat')

async function increaseTime(durationInHours) {
  const { timestamp } = await ethers.provider.getBlock('latest')
  await network.provider.send('evm_increaseTime', [
    (BigInt(durationInHours) * 3600n + BigInt(timestamp)).toString(),
  ])
}

async function advanceBlock() {
  await helpers.mine(1)
}

async function advanceBlockTo(blockNumber) {
  await helpers.mineUpTo(blockNumber)
}

async function getLatestBlock() {
  return await helpers.time.latestBlock()
}

async function increaseTimeTo(newTimestamp) {
  await helpers.time.increaseTo(BigInt(newTimestamp.toString()))
}

module.exports = {
  increaseTimeTo,
  increaseTime,
  advanceBlock,
  advanceBlockTo,
  getLatestBlock,
}
