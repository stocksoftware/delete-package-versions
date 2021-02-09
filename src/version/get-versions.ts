import {GraphQlQueryResponse} from '@octokit/graphql/dist-types/types'
import {from, Observable, throwError} from 'rxjs'
import {catchError, map} from 'rxjs/operators'
import {graphql} from './graphql'

const MAX_DELETIONS = 1000

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

export function queryForOldestVersions(
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

export async function queryForAllVersions(
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
  token: string
): Observable<VersionInfo[]> {
  return queryForOldestVersions(
    owner,
    repo,
    packageName,
    numVersions,
    token
  ).pipe(
    map(result => {
      if (result.repository.packages.edges.length < 1) {
        throwError(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
      }

      const versions = result.repository.packages.edges[0]
        ? result.repository.packages.edges[0].node.versions.edges
        : []

      if (versions.length !== numVersions) {
        console.log(
          `number of versions requested was: ${numVersions}, but found: ${versions.length}`
        )
      }

      return versions
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
  token: string
): Observable<VersionInfo[]> {
  return from(
    Promise.resolve()
      .then(queryForAllVersions.bind(null, owner, repo, packageName, token))
      .then(
        async (all: GetVersionsQueryResponse): Promise<VersionInfo[]> => {
          if (all.repository.packages.edges.length < 1) {
            throwError(
              `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
            )
          }

          const numVersions = all.repository.packages.edges[0]
            ? all.repository.packages.edges[0].node.versions.edges.length
            : 0

          console.log(`Total versions found = ${numVersions}`)

          if (numVersions > numVersionsToKeep) {
            console.log(
              `Num versions to delete = ${numVersions - numVersionsToKeep}`
            )
            return queryForOldestVersions(
              owner,
              repo,
              packageName,
              numVersions - numVersionsToKeep,
              token
            )
              .pipe(
                map((result: GetVersionsQueryResponse): VersionInfo[] => {
                  if (result.repository.packages.edges.length < 1) {
                    throwError(
                      `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
                    )
                  }

                  const versions =
                    result.repository.packages.edges[0].node.versions.edges
                  return versions
                    .map(value => {
                      const vi: VersionInfo = {
                        id: value.node.id,
                        version: value.node.version
                      }
                      return vi
                    })
                    .reverse()
                })
              )
              .toPromise()
          } else {
            console.log(
              `Less than ${numVersionsToKeep} versions exist. No versions will be deleted.`
            )
            return new Promise(resolve => resolve([] as VersionInfo[]))
          }
        }
      )
  )
}
