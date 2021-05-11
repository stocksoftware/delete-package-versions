// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import {mockOldestQueryResponse} from './graphql.mock'
import {getOldestVersions as _getOldestVersions, VersionInfo} from '../../src/version'
import {Observable} from 'rxjs'

describe.skip('get versions tests -- call graphql', () => {
  it('getOldestVersions -- succeeds', done => {
    const numVersions = 1

    getOldestVersions({numVersions}).subscribe(versions => {
      expect(versions.length).toBe(numVersions)
      done()
    })
  })

  it('getOldestVersions -- fails for invalid repo', done => {
    getOldestVersions({repo: 'actions-testin'}).subscribe({
      error: err => {
        expect(err).toBeTruthy()
        done()
      },
      complete: async () => done.fail('no error thrown')
    })
  })
})

describe('get versions tests -- mock graphql', () => {
  it('getOldestVersions -- success', done => {
    const numVersions = 5
    mockOldestQueryResponse(numVersions)

    getOldestVersions({numVersions}).subscribe(versions => {
      expect(versions.length).toBe(numVersions)
      done()
    })
  })
})

interface Params {
  owner?: string
  repo?: string
  packageName?: string
  numVersions?: number
  token?: string
}

const defaultParams = {
  owner: 'trent-j',
  repo: 'actions-testing',
  packageName: 'com.github.trent-j.actions-test',
  numVersions: 3,
  token: process.env.GITHUB_TOKEN as string
}

function getOldestVersions(params?: Params): Observable<VersionInfo[]> {
  const p: Required<Params> = {...defaultParams, ...params}
  return _getOldestVersions(p.owner, p.repo, p.packageName, p.numVersions, p.token, [])
}
