import { z } from 'zod'
import { defineMethod, type RpcMethod } from '../core'
import { requiredString } from '../schemas'

const RepoSelector = z.object({
  repo: requiredString('Missing repo selector')
})

export const GITHUB_METHODS: RpcMethod[] = [
  defineMethod({
    name: 'github.repoSlug',
    params: RepoSelector,
    handler: async (params, { runtime }) => runtime.getRepoSlug(params.repo)
  }),
  defineMethod({
    name: 'github.repoUpstream',
    params: RepoSelector,
    handler: async (params, { runtime }) => runtime.getRepoUpstream(params.repo)
  })
]
