export interface InputParams {
  packageVersionIds?: string[]
  owner?: string
  repo?: string
  packageName?: string
  numOldVersionsToDelete?: number
  numVersionsToKeep?: number
  token?: string
  keepReleased?: boolean
}

const defaultParams = {
  packageVersionIds: [],
  owner: '',
  repo: '',
  packageName: '',
  numOldVersionsToDelete: 0,
  numVersionsToKeep: 0,
  token: '',
  keepReleased: true
}

export class Input {
  packageVersionIds: string[]
  owner: string
  repo: string
  packageName: string
  numOldVersionsToDelete: number
  numVersionsToKeep: number
  token: string
  keepReleased: boolean

  constructor(params?: InputParams) {
    const validatedParams: Required<InputParams> = {...defaultParams, ...params}

    this.packageVersionIds = validatedParams.packageVersionIds
    this.owner = validatedParams.owner
    this.repo = validatedParams.repo
    this.packageName = validatedParams.packageName
    this.numOldVersionsToDelete = validatedParams.numOldVersionsToDelete
    this.numVersionsToKeep = validatedParams.numVersionsToKeep
    this.token = validatedParams.token
    this.keepReleased = validatedParams.keepReleased
  }

  hasOldestVersionQueryInfo(): boolean {
    return !!(
      this.owner &&
      this.repo &&
      this.packageName &&
      this.numOldVersionsToDelete > 0 &&
      this.token
    )
  }

  hasNumToKeepQueryInfo(): boolean {
    return !!(
      this.owner &&
      this.repo &&
      this.packageName &&
      this.numVersionsToKeep > 0 &&
      this.token
    )
  }
}
