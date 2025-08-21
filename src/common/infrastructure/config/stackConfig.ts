import { CommonImportOptions } from "./common.js";

export interface CommonStackConfig extends CommonImportOptions {
        writeEnv?: boolean
        hostParentPath?: string,
        composeFiles?: string[]
        projectName?: string
}

export interface FilesOnServerConfig extends CommonStackConfig {
}

export interface GitStackCommonConfig extends CommonStackConfig {
    inMonorepo?: boolean | string
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