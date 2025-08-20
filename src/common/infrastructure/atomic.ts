export interface URLData {
    url: URL
    normal: string
    port: number
}

export interface GitBranchStatus {
     branch?: string, 
     remote?: string,
     remoteBranch?: string
     raw: string 
}

export const DEFAULT_GLOB_FOLDER = '*';

export type StackDiscoveryMethod = 'compose' | 'monorepo' | 'folder';

export type StackSourceOfTruth = 'compose' | 'dir';

export interface StackCandidate {
    path: string
    discovered: StackDiscoveryMethod
    projectName: string
}

export interface StackCandidateCompose extends StackCandidate {
    discovered: 'compose'
    workingDir: string
    composeFilePaths: string[]
    state: 'running' | string
}

export interface DirectoryConfigValues {
    mountVal?: string
    hostVal?: string
    scanVal?: string
}

export interface DirectoryConfig {
    mount: string
    host: string
    scan: string
}