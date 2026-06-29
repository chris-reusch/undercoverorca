import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { GITHUB_METHODS } from './github'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

describe('github RPC methods', () => {
  it('resolves the repo slug on the runtime server', async () => {
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      getRepoSlug: vi.fn().mockResolvedValue({ owner: 'acme', repo: 'orca' })
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: GITHUB_METHODS })

    const response = await dispatcher.dispatch(makeRequest('github.repoSlug', { repo: 'repo-1' }))

    expect(runtime.getRepoSlug).toHaveBeenCalledWith('repo-1')
    expect(response).toMatchObject({
      ok: true,
      result: { owner: 'acme', repo: 'orca' }
    })
  })

  it('resolves the repo upstream on the runtime server', async () => {
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      getRepoUpstream: vi.fn().mockResolvedValue({ owner: 'stablyai', repo: 'orca' })
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: GITHUB_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('github.repoUpstream', { repo: 'repo-1' })
    )

    expect(runtime.getRepoUpstream).toHaveBeenCalledWith('repo-1')
    expect(response).toMatchObject({
      ok: true,
      result: { owner: 'stablyai', repo: 'orca' }
    })
  })
})
