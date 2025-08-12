import 'dotenv/config';
import { childLogger, Logger as FoxLogger } from "@foxxmd/logging";
import { appLogger, initLogger as getInitLogger } from "./common/logging.js";
import { parseVersion, projectDir, version } from './common/index.js';
import path from 'path';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { promises } from 'fs';
import { isDebugMode, parseBool } from './common/utils/utils.js';
import { parse, stringify } from 'smol-toml';
import { fileOrDirectoryIsWriteable, pathExistsAndIsReadable, readDirectories, writeFile } from './common/utils/io.js';
import { _PartialStackConfig } from 'komodo_client/dist/types.js';
import { TomlStack } from './common/infrastructure/tomlObjects.js';
import { buildFileStack, buildFileStacks } from './builders/stack/filesOnServer.js';
import { CommonImportOptions } from './common/infrastructure/config/common.js';
import { FilesOnServerConfig } from './common/infrastructure/config/stackConfig.js';
import { exportToLog } from './exporters/exportToLog.js';
import { exportToFile } from './exporters/exportToFile.js';
import { exportToSync } from './exporters/exportToApiSync.js';
import { getGitBranch, matchRemote } from './common/utils/git.js';
import { getDefaultKomodoApi } from './common/utils/komodo.js';

dayjs.extend(utc)
dayjs.extend(timezone);

const [parentInitLogger] = getInitLogger();
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

const configDir = process.env.CONFIG_DIR || path.resolve(projectDir, `./config`);

try {

    if (process.env.DEBUG_MODE !== undefined) {
        // make sure value is legit
        const b = parseBool(process.env.DEBUG_MODE);
        process.env.DEBUG_MODE = b.toString();
    }

    initLogger.info(`Debug Mode: ${isDebugMode() ? 'YES' : 'NO'}`);

    await parseVersion();

    const [aLogger, appLoggerStream] = await appLogger()
    logger = childLogger(aLogger, 'App');

    logger.info(`Version: ${version}`);

    getDefaultKomodoApi(logger);

   const resp = await getGitBranch();
   const remote = await matchRemote(resp.remote);

    const importOptions: CommonImportOptions = {
        server: process.env.SERVER_NAME,
        imageRegistryProvider: process.env.IMAGE_REGISTRY_PROVIDER,
        imageRegistryAccount: process.env.IMAGE_REGISTRY_ACCOUNT,
        autoUpdate: parseBool(process.env.AUTO_UPDATE),
        pollForUpdate: parseBool(process.env.POLL_FOR_UPDATE),
        komodoEnvName: process.env.KOMODO_ENV_NAME,
        composeFileGlob: process.env.COMPOSE_FILE_GLOB,
        envFileGlob: process.env.ENV_FILE_GLOB
    };

    if (importOptions.server === undefined || importOptions.server.trim() === '') {
        logger.error('ENV SERVER_NAME must be set');
        process.exit(1);
    }

    const filesOnServerConfig: FilesOnServerConfig = {
        ...importOptions,
        hostParentPath: process.env.HOST_PARENT_PATH
    };

    if (filesOnServerConfig.hostParentPath === undefined || filesOnServerConfig.hostParentPath.trim() === '') {
        logger.error('ENV HOST_PARENT_PATH must be set');
        process.exit(1);
    }

    if (process.env.FILES_ON_SERVER_DIR === undefined || process.env.FILES_ON_SERVER_DIR.trim() === '') {
        logger.error('ENV FILES_ON_SERVER_DIR must be set');
        process.exit(1);
    }

    let FILES_ON_SERVER_DIR = process.env.FILES_ON_SERVER_DIR;
    try {
        FILES_ON_SERVER_DIR = await promises.realpath(process.env.FILES_ON_SERVER_DIR);
        logger.info(`Files On Server Dir ENV: ${process.env.FILES_ON_SERVER_DIR} -> Resolved: ${FILES_ON_SERVER_DIR}`);
        pathExistsAndIsReadable(FILES_ON_SERVER_DIR)
    } catch (e) {
        logger.error(`Could not access ${FILES_ON_SERVER_DIR}.${parseBool(process.env.IS_DOCKER) ? ' This is the path *in container* that is read so make sure you have mounted it on the host!' : ''}`);
        logger.error(e);
        process.exit(1);
    }

    const dirs = await readDirectories(FILES_ON_SERVER_DIR);

    let stacks: TomlStack[] = [];
    const folderPaths = dirs.map(x => path.join(FILES_ON_SERVER_DIR, x));
    stacks = await buildFileStacks(folderPaths, { ...filesOnServerConfig, logger });

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
        toml = stringify(data);
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