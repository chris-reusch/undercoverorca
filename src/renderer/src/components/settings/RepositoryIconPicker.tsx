import { useCallback, useEffect, useMemo, useRef } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Repo } from '../../../../shared/types'
import type { RepoIcon } from '../../../../shared/repo-icon'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../../shared/constants'
import { normalizeRepoBadgeColor } from '../../../../shared/repo-badge-color'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { RepoIconGlyph, getRepoLucideIconOptions } from '../repo/repo-icon'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentIdForRepo } from '@/lib/repo-runtime-owner'
import { useMountedRef } from '@/hooks/useMountedRef'
import { RepositoryIconColorSection } from './RepositoryIconColorSection'
import { RepositoryIconTabs } from './RepositoryIconTabs'
import { resolveRepositoryUpstreamLive } from './repository-icon-github'
import { translate } from '@/i18n/i18n'

export function RepositoryIconPicker({
  repo,
  updateRepo
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
}): React.JSX.Element {
  const mountedRef = useMountedRef()
  // Why: resolve this repo's upstream on the host that owns it, not the
  // focused runtime.
  const activeRuntimeEnvironmentId = useAppStore((state) =>
    getRuntimeEnvironmentIdForRepo(state, repo.id)
  )
  const selectedLucideName = repo.repoIcon?.type === 'lucide' ? repo.repoIcon.name : null
  const selectedEmoji = repo.repoIcon?.type === 'emoji' ? repo.repoIcon.emoji : ''
  const selectedBadgeColor = normalizeRepoBadgeColor(repo.badgeColor) ?? DEFAULT_REPO_BADGE_COLOR
  const initialTab =
    repo.repoIcon?.type === 'emoji' ? 'emoji' : repo.repoIcon?.type === 'lucide' ? 'icon' : 'upload'
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId }),
    [activeRuntimeEnvironmentId]
  )

  const currentIconLabel = useMemo(() => {
    if (repo.repoIcon?.type === 'image') {
      return repo.repoIcon.label ?? 'Custom image'
    }
    if (repo.repoIcon?.type === 'emoji') {
      return `${repo.repoIcon.emoji} emoji`
    }
    if (repo.repoIcon?.type === 'lucide') {
      const label =
        getRepoLucideIconOptions().find((option) => option.name === selectedLucideName)?.label ??
        'Folder'
      return `${label} icon with repo color`
    }
    return 'Default'
  }, [repo.repoIcon, selectedLucideName])

  const setIcon = (repoIcon: RepoIcon | null) => updateRepo(repo.id, { repoIcon })
  const setBadgeColor = (badgeColor: string) => updateRepo(repo.id, { badgeColor })

  const resolveUpstreamLive = useCallback(
    () => resolveRepositoryUpstreamLive(runtimeTarget, repo),
    [runtimeTarget, repo]
  )

  // Why: backfill the fork upstream (used by the fork indicator and fork-sync)
  // for repos added before upstream detection existed; the icon is never
  // derived from a remote avatar in this fork.
  const upstreamBackfilledRef = useRef<string | null>(null)
  useEffect(() => {
    if (repo.upstream !== undefined || upstreamBackfilledRef.current === repo.id) {
      return
    }
    upstreamBackfilledRef.current = repo.id
    let cancelled = false
    void (async () => {
      let upstream
      try {
        upstream = await resolveUpstreamLive()
      } catch {
        return
      }
      if (cancelled || !mountedRef.current) {
        return
      }
      updateRepo(repo.id, { upstream: upstream ?? null })
    })()
    return () => {
      cancelled = true
    }
  }, [repo.id, repo.upstream, resolveUpstreamLive, updateRepo, mountedRef])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <RepoIconGlyph
          repoIcon={repo.repoIcon}
          color={selectedBadgeColor}
          className="size-10 shrink-0 rounded-md border border-border/70 bg-muted/30"
          iconClassName="size-5"
        />
        <div className="min-w-0 flex-1">
          <Label className="text-sm font-semibold">
            {translate('auto.components.settings.RepositoryIconPicker.4e2a14f967', 'Repo Icon')}
          </Label>
          <div className="mt-1 truncate text-xs text-muted-foreground">{currentIconLabel}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIcon(null)}
        >
          <RotateCcw className="size-3.5" />
          {translate('auto.components.settings.RepositoryIconPicker.549d126081', 'Reset')}
        </Button>
      </div>

      <RepositoryIconColorSection badgeColor={repo.badgeColor} onBadgeColorChange={setBadgeColor} />

      <RepositoryIconTabs
        initialTab={initialTab}
        selectedLucideName={selectedLucideName}
        selectedEmoji={selectedEmoji}
        onSetIcon={setIcon}
      />
    </div>
  )
}
