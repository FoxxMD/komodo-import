import { Logger, childLogger } from "@foxxmd/logging";
import { FilesOnServerConfig, GitStackConfig } from "../../common/infrastructure/config/stackConfig.js";
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { parse, ParsedPath, sep, join } from 'path';
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { dirHasGitConfig, findFilesRecurive, readDirectories, sortComposePaths } from "../../common/utils/io.js";
import { stripIndents } from "common-tags";
import { isDebugMode, removeUndefinedKeys } from "../../common/utils/utils.js";
import { DEFAULT_COMPOSE_GLOB, DEFAULT_ENV_GLOB, selectComposeFiles, selectEnvFiles } from "./stackUtils.js";
import { getGitBranch, matchRemote, RemoteInfo } from "../../common/utils/git.js";

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
        linked_repo,
        git_provider,
        repo
    } = options;

    const pathInfo: ParsedPath = parse(path);

    const logger = childLogger(options.logger, [pathInfo.name, 'Git']);
    logger.info(`Found Stack '${pathInfo.name}' at dir ${path}`);

    if('linked_repo' in options || 'repo' in options) {

    } else {
        try {
            await detectGitRepo(path, logger);
        } catch (e) {

        }
    }

    let stack: TomlStack;
    let logJson = isDebugMode();

    try {
        stack = {
            name: pathInfo.name,
            config: {
                server,
                run_directory: join(hostParentPath, pathInfo.name),
                files_on_host: true,
                registry_account: imageRegistryAccount,
                registry_provider: imageRegistryProvider,
                auto_update: autoUpdate,
                poll_for_updates: pollForUpdate
            }
        };

        stack.config.file_paths = await selectComposeFiles(composeFileGlob, path, logger);

        const envFiles = await selectEnvFiles(envFileGlob, path, logger);
        if(envFiles !== undefined) {
            stack.config.env_file_path = komodoEnvName
            logger.info(`Using ${komodoEnvName} for Komodo-written env file`);
            stack.config.additional_env_files = envFiles;
        }

        logger.info('Stack config complete');

        return removeUndefinedKeys(stack);
    } catch (e) {
        logJson = true;
        throw new Error(`Error occurred while processing Stack for folder ${pathInfo.name}`, {cause: e});
    } finally {
        if(logJson) {
            logger.debug(`Stack Config: ${JSON.stringify(stack)}}`);
        }
    }
}