import { Logger, childLogger } from "@foxxmd/logging";
import { GitStackConfig } from "../../common/infrastructure/config/stackConfig.js";
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { parse, ParsedPath, sep, join, dirname, resolve } from 'path';
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import {  findPathRecuriveParently } from "../../common/utils/io.js";
import { isDebugMode, removeRootPathSeparator, removeUndefinedKeys } from "../../common/utils/utils.js";
import { DEFAULT_COMPOSE_GLOB, DEFAULT_ENV_GLOB, parseEnvConfig, selectComposeFiles, selectEnvFiles } from "./stackUtils.js";
import { detectGitRepo, GitRepoData, komodoRepoFromRemote, matchGitDataWithKomodo, matchRemote, RemoteInfo } from "../../common/utils/git.js";
import { SimpleError } from "../../common/errors.js";

export type BuildGitStackOptions = GitStackConfig & { logger: Logger };

export const buildGitStack = async (path: string, options: BuildGitStackOptions): Promise<TomlStack> => {

    const {
        composeFileGlob = DEFAULT_COMPOSE_GLOB,
        envFileGlob = DEFAULT_ENV_GLOB,
        komodoEnvName = '.komodoEnv',
        imageRegistryAccount,
        imageRegistryProvider,
        autoUpdate,
        pollForUpdate,
        server,
        projectName,
        composeFiles = [],
        writeEnv = false,
        allowGlobDot,
    } = options

    let gitStackConfig: _PartialStackConfig = {}

    const pathInfo: ParsedPath = parse(path);

    const folderName = `${pathInfo.name}${pathInfo.ext !== '' ? pathInfo.ext : ''}`;

    let repoRunDir: string;

    const logger = childLogger(options.logger, [folderName, 'Git']);

    let nonGitReasons: string[] = [];

    let gitData: GitRepoData;
    try {
        gitData = await detectGitRepo(path);
        logger.info(`Current directory is a Git repo: Branch ${gitData[0].branch} | Remote ${gitData[1].remote} | URL ${gitData[1].url}`);
    } catch (e) {
        if (e instanceof SimpleError) {
            nonGitReasons.push(`Current dir is not a git repo => ${e.message}`);
        } else {
            throw e;
        }
    }

    if(gitData === undefined) {
        const parentGitPath = await findPathRecuriveParently(path, '.git', {dot: allowGlobDot});
        if (parentGitPath !== undefined) {
            const parentGitDir = dirname(parentGitPath)
            try {
                gitData = await detectGitRepo(parentGitDir);
                logger.info(`Detected parent path ${parentGitDir} is a Git repo: Branch ${gitData[0].branch} | Remote ${gitData[1].remote} | URL ${gitData[1].url}`);
                logger.info('Will treat current directory as the run directory for this repo');
                repoRunDir = removeRootPathSeparator(path.replace(parentGitDir, ''));
                gitStackConfig.run_directory = repoRunDir;
            } catch (e) {
                if (e instanceof SimpleError) {
                    // really shouldn't get here...
                    nonGitReasons.push(`Parent dir ${parentGitDir} is not a git repo => ${e.message}`);
                } else {
                    throw e;
                }
            }
        }
    }

    if(gitData === undefined) {
        throw new SimpleError(`Could not parse as a git repo: ${nonGitReasons.join(' | ')}`);
    }

    const [provider, repo, repoHint] = await matchGitDataWithKomodo(gitData);
    if (repo === undefined) {
        logger.verbose(`No linked repo because ${repoHint}`);
        const [domain, repo] = komodoRepoFromRemote(gitData[1].url);
        if (repo === undefined) {
            throw new Error(`Could not parse repo from Remote URL ${gitData[1].url}`);
        }
        logger.debug(`Parsed Repo '${repo}' with ${provider?.domain !== undefined ? `provider` : 'URL'} domain '${provider?.domain ?? domain}' from Remote URL ${gitData[1].url}`);
        if (provider?.username !== undefined) {
            logger.debug(`Using provider username ${provider.username}`);
        }
        gitStackConfig = {
            ...gitStackConfig,
            git_provider: provider?.domain ?? domain,
            git_account: provider?.username,
            repo
        };
    } else {
        logger.verbose(`Using linked repo ${repo.name}}`);
        gitStackConfig. linked_repo = repo.name;
    }

    let stack: TomlStack;
    let logJson = isDebugMode();

    try {
        stack = {
            name: projectName ?? folderName,
            config: {
                server,
                registry_account: imageRegistryAccount,
                registry_provider: imageRegistryProvider,
                auto_update: autoUpdate,
                poll_for_updates: pollForUpdate,
                ...gitStackConfig
            }
        };

        if(composeFiles.length > 0) {
            stack.config.file_paths = composeFiles.map(x => removeRootPathSeparator(x.replace(path, '')));
        } else {
            const composePaths = await selectComposeFiles(composeFileGlob, path, logger);
            if(composePaths !== undefined) {
                stack.config.file_paths = composePaths;
            }
        }

        stack.config = {
            ...stack.config,
            ...await(parseEnvConfig(path, {
                envFileGlob, 
                writeEnv,
                pathPrefix: repoRunDir,
                komodoEnvName,
                logger
            }))
        }

        logger.info('Git Stack config complete');

        return removeUndefinedKeys(stack);
    } catch (e) {
        logJson = true;
        throw new Error(`Error occurred while processing Git Stack for folder ${folderName}`, { cause: e });
    } finally {
        if (logJson) {
            logger.debug(`Stack Config: ${JSON.stringify(stack)}}`);
        }
    }
}