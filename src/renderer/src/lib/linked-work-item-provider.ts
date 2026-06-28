import type { LinkedWorkItemSummary } from './new-workspace'

export function isGitLabIssueUrl(url: string): boolean {
  // Why: self-hosted GitLab issue URLs may not contain "gitlab".
  try {
    return new URL(url).pathname.includes('/-/issues/')
  } catch {
    return /\/-\/issues\//i.test(url)
  }
}

export function getLinkedWorkItemProvider(
  item: LinkedWorkItemSummary
): NonNullable<LinkedWorkItemSummary['provider']> {
  if (item.provider) {
    return item.provider
  }
  if (item.linearIdentifier) {
    return 'linear'
  }
  if (item.type === 'mr') {
    return 'gitlab'
  }
  if (isGitLabIssueUrl(item.url)) {
    return 'gitlab'
  }
  if (item.number === 0 && !item.url.includes('github.com')) {
    return 'linear'
  }
  return 'github'
}
