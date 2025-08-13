import { CommonImportOptions } from "./common.js";

export interface FilesOnServerConfig extends CommonImportOptions {
    hostParentPath: string
    writeEnv?: boolean
}

export interface GitStackCommonConfig extends CommonImportOptions {
    inMonorepo?: boolean | string
    hostParentPath?: string,
    writeEnv?: boolean
}

export interface GitStackStandaloneConfig extends GitStackCommonConfig {
    /** github.com is default, don't need to specify */
    git_provider?: string
    git_account?: string
    repo?: string
    clone_path?: string
}

export interface GitStackLinkedConfig extends GitStackCommonConfig {
    linked_repo?: string
    reclone?: boolean
}

export type GitStackConfig = GitStackLinkedConfig | GitStackStandaloneConfig;

export type AnyStackConfig = GitStackConfig | FilesOnServerConfig;