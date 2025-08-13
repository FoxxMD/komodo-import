import { Logger, childLogger } from "@foxxmd/logging";
import { FilesOnServerConfig } from "../../common/infrastructure/config/stackConfig.js";
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { parse, ParsedPath, sep, join } from 'path';
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { readText } from "../../common/utils/io.js";
import { isDebugMode, removeUndefinedKeys } from "../../common/utils/utils.js";
import { DEFAULT_COMPOSE_GLOB, DEFAULT_ENV_GLOB, selectComposeFiles, selectEnvFiles } from "./stackUtils.js";

export type BuildFileStackOptions = FilesOnServerConfig & { logger: Logger };

export const buildFileStack = async (path: string, options: BuildFileStackOptions): Promise<TomlStack> => {

    const {
        composeFileGlob = DEFAULT_COMPOSE_GLOB,
        envFileGlob = DEFAULT_ENV_GLOB,
        komodoEnvName = '.komodoEnv',
        imageRegistryAccount,
        imageRegistryProvider,
        autoUpdate,
        pollForUpdate,
        server,
        hostParentPath,
        writeEnv = false,
    } = options;

    const pathInfo: ParsedPath = parse(path);

    const folderName = `${pathInfo.name}${pathInfo.ext !== '' ? pathInfo.ext : ''}`;

    const logger = childLogger(options.logger, [folderName, 'Files On Server']);
    logger.info(`Found Stack '${folderName}' at dir ${path}`);

    let stack: TomlStack;
    let logJson = isDebugMode();

    try {
        stack = {
            name: folderName,
            config: {
                server,
                run_directory: join(hostParentPath, folderName),
                files_on_host: true,
                registry_account: imageRegistryAccount,
                registry_provider: imageRegistryProvider,
                auto_update: autoUpdate,
                poll_for_updates: pollForUpdate
            }
        };

        stack.config.file_paths = await selectComposeFiles(composeFileGlob, path, logger);

        const envFiles = await selectEnvFiles(envFileGlob, path, logger);
        if (envFiles !== undefined) {
            if (writeEnv) {
                logger.verbose('Writing env file(s) contents to Komodo Environmnent');
                const envContents: string[] = [];
                for (const f of envFiles) {
                    envContents.push(await readText(envFiles))
                }
                stack.config.environment = envContents.join('\n');
            }
            else {
                stack.config.env_file_path = komodoEnvName
                logger.info(`Using ${komodoEnvName} for Komodo-written env file`);
                stack.config.additional_env_files = envFiles;
            }
        }

        logger.info('Stack config complete');

        return removeUndefinedKeys(stack);
    } catch (e) {
        logJson = true;
        throw new Error(`Error occurred while processing Stack for folder ${folderName}`, { cause: e });
    } finally {
        if (logJson) {
            logger.debug(`Stack Config: ${JSON.stringify(stack)}}`);
        }
    }
}