export type BridgeMessageState =
  | 'source_confirmed'
  | 'relayed'
  | 'destination_confirmed'
  | 'failed'

export interface BridgeMessageStatus {
  id: string
  sourceChainId: number
  destinationChainId: number
  state: BridgeMessageState
  updatedAt: string
  relayAttempts: number
}

export function summarizeBridgeStatus(
  statuses: BridgeMessageStatus[],
): Record<BridgeMessageState, number> {
  return statuses.reduce<Record<BridgeMessageState, number>>(
    (counts, status) => {
      counts[status.state] += 1
      return counts
    },
    {
      source_confirmed: 0,
      relayed: 0,
      destination_confirmed: 0,
      failed: 0,
    },
  )
}
