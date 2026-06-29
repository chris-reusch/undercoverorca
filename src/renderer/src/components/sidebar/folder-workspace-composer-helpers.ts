import {
  getLinkedWorkItemProvider,
  getLinkedWorkItemWorkspaceName,
  type LinkedWorkItemSummary
} from '@/lib/new-workspace'
import { isPathInsideOrEqual } from '../../../../shared/cross-platform-path'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID,
  normalizeExecutionHostId,
  toSshExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host'
import { getProjectGroupSubtreeIds } from '../../../../shared/project-groups'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type {
  FolderWorkspace,
  GitHubWorkItem,
  GitLabWorkItem,
  ProjectGroup,
  Repo
} from '../../../../shared/types'
import type { SmartWorkspaceNameSelection } from '@/components/new-workspace/SmartWorkspaceNameField'
import { translate } from '@/i18n/i18n'

const EMPTY_REPOS: Repo[] = []

function getProjectGroupExecutionHostId(projectGroup: ProjectGroup): ExecutionHostId {
  const executionHostId = normalizeExecutionHostId(projectGroup.executionHostId)
  if (executionHostId) {
    return executionHostId
  }
  return projectGroup.connectionId
    ? toSshExecutionHostId(projectGroup.connectionId)
    : LOCAL_EXECUTION_HOST_ID
}

export function getFolderSourceRepos(
  repos: readonly Repo[],
  projectGroups: readonly ProjectGroup[],
  projectGroup: ProjectGroup | null
): Repo[] {
  if (!projectGroup?.parentPath) {
    return EMPTY_REPOS
  }
  const folderPath = projectGroup.parentPath
  const groupIds = getProjectGroupSubtreeIds(projectGroups, projectGroup.id)
  const projectGroupHostId = getProjectGroupExecutionHostId(projectGroup)
  return repos.filter(
    (repo) =>
      isGitRepoKind(repo) &&
      getRepoExecutionHostId(repo) === projectGroupHostId &&
      ((typeof repo.projectGroupId === 'string' && groupIds.has(repo.projectGroupId)) ||
        isPathInsideOrEqual(folderPath, repo.path))
  )
}

export function toFolderWorkspaceLinkedTask(
  item: LinkedWorkItemSummary | null
): FolderWorkspace['linkedTask'] {
  if (!item) {
    return null
  }
  const provider = getLinkedWorkItemProvider(item)
  return {
    provider,
    type: item.type,
    number: item.number,
    title: item.title,
    url: item.url,
    ...(item.linearIdentifier ? { linearIdentifier: item.linearIdentifier } : {}),
    ...(item.repoId ? { repoId: item.repoId } : {})
  }
}

export function getSmartNameSelection(
  linkedWorkItem: LinkedWorkItemSummary | null
): SmartWorkspaceNameSelection | null {
  if (!linkedWorkItem) {
    return null
  }
  const provider = getLinkedWorkItemProvider(linkedWorkItem)
  const kind: SmartWorkspaceNameSelection['kind'] =
    provider === 'gitlab'
      ? linkedWorkItem.type === 'mr'
        ? 'gitlab-mr'
        : 'gitlab-issue'
      : linkedWorkItem.type === 'pr'
        ? 'github-pr'
        : 'github-issue'
  return {
    kind,
    label:
      linkedWorkItem.number === 0
        ? linkedWorkItem.title
        : `#${linkedWorkItem.number} ${linkedWorkItem.title}`,
    url: linkedWorkItem.url
  }
}

// Why: the linked-work-item prompt helpers accept only TaskProvider
// ('github' | 'gitlab'); coerce the inert legacy 'linear' provider to
// undefined so the linearIdentifier pass-through (not the provider) drives
// linked context.
export function toLinkedWorkItemPromptInput(
  item: LinkedWorkItemSummary | null
): (Omit<LinkedWorkItemSummary, 'provider'> & { provider?: 'github' | 'gitlab' }) | null {
  if (!item) {
    return null
  }
  const provider =
    item.provider === 'github' || item.provider === 'gitlab' ? item.provider : undefined
  return { ...item, provider }
}

export function getLinkedItemDisplayName(item: LinkedWorkItemSummary): string | null {
  return getLinkedWorkItemWorkspaceName(item)?.displayName ?? (item.title.trim() || null)
}

export function toGitHubLinkedWorkItem(item: GitHubWorkItem): LinkedWorkItemSummary {
  return {
    type: item.type,
    provider: 'github',
    number: item.number,
    title: item.title,
    url: item.url,
    repoId: item.repoId
  }
}

export function toGitLabLinkedWorkItem(item: GitLabWorkItem): LinkedWorkItemSummary {
  return {
    type: item.type,
    provider: 'gitlab',
    number: item.number,
    title: item.title,
    url: item.url,
    repoId: item.repoId
  }
}

export function getFolderWorkspacePrimaryActionLabel(): string {
  return translate(
    'auto.components.sidebar.FolderWorkspaceComposerDialog.create',
    'Create workspace'
  )
}
