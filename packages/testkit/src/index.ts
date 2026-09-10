export interface TestSequence {
  promptIds?: string[]
}

export interface InMemoryLedgerEntry {
  turnId: string
  playerA: string
  playerB: string
  resolved: boolean
  rewardPerPlayer: number
}

export interface InMemoryLedger {
  claims: Map<string, InMemoryLedgerEntry>
  applyCommit(commitId: string, entry: Omit<InMemoryLedgerEntry, 'resolved'>): void
  getCommit(commitId: string): InMemoryLedgerEntry | undefined
}

export class DisposableLedger implements InMemoryLedger {
  claims = new Map<string, InMemoryLedgerEntry>()

  applyCommit(commitId: string, entry: Omit<InMemoryLedgerEntry, 'resolved'>): void {
    if (this.claims.has(commitId)) {
      return
    }
    this.claims.set(commitId, { ...entry, resolved: true })
  }

  getCommit(commitId: string): InMemoryLedgerEntry | undefined {
    return this.claims.get(commitId)
  }
}
