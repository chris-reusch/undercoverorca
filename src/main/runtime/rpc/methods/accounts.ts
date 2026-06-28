import { z } from 'zod'
import { defineMethod, defineStreamingMethod, type RpcAnyMethod } from '../core'

// Why: monotonically increasing per-process counter avoids the Date.now()
// collision that fired when two near-simultaneous accounts.subscribe calls
// collided on the same millisecond and one evicted the other through
// registerSubscriptionCleanup's existing-key eviction path.
let accountsSubscriptionSeq = 0

const SelectAccountParams = z.object({
  accountId: z
    .union([z.string().min(1, 'Missing accountId'), z.null()])
    .transform((v) => (v === null ? null : v))
})

const RemoveAccountParams = z.object({
  accountId: z.string().min(1, 'Missing accountId')
})

const AccountsUnsubscribeParams = z.object({
  subscriptionId: z
    .unknown()
    .transform((value) => (typeof value === 'string' && value.length > 0 ? value : ''))
    .pipe(z.string().min(1, 'Missing subscriptionId'))
})

// Why: bridges the desktop ClaudeAccountService / CodexAccountService into the
// mobile WebSocket RPC. Read + switch + remove only — interactive add/re-auth
// flows spawn `claude login` / `codex login` PTYs that need a desktop browser,
// so they intentionally remain desktop-only. See plan in spec doc for issue
// #1438.
export const ACCOUNT_METHODS: readonly RpcAnyMethod[] = [
  defineMethod({
    name: 'accounts.list',
    params: null,
    handler: async (_params, { runtime }) => {
      // Why: refresh is a no-op since usage tracking was removed, but the call
      // is kept so the snapshot path stays uniform with accounts.subscribe.
      await runtime.refreshAccountsForMobile()
      return runtime.getAccountsSnapshot()
    }
  }),
  defineMethod({
    name: 'accounts.selectClaude',
    params: SelectAccountParams,
    handler: async (params, { runtime }) => runtime.selectClaudeAccount(params.accountId)
  }),
  defineMethod({
    name: 'accounts.selectCodex',
    params: SelectAccountParams,
    handler: async (params, { runtime }) => runtime.selectCodexAccount(params.accountId)
  }),
  defineMethod({
    name: 'accounts.removeClaude',
    params: RemoveAccountParams,
    handler: async (params, { runtime }) => runtime.removeClaudeAccount(params.accountId)
  }),
  defineMethod({
    name: 'accounts.removeCodex',
    params: RemoveAccountParams,
    handler: async (params, { runtime }) => runtime.removeCodexAccount(params.accountId)
  }),
  // Why: streaming counterpart that delivers the current accounts snapshot to
  // mobile clients. Live push updates were tied to usage tracking (removed), so
  // this now emits the initial snapshot and holds the subscription open.
  // Mirrors the notifications.subscribe pattern.
  defineStreamingMethod({
    name: 'accounts.subscribe',
    params: null,
    handler: async (_params, { runtime, connectionId }, emit) => {
      await new Promise<void>((resolve) => {
        const unsubscribe = runtime.onAccountsChanged((snapshot) => {
          emit({ type: 'snapshot', snapshot })
        })

        // Why: scope the id by connectionId so two sockets from the same
        // device (host + accounts screen) cannot evict each other through
        // registerSubscriptionCleanup's "existing key" branch, and append a
        // per-process counter so two concurrent subscribes on the same
        // socket also can't collide.
        const seq = ++accountsSubscriptionSeq
        const subscriptionId = `accounts-${connectionId ?? 'inproc'}-${seq}`
        runtime.registerSubscriptionCleanup(
          subscriptionId,
          () => {
            unsubscribe()
            emit({ type: 'end' })
            resolve()
          },
          connectionId
        )

        // Why: emit the current snapshot synchronously so the phone has
        // something to render immediately, then kick a forced refresh that
        // will broadcast a fresh snapshot through the listener once each
        // provider fetch completes.
        emit({ type: 'ready', subscriptionId, snapshot: runtime.getAccountsSnapshot() })
        void runtime.refreshAccountsForMobile()
      })
    }
  }),
  defineMethod({
    name: 'accounts.unsubscribe',
    params: AccountsUnsubscribeParams,
    handler: async (params, { runtime }) => {
      runtime.cleanupSubscription(params.subscriptionId)
      return { unsubscribed: true }
    }
  })
]
