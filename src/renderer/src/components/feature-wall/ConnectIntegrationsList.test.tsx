import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreflightStatus } from '../../../../preload/api-types'
import { ConnectIntegrationsList } from './ConnectIntegrationsList'

type StoreState = {
  activeRepoId: string | null
  activeWorktreeId: string | null
  worktreesByRepo: Record<string, unknown[]>
  repos: unknown[]
  settings: { activeRuntimeEnvironmentId?: string | null }
  preflightStatus: PreflightStatus | null
  preflightStatusChecked: boolean
  preflightStatusContextKey: string
  preflightStatusError: string | null
  preflightStatusLoading: boolean
  refreshPreflightStatus: () => Promise<void>
}

const { storeState } = vi.hoisted(() => ({
  storeState: { current: null as StoreState | null }
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => {
    if (!storeState.current) {
      throw new Error('Store state was not installed')
    }
    return selector(storeState.current)
  }
}))

function makePreflightStatus(overrides: Partial<PreflightStatus> = {}): PreflightStatus {
  const status: PreflightStatus = {
    git: { installed: true },
    gh: { installed: true, authenticated: false },
    glab: { installed: true, authenticated: false },
    bitbucket: {
      configured: false,
      authenticated: false,
      account: null
    },
    azureDevOps: {
      configured: false,
      authenticated: false,
      account: null,
      baseUrl: null,
      tokenConfigured: false
    },
    gitea: {
      configured: false,
      authenticated: false,
      account: null,
      baseUrl: null,
      tokenConfigured: false
    }
  }
  return { ...status, ...overrides }
}

function installStore(preflightStatus: PreflightStatus): void {
  const settings = { activeRuntimeEnvironmentId: null }
  storeState.current = {
    activeRepoId: null,
    activeWorktreeId: null,
    worktreesByRepo: {},
    repos: [],
    settings,
    preflightStatus,
    preflightStatusChecked: true,
    preflightStatusContextKey: 'host',
    preflightStatusError: null,
    preflightStatusLoading: false,
    refreshPreflightStatus: vi.fn(async () => {})
  }
}

async function renderConnectIntegrationsList(): Promise<{
  markup: string
}> {
  return { markup: renderToStaticMarkup(<ConnectIntegrationsList />) }
}

describe('ConnectIntegrationsList', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      api: {
        shell: {
          openUrl: vi.fn()
        }
      }
    })
  })

  afterEach(() => {
    storeState.current = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the settings review cards in the review step without an inline auth terminal', async () => {
    installStore(makePreflightStatus())

    const { markup } = await renderConnectIntegrationsList()

    for (const provider of ['GitHub', 'GitLab', 'Bitbucket', 'Azure DevOps', 'Gitea']) {
      expect(markup).toContain(provider)
    }
    expect(markup).toContain('gh auth login')
    expect(markup).toContain('glab auth login')
    expect(markup).not.toContain('Run in terminal')
  })

  it('keeps the upcoming task step collapsed but openable, not inert', async () => {
    installStore(makePreflightStatus())

    const { markup } = await renderConnectIntegrationsList()

    // Step 1 is not a prerequisite: the task step starts collapsed but offers
    // an "Open" affordance instead of a disabled, dimmed row.
    expect(markup).toContain('Open')
    expect(markup).not.toContain('opacity-55')
  })

  it('auto-resolves the task step from a connected code host', async () => {
    installStore(makePreflightStatus({ gh: { installed: true, authenticated: true } }))

    const { markup } = await renderConnectIntegrationsList()

    expect(markup).toContain('GitHub')
    expect(markup).toContain('issues available as tasks')
    expect(markup).not.toContain('Use GitHub issues')
  })

  it('offers GitHub and GitLab as task sources when review came from a non-task provider', async () => {
    // Bitbucket satisfies review but cannot serve tasks, so step 2 must still
    // offer the code hosts as connectable task sources.
    installStore(
      makePreflightStatus({
        bitbucket: { configured: true, authenticated: true, account: 'acme' }
      })
    )

    const { markup } = await renderConnectIntegrationsList()

    expect(markup).toContain('issues work as tasks.')
    expect(markup).toContain('gh auth login')
    expect(markup).toContain('glab auth login')
  })
})
