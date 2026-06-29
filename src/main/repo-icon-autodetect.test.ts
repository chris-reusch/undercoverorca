import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import { gitExecFileAsync } from './git/runner'
import { detectRepoIcon, detectRepoIconAndUpstream } from './repo-icon-autodetect'

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

const tempDirs: string[] = []

async function makeTempRepoDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-repo-icon-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('detectRepoIcon', () => {
  it('uses a small repo-local favicon PNG first', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'favicon.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))
    await writeFile(
      join(repoPath, 'package.json'),
      JSON.stringify({ homepage: 'https://example.com' })
    )

    await expect(detectRepoIcon({ repoPath, kind: 'folder' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'favicon.png'
    })
  })

  it('does not fetch a remote homepage favicon (privacy fork)', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(
      join(repoPath, 'package.json'),
      JSON.stringify({ homepage: 'https://app.example.com/docs' })
    )

    // Privacy: this fork never emits remote favicon URLs, so there is no icon
    // to auto-detect and the renderer falls back to its local default.
    await expect(detectRepoIcon({ repoPath, kind: 'folder' })).resolves.toBeUndefined()
  })

  it('resolves declared icon hrefs from project source files', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'index.html'), '<link rel="icon" href="/brand/icon.png">')
    await mkdir(join(repoPath, 'public', 'brand'), { recursive: true })
    await writeFile(
      join(repoPath, 'public', 'brand', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, kind: 'folder' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'public/brand/icon.png'
    })
  })

  it('resolves relative declared icon hrefs from nested source files', async () => {
    const repoPath = await makeTempRepoDir()
    await mkdir(join(repoPath, 'src', 'routes', 'brand'), { recursive: true })
    await writeFile(
      join(repoPath, 'src', 'routes', '__root.tsx'),
      'export const links = () => [{ rel: "icon", href: "./brand/icon.png" }]'
    )
    await writeFile(
      join(repoPath, 'src', 'routes', 'brand', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, kind: 'folder' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'src/routes/brand/icon.png'
    })
  })

  it('skips oversized source files when looking for declared icon hrefs', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(
      join(repoPath, 'index.html'),
      `${'x'.repeat(256 * 1024 + 1)}<link rel="icon" href="/brand/icon.png">`
    )
    await mkdir(join(repoPath, 'public', 'brand'), { recursive: true })
    await writeFile(
      join(repoPath, 'public', 'brand', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, kind: 'folder' })).resolves.toBeUndefined()
  })

  it('does not resolve declared icon hrefs outside the repo', async () => {
    const parentPath = await makeTempRepoDir()
    const repoPath = join(parentPath, 'repo')
    await mkdir(repoPath)
    await writeFile(join(parentPath, 'outside.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))
    await writeFile(join(repoPath, 'index.html'), '<link rel="icon" href="../outside.png">')

    await expect(detectRepoIcon({ repoPath, kind: 'folder' })).resolves.toBeUndefined()
  })

  it('does not load a remote GitHub owner avatar (privacy fork)', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(['remote', 'add', 'origin', 'git@github.com:stablyai/orca.git'], {
      cwd: repoPath
    })

    // Privacy: no remote avatar fetch; renderer falls back to the local default.
    await expect(detectRepoIcon({ repoPath, kind: 'git' })).resolves.toBeUndefined()
  })

  it('skips code-host package homepages and emits no remote avatar (privacy fork)', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(
      join(repoPath, 'package.json'),
      JSON.stringify({ homepage: 'https://github.com/stablyai/orca' })
    )
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(['remote', 'add', 'origin', 'https://github.com/stablyai/orca.git'], {
      cwd: repoPath
    })

    await expect(detectRepoIcon({ repoPath, kind: 'git' })).resolves.toBeUndefined()
  })

  it('stores a null upstream marker for git repos without a resolved fork parent', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })

    await expect(detectRepoIconAndUpstream({ repoPath, kind: 'git' })).resolves.toEqual({
      upstream: null
    })
  })

  it('uses the resolved fork upstream for metadata without a remote avatar (privacy fork)', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(['remote', 'add', 'origin', 'git@github.com:tmchow/orca.git'], {
      cwd: repoPath
    })
    await gitExecFileAsync(['remote', 'add', 'upstream', 'git@github.com:stablyai/orca.git'], {
      cwd: repoPath
    })

    // Privacy: upstream identity is still resolved for metadata, but no remote
    // avatar icon is produced.
    await expect(detectRepoIconAndUpstream({ repoPath, kind: 'git' })).resolves.toEqual({
      gitRemoteIdentity: {
        canonicalKey: 'github.com/stablyai/orca',
        remoteName: 'upstream',
        remoteUrl: 'git@github.com:stablyai/orca.git'
      },
      upstream: { owner: 'stablyai', repo: 'orca' }
    })
  })

  it('detects a provider-neutral git remote identity for non-GitHub remotes', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(
      ['remote', 'add', 'origin', 'git@git.company.test:platform/tools/sample-app.git'],
      { cwd: repoPath }
    )

    await expect(detectRepoIconAndUpstream({ repoPath, kind: 'git' })).resolves.toMatchObject({
      gitRemoteIdentity: {
        canonicalKey: 'git.company.test/platform/tools/sample-app',
        remoteName: 'origin',
        remoteUrl: 'git@git.company.test:platform/tools/sample-app.git'
      },
      upstream: null
    })
  })
})
