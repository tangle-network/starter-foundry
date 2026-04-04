// Types

export interface RawLog {
  address: string
  topics: string[]
  data: string
  blockNumber: number
  transactionHash: string
  logIndex: number
}

export interface ABIEventInput {
  name: string
  type: string
  indexed: boolean
}

export interface ABIEvent {
  name: string
  inputs: ABIEventInput[]
}

export interface DecodedEvent {
  name: string
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: Record<string, string | bigint>
}

export interface EventFilter {
  address?: string
  topics: (string | null)[]
  fromBlock: string
  toBlock: string
}

// Implementation

function keccak256Hex(input: string): string {
  // Event signature hashing — in production, use a real keccak256.
  // This returns a placeholder topic based on the signature string.
  // Replace with: import { keccak256 } from 'ethereum-cryptography/keccak'
  // For now, we use Node's crypto as a stand-in for topic matching.
  const { createHash } = require('crypto') as typeof import('crypto')
  return '0x' + createHash('sha256').update(input).digest('hex')
}

function encodeEventSignature(event: ABIEvent): string {
  const types = event.inputs.map((i) => i.type).join(',')
  return keccak256Hex(`${event.name}(${types})`)
}

function decodeABIValue(type: string, hex: string): string | bigint {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex

  if (type === 'address') {
    return '0x' + cleaned.slice(-40).toLowerCase()
  }

  if (type.startsWith('uint') || type.startsWith('int')) {
    return BigInt('0x' + cleaned)
  }

  if (type === 'bool') {
    return BigInt('0x' + cleaned) !== 0n ? 'true' : 'false'
  }

  if (type.startsWith('bytes')) {
    return '0x' + cleaned
  }

  return '0x' + cleaned
}

export function decodeEventLog(log: RawLog, abi: ABIEvent[]): DecodedEvent | null {
  if (log.topics.length === 0) return null

  const topicHash = log.topics[0]

  // Match event by topic hash
  const matchedEvent = abi.find((e) => encodeEventSignature(e) === topicHash)
  if (!matchedEvent) return null

  const args: Record<string, string | bigint> = {}
  const indexedInputs = matchedEvent.inputs.filter((i) => i.indexed)
  const nonIndexedInputs = matchedEvent.inputs.filter((i) => !i.indexed)

  // Decode indexed parameters from topics (topics[1], topics[2], ...)
  for (let i = 0; i < indexedInputs.length; i++) {
    const topic = log.topics[i + 1]
    if (topic) {
      args[indexedInputs[i].name] = decodeABIValue(indexedInputs[i].type, topic)
    }
  }

  // Decode non-indexed parameters from data
  const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data
  for (let i = 0; i < nonIndexedInputs.length; i++) {
    const chunk = data.slice(i * 64, (i + 1) * 64)
    if (chunk.length > 0) {
      args[nonIndexedInputs[i].name] = decodeABIValue(nonIndexedInputs[i].type, chunk)
    }
  }

  return {
    name: matchedEvent.name,
    address: log.address,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    args,
  }
}

export function buildEventFilter(
  contractAddress: string,
  eventSignatures: ABIEvent[],
  fromBlock: number | 'latest' = 0,
  toBlock: number | 'latest' = 'latest',
): EventFilter {
  const topics = eventSignatures.map((e) => encodeEventSignature(e))

  return {
    address: contractAddress,
    topics: [topics.length === 1 ? topics[0] : null],
    fromBlock: typeof fromBlock === 'number' ? '0x' + fromBlock.toString(16) : fromBlock,
    toBlock: typeof toBlock === 'number' ? '0x' + toBlock.toString(16) : toBlock,
  }
}

export function formatEventForAPI(decodedEvent: DecodedEvent): Record<string, unknown> {
  // Convert bigints to strings for JSON serialization
  const serializedArgs: Record<string, string> = {}
  for (const [key, value] of Object.entries(decodedEvent.args)) {
    serializedArgs[key] = typeof value === 'bigint' ? value.toString() : value
  }

  return {
    event: decodedEvent.name,
    contract: decodedEvent.address,
    block: decodedEvent.blockNumber,
    tx: decodedEvent.transactionHash,
    logIndex: decodedEvent.logIndex,
    args: serializedArgs,
    timestamp: null, // Populated by caller from block data
  }
}
