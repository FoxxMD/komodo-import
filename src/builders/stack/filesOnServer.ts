import { Logger, childLogger } from "@foxxmd/logging";
import { FilesOnServerConfig } from "../../common/infrastructure/config/filesOnServer.js";
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { parse, ParsedPath, sep, join } from 'path';
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { findFilesRecurive, sortComposePaths } from "../../common/utils/io.js";
import { stripIndents } from "common-tags";
import { isDebugMode, removeUndefinedKeys } from "../../common/utils/utils.js";

const DEFAULT_COMPOSE_GLOB = '**/{compose,docker-compose}*.y?(a)ml';

export type BuildFileStackOptions = FilesOnServerConfig & { logger: Logger };

export const buildFileStack = async (path: string, options: BuildFileStackOptions): Promise<TomlStack> => {

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

        const composeFiles = await findFilesRecurive(composeFileGlob, path);
        let sorted = [...composeFiles].reverse();
        if (composeFiles.length === 0) {
            logger.warn(`Did not find any files patterns matching compose glob`);
        } else {
            sorted = sortComposePaths(composeFiles);
            logger.info(stripIndents`Found ${composeFiles.length} files matching compose glob:
            ${sorted.join('\n')}`);

            // only take first file if using default
            if (DEFAULT_COMPOSE_GLOB === composeFileGlob) {
                stack.config.file_paths = [sorted[0]];
            } else {
                // otherwise assume user wants all matched files
                stack.config.file_paths = sorted;
            }
            
            if(stack.config.file_paths.length === 1 && stack.config.file_paths[0] === 'compose.yaml') {
                delete stack.config.file_paths;
                logger.info(`Using file: compose.yaml but not writing to file_paths since this is the Komodo default`);
            } else {
                logger.info(`Using file(s): ${stack.config.file_paths.join('\n')}`);
            }
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

export const buildFileStacks = async (dirs: string[], options: FilesOnServerConfig & { logger: Logger }): Promise<TomlStack[]> => {
    const logger = childLogger(options.logger, 'Files On Server');

    const {
        composeFileGlob = DEFAULT_COMPOSE_GLOB,
        envFileGlob = '**/.env',
    } = options;

    logger.info(`Processing Stacks for ${dirs.length} folders:\n${dirs.join('\n')}`);
    logger.info(`Compose File Glob: ${composeFileGlob}`);
    logger.info(`Env Glob: ${envFileGlob}`);

    const stacks: TomlStack[] = [];
    for (const dir of dirs) {
        try {
            stacks.push(await buildFileStack(dir, {...options, logger}));
        } catch (e) {
            logger.error(new Error(`Unable to build Stack for folder ${dir}`, { cause: e }));
        }
    }

    logger.info(`Built Stack configs for ${stacks.length} folders`);
    return stacks;
}