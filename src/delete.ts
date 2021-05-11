import {Input} from './input'
import {from, Observable, of, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions, getNotKeptVersions, getReleasedVersions} from './version'
import {concatMap, map} from 'rxjs/operators'

export async function getVersionIds(input: Input): Promise<string[]> {
  if (input.packageVersionIds.length > 0) {
    return Promise.resolve(input.packageVersionIds)
  }

  console.log(`input.keepReleased = ${input.keepReleased}`)

  let protectedVersions: string[] = []
  if (input.keepReleased) {
    console.log('getting released versions')
    protectedVersions = await getReleasedVersions(input.owner, input.repo, input.packageName, input.token)
    console.log(`got ${protectedVersions.length} released versions`)
  }

  if (input.hasOldestVersionQueryInfo()) {
    return getOldestVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete,
      input.token,
      protectedVersions
    )
      .pipe(map(versionInfo => versionInfo.map(info => info.id)))
      .toPromise()
  } else if (input.hasNumToKeepQueryInfo()) {
    return getNotKeptVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numVersionsToKeep,
      input.token,
      protectedVersions
    )
      .pipe(map(versionInfo => versionInfo.map(info => info.id)))
      .toPromise()
  }

  return Promise.reject(
    new Error(
      "Could not get packageVersionIds. Explicitly specify using the 'package-version-ids' input or provide the 'package-name' and 'num-old-versions-to-delete' inputs to dynamically retrieve oldest versions"
    )
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

  return from(getVersionIds(input)).pipe(concatMap(ids => deletePackageVersions(ids, input.token)))
}
