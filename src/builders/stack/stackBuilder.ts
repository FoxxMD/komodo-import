import { AnyStackConfig, FilesOnServerConfig, GitStackConfig, GitStackLinkedConfig } from "../../common/infrastructure/config/stackConfig.js";
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { promises } from 'fs';
import { pathExistsAndIsReadable, readDirectories } from "../../common/utils/io.js";
import { childLogger, Logger } from "@foxxmd/logging";
import { isUndefinedOrEmptyString, parseBool } from "../../common/utils/utils.js";
import { detectGitRepo, komodoRepoFromRemoteAndDomain } from "../../common/utils/git.js";
import { getDefaultKomodoApi } from "../../common/utils/komodo.js";
import { buildGitStack } from "./gitStack.js";
import { join as joinPath, parse, ParsedPath } from 'path';
import { DEFAULT_COMPOSE_GLOB, DEFAULT_ENV_GLOB } from "./stackUtils.js";
import { GitProviderAccount, RepoListItem } from "komodo_client/dist/types.js";
import { buildFileStack } from "./filesOnServer.js";

export const buildStacksFromPath = async (path: string, options: AnyStackConfig, parentLogger: Logger): Promise<TomlStack[]> => {

    const {
        composeFileGlob = DEFAULT_COMPOSE_GLOB,
        envFileGlob = DEFAULT_ENV_GLOB,
    } = options;

    const logger = childLogger(parentLogger, 'Stacks');
    let stacksDir: string;
    try {
        stacksDir = await promises.realpath(path);
        logger.info(`Files On Server Dir ENV: ${path} -> Resolved: ${stacksDir}`);
        pathExistsAndIsReadable(stacksDir)
    } catch (e) {
        throw new Error(`Could not access ${path}.${parseBool(process.env.IS_DOCKER) ? ' This is the path *in container* that is read so make sure you have mounted it on the host!' : ''}`);
    }

    let stacks: TomlStack[] = [];

    const dirs = await readDirectories(stacksDir);
    const folderPaths = dirs.map(x => joinPath(stacksDir, x));

    let gitData: Awaited<ReturnType<typeof detectGitRepo>>;
    try {
        gitData = await detectGitRepo(path, logger);
    } catch (e) {
        throw e;
    }

    if (gitData) {
        logger.info(`Detected top-level dir ${stacksDir} is a Git repo: Branch ${gitData[0]} | Remote ${gitData[1].remote} | URL ${gitData[1].url}`);
        logger.info('Will treat this as a monorepo -- all subfolders will be built as Git-Repo Stacks using the same repo with Run Directory relative to repo root.');
    } else {
        logger.info('Top-level dir is not a git repo -- subfolders will be individually detected as Git repo or files-on-server Stacks.');
    }

    logger.info(`Processing Stacks for ${dirs.length} folders:\n${dirs.join('\n')}`);
    logger.info(`Compose File Glob: ${composeFileGlob}`);
    logger.info(`Env Glob: ${envFileGlob}`);

    let hostParentPathVerified = false;


    if (gitData !== undefined) {

        let gitStackConfig: GitStackConfig;
        try {
            const [provider, repo, repoHint] = await matchGitDataWithKomodo(gitData);
            if (repoHint !== undefined) {
                logger.warn(`All Stacks will be built without a linked repo: ${repoHint}}`);
            }
            if (repo === undefined) {
                gitStackConfig = {
                    ...options,
                    git_provider: provider?.domain,
                    git_account: provider?.username,
                    repo: komodoRepoFromRemoteAndDomain(provider?.domain ?? 'github.com', gitData[1].remote)
                };
            } else {
                gitStackConfig = {
                    ...options,
                    linked_repo: repo.name,
                }
            }
        } catch (e) {
            throw new Error('Cannot use top-level git for Stacks', { cause: e });
        }

        for (const f of folderPaths) {
            try {
                stacks.push(await buildGitStack(f, { ...gitStackConfig, logger }));
            } catch (e) {
                logger.error(new Error(`Unable to build Git Stack for folder ${f}`, { cause: e }));
            }
        }
    } else {
        for (const f of folderPaths) {

            const pathInfo: ParsedPath = parse(path);

            const folderLogger = childLogger(logger, pathInfo.name);


            let gitData: Awaited<ReturnType<typeof detectGitRepo>>;
            try {
                gitData = await detectGitRepo(path, folderLogger);
            } catch (e) {
                folderLogger.error(new Error(`Unable to parse git info in folder ${f}`, { cause: e }));
            }
            if (gitData !== undefined) {
                let gitStackConfig: GitStackConfig;
                const [provider, repo, repoHint] = await matchGitDataWithKomodo(gitData);
                if (repoHint !== undefined) {
                    folderLogger.warn(`Stacks will be built without a linked repo: ${repoHint}}`);
                }
                if (repo === undefined) {
                    gitStackConfig = {
                        ...options,
                        git_provider: provider?.domain,
                        git_account: provider?.username,
                        repo: komodoRepoFromRemoteAndDomain(provider?.domain ?? 'github.com', gitData[1].remote)
                    };
                } else {
                    gitStackConfig = {
                        ...options,
                        linked_repo: repo.name,
                    }
                }

                try {
                    stacks.push(await buildGitStack(f, { ...gitStackConfig, logger }));
                } catch (e) {
                    folderLogger.error(new Error(`Unable to build Git Stack for folder ${f}`, { cause: e }));
                }

            } else {
                folderLogger.verbose('Folder is not a git repo, building as Files-On-Server Stack');
                const opts = options as FilesOnServerConfig;
                if (!hostParentPathVerified) {
                    if (isUndefinedOrEmptyString(opts.hostParentPath)) {
                        throw new Error('env HOST_PARENT_PATH is not set');
                    }
                    hostParentPathVerified = true;
                }
                try {
                    stacks.push(await buildFileStack(f, { ...opts, logger }));
                } catch (e) {
                    folderLogger.error(new Error(`Unable to build Files-On-Server Stack for folder ${f}`, { cause: e }));
                }
            }
        }
    }
}

export const matchGitDataWithKomodo = async (gitData: Awaited<ReturnType<typeof detectGitRepo>>): Promise<[GitProviderAccount?, RepoListItem?, string?]> => {
    const repos = await getDefaultKomodoApi().getRepos();

    let provider: GitProviderAccount;
    let repo: RepoListItem;
    let repoHint: string = 'No existing Komodo Repo resource matches the remote';

    const validRepos = repos.filter(x => gitData[1].url.includes(x.info.repo) && gitData[1].url.includes(x.info.git_provider));
    if (validRepos.length !== 0) {
        const branchAndRepo = validRepos.find(x => x.info.branch === gitData[0]);
        if (branchAndRepo === undefined) {
            repoHint = 'There are existing Komodo Repo resource that match the remote but none have a matching branch';
        } else {
            repo = branchAndRepo;
            repoHint = undefined;
        }
    }

    const providers = await getDefaultKomodoApi().getGitProviders();
    const validProvider = providers.find(x => gitData[1].url.includes(x.domain));
    if (validProvider === undefined) {
        // default provider, we don't need to find an added one
        if (!gitData[1].url.includes('github.com')) {
            throw new Error(`No existing Komodo Git Account provider that matches remote ${gitData[1].url} exists.`);
        }
    } else {
        provider = validProvider;
    }
    return [provider, repo, repoHint];
}