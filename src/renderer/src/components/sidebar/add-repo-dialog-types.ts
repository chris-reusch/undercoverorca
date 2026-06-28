export type AddRepoDialogStep = 'add' | 'clone' | 'remote' | 'server-path' | 'create' | 'nested'

// Runtime origin of a nested-repo scan. Drives real flow behavior (e.g. SSH and
// runtime hosts disable streaming scans); previously sourced from the removed
// nested-repo telemetry module.
export type NestedRepoRuntimeKind = 'local' | 'runtime' | 'ssh'

// Correlates the progressive scan callbacks with the final review for a single
// add attempt. Inlined here after the nested-repo telemetry module was removed.
export function createNestedRepoAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function defaultProjectGroupNameForPath(path: string): string {
  return (
    path
      .replace(/[\\/]+$/g, '')
      .split(/[\\/]/)
      .filter(Boolean)
      .at(-1) ?? path
  )
}

export function createNestedRepoScanId(): string {
  return `nested-repo-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
