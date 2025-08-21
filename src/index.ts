import 'dotenv/config';
import { childLogger, Logger as FoxLogger } from "@foxxmd/logging";
import { appLogger, initLogger as getInitLogger } from "./common/logging.js";
import { parseVersion, projectDir, version } from './common/index.js';
import path from 'path';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { isDebugMode, isUndefinedOrEmptyString, parseBool, transformMultiline } from './common/utils/utils.js';
import { parse, stringify } from 'smol-toml';
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { TomlStack } from './common/infrastructure/tomlObjects.js';
import { CommonImportOptions } from './common/infrastructure/config/common.js';
import { FilesOnServerConfig } from './common/infrastructure/config/stackConfig.js';
import { exportToLog } from './exporters/exportToLog.js';
import { exportToFile } from './exporters/exportToFile.js';
import { exportToSync } from './exporters/exportToApiSync.js';
import { getDefaultKomodoApi } from './common/utils/komodo.js';
import { StackBuilder } from './builders/stack/stackBuilder.js';
import { parseDirectoryConfig } from './common/utils/io.js';
import { DirectoryConfig, DirectoryConfigValues } from './common/infrastructure/atomic.js';

dayjs.extend(utc)
dayjs.extend(timezone);

const parentInitLogger = getInitLogger();
const initLogger = childLogger(parentInitLogger, 'Init');

let logger: FoxLogger;

process.on('uncaughtExceptionMonitor', (err, origin) => {
    const appError = new Error(`Uncaught exception is crashing the app! :( Type: ${origin}`, { cause: err });
    if (logger !== undefined) {
        logger.error(appError)
    } else {
        initLogger.error(appError);
    }
});

try {

    if (process.env.DEBUG_MODE !== undefined) {
        // make sure value is legit
        const b = parseBool(process.env.DEBUG_MODE);
        process.env.DEBUG_MODE = b.toString();
    }

    initLogger.info(`Debug Mode: ${isDebugMode() ? 'YES' : 'NO'}`);

    await parseVersion();

    const aLogger = await appLogger()
    logger = childLogger(aLogger, 'App');

    logger.info(`Version: ${version}`);

    getDefaultKomodoApi(logger);

    let dirData: [DirectoryConfigValues, DirectoryConfig];
    try {
        dirData = await parseDirectoryConfig();
        logger.info(`Mount Dir : ${dirData[0].mountVal} -> Resolved: ${dirData[1].mount}`);
        logger.info(`Host Dir  : ${dirData[0].hostVal} -> Resolved: ${dirData[1].host}`);
        logger.info(`Scan Dir  : ${dirData[0].scanVal} -> Resolved: ${dirData[1].scan}`);
    } catch (e) {
        throw new Error('Could not parse required directories', {cause: e});
    }

    const importOptions: CommonImportOptions = {
        server: process.env.SERVER_NAME,
        imageRegistryProvider: process.env.IMAGE_REGISTRY_PROVIDER,
        imageRegistryAccount: process.env.IMAGE_REGISTRY_ACCOUNT,
        autoUpdate: isUndefinedOrEmptyString(process.env.AUTO_UPDATE) ? undefined : parseBool(process.env.AUTO_UPDATE),
        pollForUpdate: isUndefinedOrEmptyString(process.env.POLL_FOR_UPDATE) ? undefined : parseBool(process.env.POLL_FOR_UPDATE),
        komodoEnvName: process.env.KOMODO_ENV_NAME,
        composeFileGlob: process.env.COMPOSE_FILE_GLOB,
        envFileGlob: process.env.ENV_FILE_GLOB,
        folderGlob: isUndefinedOrEmptyString(process.env.FOLDER_GLOB) ? undefined : process.env.FOLDER_GLOB.trim(),
        ignoreFolderGlob: isUndefinedOrEmptyString(process.env.FOLDER_IGNORE_GLOB) ? undefined : process.env.FOLDER_IGNORE_GLOB.trim(),
    };

    if (importOptions.server === undefined || importOptions.server.trim() === '') {
        logger.error('ENV SERVER_NAME must be set');
        process.exit(1);
    }

    const filesOnServerConfig: FilesOnServerConfig = {
        ...importOptions,
        hostParentPath: process.env.HOST_PARENT_PATH
    };

    const stackBuilder = new StackBuilder(filesOnServerConfig, dirData[1], logger);

    let stacks: TomlStack[] = [];
    let stackModeVal = (process.env.STACKS_FROM ?? 'dir').toLocaleLowerCase();
    if(stackModeVal !== 'compose' && stackModeVal !== 'dir') {
        throw new Error(`STACKS_FROM must be either 'compose' or 'dir'`);
    }
    stacks = await stackBuilder.buildStacks(stackModeVal);//await buildStacksFromPath(process.env.FILES_ON_SERVER_DIR, filesOnServerConfig, logger);

    if (stacks.length === 0) {
        logger.info('No Stacks found! Nothing to do.');
        process.exit(0);
    }

    const data = {
        stack: stacks
    };

    let toml: string;
    let logTomlData = isDebugMode();
    try {
        toml = transformMultiline(stringify(data));
    } catch (e) {
        logger.error(new Error('Could not produce TOML', {cause: e}));
        logTomlData = true;
    } finally {
        if(logTomlData) {
            logger.info(`TOML Data: ${JSON.stringify(data)}`);
        }
    }

    exportToLog(toml, logger);
    await exportToFile(toml, logger);
    await exportToSync(toml, logger);

    logger.info('Done!');

    process.exit(0);
} catch (e) {
    const appError = new Error('Exited with uncaught error', { cause: e });
    if (logger !== undefined) {
        logger.error(appError);
    } else {
        initLogger.error(appError);
    }
    process.exit(1);
}