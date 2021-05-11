import {GraphQlQueryResponse} from '@octokit/graphql/dist-types/types'
import {from, Observable, throwError} from 'rxjs'
import {catchError, map} from 'rxjs/operators'
import {graphql} from './graphql'

const MAX_DELETIONS = 100

export interface VersionInfo {
  id: string
  version: string
}

export interface GetVersionsQueryResponse {
  repository: {
    packages: {
      edges: {
        node: {
          name: string
          versions: {
            edges: {node: VersionInfo}[]
          }
        }
      }[]
    }
  }
}

export interface GetReleasesResponse {
  repository: {
    releases: {
      edges: {
        node: {
          name: string
        }
      }[]
    }
  }
}

const queryForLast = `
  query getVersions($owner: String!, $repo: String!, $package: String!, $last: Int!) {
    repository(owner: $owner, name: $repo) {
      packages(first: 1, names: [$package]) {
        edges {
          node {
            name
            versions(last: $last) {
              edges {
                node {
                  id
                  version
                }
              }
            }
          }
        }
      }
    }
  }`

const queryFor100Releases = `
  query getReleases($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      releases(first:100) {
        edges{
          node {
           name
          }
        }
      }
    }
  }`

function queryForOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  token: string
): Observable<GetVersionsQueryResponse> {
  return from(
    graphql(token, queryForLast, {
      owner,
      repo,
      package: packageName,
      last: numVersions,
      headers: {
        Accept: 'application/vnd.github.packages-preview+json'
      }
    }) as Promise<GetVersionsQueryResponse>
  ).pipe(
    catchError((err: GraphQlQueryResponse) => {
      const msg = 'query for oldest version failed.'
      return throwError(
        err.errors && err.errors.length > 0
          ? `${msg} ${err.errors[0].message}`
          : `${msg} verify input parameters are correct`
      )
    })
  )
}

async function queryForReleases(owner: string, repo: string, token: string): Promise<GetReleasesResponse> {
  return graphql(token, queryFor100Releases, {
    owner,
    repo,
    headers: {
      Accept: 'application/vnd.github.packages-preview+json'
    }
  }) as Promise<GetReleasesResponse>
}

async function queryForAllVersions(
  owner: string,
  repo: string,
  packageName: string,
  token: string
): Promise<GetVersionsQueryResponse> {
  return from(
    graphql(token, queryForLast, {
      owner,
      repo,
      package: packageName,
      last: MAX_DELETIONS,
      headers: {
        Accept: 'application/vnd.github.packages-preview+json'
      }
    }) as Promise<GetVersionsQueryResponse>
  )
    .pipe(
      catchError((err: GraphQlQueryResponse) => {
        const msg = 'query for all versions failed.'
        return throwError(
          err.errors && err.errors.length > 0
            ? `${msg} ${err.errors[0].message}`
            : `${msg} verify input parameters are correct`
        )
      })
    )
    .toPromise()
}

export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  token: string,
  protectedVersions: string[]
): Observable<VersionInfo[]> {
  return queryForOldestVersions(owner, repo, packageName, numVersions, token).pipe(
    map(result => {
      if (result.repository.packages.edges.length < 1) {
        throwError(`package: ${packageName} not found for owner: ${owner} in repo: ${repo}`)
      }

      const versions = result.repository.packages.edges[0]
        ? result.repository.packages.edges[0].node.versions.edges
        : []

      if (versions.length !== numVersions) {
        console.log(`number of versions requested was: ${numVersions}, but found: ${versions.length}`)
      }

      return versions
        .filter(value => !versionProtected(value.node.version, protectedVersions))
        .map(value => ({id: value.node.id, version: value.node.version}))
        .reverse()
    })
  )
}

export function getNotKeptVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersionsToKeep: number,
  token: string,
  protectedVersions: string[]
): Observable<VersionInfo[]> {
  return from(
    Promise.resolve()
      .then(queryForAllVersions.bind(null, owner, repo, packageName, token))
      .then(
        async (all: GetVersionsQueryResponse): Promise<VersionInfo[]> => {
          if (all.repository.packages.edges.length < 1) {
            throwError(`package: ${packageName} not found for owner: ${owner} in repo: ${repo}`)
          }

          const numVersions = all.repository.packages.edges[0]
            ? all.repository.packages.edges[0].node.versions.edges.length
            : 0

          console.log(`Total versions found = ${numVersions}`)

          if (numVersions > numVersionsToKeep) {
            console.log(`Num versions to delete = ${numVersions - numVersionsToKeep}`)
            return queryForOldestVersions(owner, repo, packageName, numVersions - numVersionsToKeep, token)
              .pipe(
                map((result: GetVersionsQueryResponse): VersionInfo[] => {
                  if (result.repository.packages.edges.length < 1) {
                    throwError(`package: ${packageName} not found for owner: ${owner} in repo: ${repo}`)
                  }

                  const versions = result.repository.packages.edges[0].node.versions.edges
                  return versions
                    .filter(value => !protectedVersions.includes(value.node.version))
                    .map(value => ({id: value.node.id, version: value.node.version}))
                    .reverse()
                })
              )
              .toPromise()
          } else {
            console.log(`Less than ${numVersionsToKeep} versions exist. No versions will be deleted.`)
            return new Promise(resolve => resolve([] as VersionInfo[]))
          }
        }
      )
  )
}

export async function getReleasedVersions(
  owner: string,
  repo: string,
  packageName: string,
  token: string
): Promise<string[]> {
  return queryForReleases(owner, repo, token)
    .then((res: GetReleasesResponse) => res.repository.releases.edges.map(e => e.node.name))
    .catch((err: GraphQlQueryResponse) => {
      const msg = 'query for releases failed.'
      return throwError(
        err.errors && err.errors.length > 0
          ? `${msg} ${err.errors[0].message}`
          : `${msg} verify input parameters are correct`
      )
    }) as Promise<string[]>
}

function versionProtected(version: string, protectedVersions: string[]): boolean {
  const idx: number = version.indexOf('-')
  const sha: string = idx > 0 ? version.substring(idx + 1) : version

  return protectedVersions.includes(sha)
}
