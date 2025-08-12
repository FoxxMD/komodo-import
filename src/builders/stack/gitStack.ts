import { Logger, childLogger } from "@foxxmd/logging";
import { FilesOnServerConfig, GitStackConfig, GitStackLinkedConfig, GitStackStandaloneConfig } from "../../common/infrastructure/config/stackConfig.js";
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { parse, ParsedPath, sep, join } from 'path';
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { dirHasGitConfig, findFilesRecurive, readDirectories, sortComposePaths } from "../../common/utils/io.js";
import { stripIndents } from "common-tags";
import { isDebugMode, removeUndefinedKeys } from "../../common/utils/utils.js";
import { DEFAULT_COMPOSE_GLOB, DEFAULT_ENV_GLOB, selectComposeFiles, selectEnvFiles } from "./stackUtils.js";
import { detectGitRepo, komodoRepoFromRemoteAndDomain, matchGitDataWithKomodo, matchRemote, RemoteInfo } from "../../common/utils/git.js";

export type BuildGitStackOptions = GitStackConfig & { logger: Logger };

export const buildGitStack = async (path: string, options: BuildGitStackOptions): Promise<TomlStack> => {

    const {
        composeFileGlob = DEFAULT_COMPOSE_GLOB,
        envFileGlob = DEFAULT_ENV_GLOB,
        komodoEnvName = '.komodoEnv',
        imageRegistryAccount,
        imageRegistryProvider,
        autoUpdate = false,
        pollForUpdate = false,
        server,
        inMonorepo
    } = options;

    let gitStackConfig: _PartialStackConfig;

    const pathInfo: ParsedPath = parse(path);

    const logger = childLogger(options.logger, [pathInfo.name, 'Git']);

    if (inMonorepo === false) {

        if(!dirHasGitConfig(await readDirectories(path))) {
            throw new Error('Not a git repo');
        }

        let gitData: Awaited<ReturnType<typeof detectGitRepo>>;
        try {
            gitData = await detectGitRepo(path, logger);
        } catch (e) {
            throw new Error(`Unable to parse git info in folder`, { cause: e });
        }
        if(gitData === undefined) {
            throw new Error('Folder has a .git folder but could not find a suitable remote');
        }
        logger.info(`Folder has tracked branch '${gitData[0]}' with valid remote '${gitData[1].remote}'`)

        const [provider, repo, repoHint] = await matchGitDataWithKomodo(gitData);
        if (repo === undefined) {
            logger.verbose(`Stack will be built without a linked repo: ${repoHint}`);
            const repo = komodoRepoFromRemoteAndDomain(provider?.domain ?? 'github.com', gitData[1].url);
            logger.debug(`Parsed Repo '${repo}' from Remote URL ${gitData[1].url}`);
            gitStackConfig = {
                git_provider: provider?.domain,
                git_account: provider?.username,
                repo
            };
        } else {
            logger.verbose(`Using linked repo ${repo.name}}`);
            gitStackConfig = {
                linked_repo: repo.name,
            }
        }
    } else {
        gitStackConfig = removeUndefinedKeys(
            {
                linked_repo: (options as GitStackLinkedConfig).linked_repo,
                git_provider: (options as GitStackStandaloneConfig).git_provider,
                git_account: (options as GitStackStandaloneConfig).git_account,
                repo: (options as GitStackStandaloneConfig).repo,
            }
        )
    }

    let stack: TomlStack;
    let logJson = isDebugMode();

    try {
        stack = {
            name: pathInfo.name,
            config: {
                server,
                run_directory: inMonorepo ? pathInfo.name : undefined,
                files_on_host: true,
                registry_account: imageRegistryAccount,
                registry_provider: imageRegistryProvider,
                auto_update: autoUpdate,
                poll_for_updates: pollForUpdate,
                ...gitStackConfig
            }
        };

        const composePaths = await selectComposeFiles(composeFileGlob, path, logger);
        if(composePaths !== undefined) {
            stack.config.file_paths = composePaths.map(x => inMonorepo ? join(pathInfo.name, x) : x);
        }

        const envFiles = await selectEnvFiles(envFileGlob, path, logger);
        if (envFiles !== undefined) {
            stack.config.env_file_path = komodoEnvName
            logger.info(`Using ${komodoEnvName} for Komodo-written env file`);
            stack.config.additional_env_files = envFiles.map(x => inMonorepo ? join(pathInfo.name, x) : x);
        }

        logger.info('Git Stack config complete');

        return removeUndefinedKeys(stack);
    } catch (e) {
        logJson = true;
        throw new Error(`Error occurred while processing Git Stack for folder ${pathInfo.name}`, { cause: e });
    } finally {
        if (logJson) {
            logger.debug(`Stack Config: ${JSON.stringify(stack)}}`);
        }
    }
}