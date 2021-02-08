import {Input} from './input'
import {Observable, of, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions, getNotKeptVersions} from './version'
import {concatMap, map} from 'rxjs/operators'

export function getVersionIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }

  if (input.hasOldestVersionQueryInfo()) {
    return getOldestVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete,
      input.token
    ).pipe(map(versionInfo => versionInfo.map(info => info.id)))
  }
  else if (input.hasNumToKeepQueryInfo()) {
    return getNotKeptVersions(
        input.owner,
        input.repo,
        input.packageName,
        input.numVersionsToKeep,
        input.token
    ).pipe(map(versionInfo => versionInfo.map(info => info.id)))
  }

  return throwError(
    "Could not get packageVersionIds. Explicitly specify using the 'package-version-ids' input or provide the 'package-name' and 'num-old-versions-to-delete' inputs to dynamically retrieve oldest versions"
  )
}

export function deleteVersions(input: Input): Observable<boolean> {
  if (!input.token) {
    return throwError('No token found')
  }

  if (input.numOldVersionsToDelete <= 0 && input.numVersionsToKeep <= 0) {
    console.log(
      'Either num-old-versions-to-delete or num-versions-to-keep needs to be specified. No versions will be deleted.'
    )
    return of(true)
  }

  return getVersionIds(input).pipe(
    concatMap(ids => deletePackageVersions(ids, input.token))
  )
}
