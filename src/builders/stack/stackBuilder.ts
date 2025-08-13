import { AnyStackConfig, FilesOnServerConfig, GitStackCommonConfig, GitStackConfig, GitStackLinkedConfig } from "../../common/infrastructure/config/stackConfig.js";
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { promises } from 'fs';
import { dirHasGitConfig, pathExistsAndIsReadable, readDirectories } from "../../common/utils/io.js";
import { childLogger, Logger } from "@foxxmd/logging";
import { isUndefinedOrEmptyString, parseBool } from "../../common/utils/utils.js";
import { detectGitRepo, GitRepoData, komodoRepoFromRemote, matchGitDataWithKomodo } from "../../common/utils/git.js";
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

    let stackOptions = options;

    const logger = childLogger(parentLogger, 'Stacks');
    let topDir: string;
    try {
        topDir = await promises.realpath(path);
        logger.info(`Top Dir: ${path} -> Resolved: ${topDir}`);
        pathExistsAndIsReadable(topDir)
    } catch (e) {
        throw new Error(`Could not access ${path}.${parseBool(process.env.IS_DOCKER) ? ' This is the path *in container* that is read so make sure you have mounted it on the host!' : ''}`);
    }

    let stacksDir: string = topDir;
    if (!isUndefinedOrEmptyString(process.env.GIT_STACKS_DIR)) {
        try {
            stacksDir = await promises.realpath(process.env.GIT_STACKS_DIR);
            logger.info(`Git Stack Dir: ${stacksDir} -> Resolved: ${stacksDir}`);
            pathExistsAndIsReadable(stacksDir)
        } catch (e) {
            throw new Error(`Could not access ${stacksDir}.${parseBool(process.env.IS_DOCKER) ? ' This is the path *in container* that is read so make sure you have mounted it on the host!' : ''}`);
        }
    }

    let stacks: TomlStack[] = [];

    const dirs = await readDirectories(stacksDir);
    const folderPaths = dirs.map(x => joinPath(stacksDir, x));

    let gitData: GitRepoData;
    try {
        gitData = await detectGitRepo(path, logger);
    } catch (e) {
        throw e;
    }

    logger.info(`Processing Stacks for ${dirs.length} folders in ${stacksDir}:\n${dirs.join('\n')}`);
    logger.info(`Compose File Glob: ${composeFileGlob}`);
    logger.info(`Env Glob: ${envFileGlob}`);

    let hostParentPathVerified = false;

    if (gitData !== undefined) {

        logger.info(`Detected top-level dir ${topDir} is a Git repo: Branch ${gitData[0].branch} | Remote ${gitData[1].remote} | URL ${gitData[1].url}`);
        logger.info('Will treat this as a monorepo -- all subfolders will be built as Git-Repo Stacks using the same repo with Run Directory relative to repo root.');

        let gitStackConfig: Partial<GitStackConfig> = {
            inMonorepo: true
        }
        try {
            const [provider, linkedRepo, repoHint] = await matchGitDataWithKomodo(gitData);
            if (repoHint !== undefined) {
                logger.warn(`All Stacks will be built without a linked repo: ${repoHint}`);
            }
            const [domain, repo] = komodoRepoFromRemote(gitData[1].url)
            if (repo === undefined) {
                gitStackConfig = {
                    ...options,
                    git_provider: provider?.domain ?? domain,
                    git_account: provider?.username,
                    repo
                };
            } else {
                gitStackConfig = {
                    ...options,
                    linked_repo: linkedRepo.name,
                }
            }
        } catch (e) {
            throw new Error('Cannot use top-level git for Stacks', { cause: e });
        }

        stackOptions = {
            ...stackOptions,
            ...gitStackConfig,
            inMonorepo: true
        }
    } else {
        logger.info('Top-level dir is not a git repo -- subfolders will be individually detected as Git repo or files-on-server Stacks.');
    }

    for (const f of folderPaths) {

        const pathInfo: ParsedPath = parse(f);
        const folderLogger = childLogger(logger, `${pathInfo.name}${pathInfo.ext !== '' ? pathInfo.ext : ''}`);

        if (gitData !== undefined) {
            try {
                stacks.push(await buildGitStack(f, 
                    { 
                        ...stackOptions,
                        logger,
                        hostParentPath: stacksDir === topDir ? undefined : stacksDir.replace(topDir, '').replace(/^\//, '')
                    }));
            } catch (e) {
                folderLogger.error(new Error(`Unable to build Git Stack for folder ${f}`, { cause: e }));
            }
        } else {

            try {
                stacks.push(await buildGitStack(f, { inMonorepo: false, ...options, logger }));
                continue;
            } catch (e) {
                if (e.message === 'Not a git repo') {
                    folderLogger.debug('Not a git repo, switching to Files-On-Server');
                } else if (e.message === 'Folder has a .git folder but could not find a suitable remote') {
                    folderLogger.verbose('Folder has a .git folder but could not find a suitable remote, falling back to Files-On-Server');
                } else {
                    folderLogger.error(new Error(`Unable to build Git Stack for folder ${f}`, { cause: e }));
                    continue;
                }
            }

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
    return stacks;
}