import { Logger, childLogger } from "@foxxmd/logging";
import { FilesOnServerConfig } from "../../common/infrastructure/config/filesOnServer.js";
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { parse, ParsedPath, sep, join } from 'path';
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { findFilesRecurive, sortComposePaths } from "../../common/utils/io.js";
import { stripIndents } from "common-tags";

const DEFAULT_COMPOSE_GLOB = '**/{compose,docker-compose}*.y?(a)ml';
//const DEFAULT_COMPOSE_GLOB = 'compose.yaml';

export const buildFileStack = async (path: string, options: FilesOnServerConfig & { logger: Logger }): Promise<TomlStack> => {

    const {
        composeFileGlob = DEFAULT_COMPOSE_GLOB,
        envFileGlob = '**/.env',
        komodoEnvName = '.komodoEnv',
        imageRegistryAccount,
        imageRegistryProvider,
        autoUpdate = false,
        pollForUpdate = false,
        server,
        hostParentPath
    } = options;

    const pathInfo: ParsedPath = parse(path);

    const logger = childLogger(options.logger, pathInfo.name);
    logger.info(`Found Stack '${pathInfo.name}' at dir ${path}`);

    const stack: TomlStack = {
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

    const composeFiles = await findFilesRecurive(composeFileGlob, path);
    let sorted = [...composeFiles].reverse();
    if (composeFiles.length === 0) {
        logger.warn(`Did not find any files patterns matching compose pattern ${composeFileGlob}`);
    } else {
        sorted = sortComposePaths(composeFiles);
        logger.info(stripIndents`Found ${composeFiles.length} files matching compose pattern ${composeFileGlob}:
            ${sorted.join('\n')}`);
    }
    // only take first file if using default
    if (DEFAULT_COMPOSE_GLOB === composeFileGlob) {
        stack.config.file_paths = [sorted[0]];
    } else {
        // otherwise assume user wants all matched files
        stack.config.file_paths = sorted;
    }

    const envFiles = await findFilesRecurive(envFileGlob, path);
    if (envFiles.length > 0) {
        stack.config.env_file_path = komodoEnvName
        logger.info(stripIndents`Found ${envFiles.length} env files matching pattern ${envFileGlob}:
            ${envFiles.join('\n')}`);
        logger.info(`Using ${komodoEnvName} for Komodo-written env file`);
        stack.config.additional_env_files = envFiles;
    }

    logger.info('Stack config complete');

    return stack;
}