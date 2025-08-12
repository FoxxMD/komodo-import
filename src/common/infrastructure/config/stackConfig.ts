import { CommonImportOptions } from "./common.js";

export interface FilesOnServerConfig extends CommonImportOptions {
    hostParentPath: string
}

export interface GitStackStandaloneConfig extends CommonImportOptions {
    /** github.com is default, don't need to specify */
    git_provider?: string
    git_account?: string
    repo?: string
    clone_path?: string
}

export interface GitStackLinkedConfig extends CommonImportOptions {
    linked_repo?: string
    reclone?: boolean
}

export type GitStackConfig = GitStackLinkedConfig | GitStackStandaloneConfig;

export type AnyStackConfig = GitStackConfig | FilesOnServerConfig;