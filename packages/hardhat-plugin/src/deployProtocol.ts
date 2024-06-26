import { HardhatRuntimeEnvironment } from 'hardhat/types'
import type { Contract } from 'ethers'

import { getContractFactory, deployUpgreadableContract } from './utils'
import { UNLOCK_LATEST_VERSION, PUBLIC_LOCK_LATEST_VERSION } from './constants'
import { getUnlockContract } from './getUnlockContract'

export interface DeployProtocolFunction {
  (
    unlockVersion?: number,
    lockVersion?: number,
    confirmations?: number
  ): Promise<{
    unlock: Contract
    publicLock: Contract
  }>
}

export interface DeployAndSetTemplate {
  (lockVersion?: number, confirmations?: number): Promise<Contract>
}

export interface UnlockConfigArgs {
  udtAddress?: string | null
  wethAddress?: string | null
  locksmithURI?: string
  chainId?: bigint
  estimatedGasForPurchase?: number
  symbol?: string
}

export async function deployUnlock(
  hre: HardhatRuntimeEnvironment,
  version = UNLOCK_LATEST_VERSION,
  confirmations = 5
) {
  const [signer] = await hre.ethers.getSigners()
  const unlock: Contract = await deployUpgreadableContract(
    hre,
    'Unlock',
    version,
    'initialize(address)',
    [signer.address],
    signer,
    confirmations
  )

  const unlockAddress = await unlock.getAddress()
  console.log(`UNLOCK > deployed to : ${unlockAddress}`)
  hre.unlock.unlockAddress = unlockAddress
  return unlock
}

export async function deployAndSetTemplate(
  hre: HardhatRuntimeEnvironment,
  lockVersion = PUBLIC_LOCK_LATEST_VERSION,
  confirmations = 5
) {
  const [signer] = await hre.ethers.getSigners()
  const unlock = await getUnlockContract(hre)

  // deploy PublicLock template
  const publicLock = await deployPublicLock(hre, lockVersion, confirmations)
  const version = await publicLock.getFunction('publicLockVersion')()
  const publicLockAddress = await publicLock.getAddress()

  // set lock template
  await unlock.connect(signer).getFunction('addLockTemplate')(
    publicLockAddress,
    version
  )
  await unlock.connect(signer).getFunction('setLockTemplate')(publicLockAddress)

  return publicLock
}

export async function deployPublicLock(
  hre: HardhatRuntimeEnvironment,
  version = PUBLIC_LOCK_LATEST_VERSION,
  confirmations = 5
) {
  const [signer] = await hre.ethers.getSigners()
  const PublicLock = await getContractFactory(
    hre,
    'PublicLock',
    version,
    signer
  )
  const publicLock = await PublicLock.deploy()
  await publicLock.deploymentTransaction()?.wait(confirmations)
  const publicLockAddress = await publicLock.getAddress()

  console.log(
    `PUBLICLOCK > deployed to : ${publicLockAddress} (${await publicLock.getFunction(
      'publicLockVersion'
    )()})`
  )
  return publicLock
}

export async function deployProtocol(
  hre: HardhatRuntimeEnvironment,
  unlockVersion = UNLOCK_LATEST_VERSION,
  lockVersion = PUBLIC_LOCK_LATEST_VERSION,
  confirmations = 1 // default to 1, as this is mostly for use on local dev
) {
  // 1. deploy Unlock
  const unlock = await deployUnlock(hre, unlockVersion, confirmations)

  // 3. deploy and set template
  const publicLock = await deployAndSetTemplate(hre, lockVersion, confirmations)

  return {
    unlock,
    publicLock,
  }
}

export async function configUnlock(
  hre: HardhatRuntimeEnvironment,
  unlockAddress: string,
  {
    udtAddress,
    wethAddress,
    locksmithURI,
    chainId,
    estimatedGasForPurchase,
    symbol,
  }: UnlockConfigArgs
): Promise<UnlockConfigArgs> {
  const unlock = await getUnlockContract(hre, unlockAddress)

  if (!udtAddress) udtAddress = await unlock.udt()
  if (!wethAddress) wethAddress = await unlock.weth()
  if (!chainId) {
    ;({ chainId } = await hre.ethers.provider.getNetwork())
  }
  if (!estimatedGasForPurchase)
    estimatedGasForPurchase = await unlock.estimatedGasForPurchase()
  if (!symbol) symbol = 'KEY'
  if (!locksmithURI) locksmithURI = await unlock.globalBaseTokenURI()

  await unlock.configUnlock(
    udtAddress,
    wethAddress,
    estimatedGasForPurchase,
    symbol,
    locksmithURI,
    chainId
  )
  return {
    udtAddress,
    wethAddress,
    estimatedGasForPurchase,
    symbol,
    locksmithURI,
    chainId,
  }
}
