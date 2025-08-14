import { Logger, loggerTest } from "@foxxmd/logging";
import { findFilesRecurive, readText, sortComposePaths } from "../../common/utils/io.js";
import { stripIndents } from "common-tags";
import { _PartialStackConfig } from "komodo_client/dist/types.js";
import { CommonImportOptions } from "../../common/infrastructure/config/common.js";
import { CommonStackConfig } from "../../common/infrastructure/config/stackConfig.js";
import { join } from 'path';
import createStatsCollector from "mocha/lib/stats-collector";

export const DEFAULT_COMPOSE_GLOB = '**/{compose,docker-compose}*.y?(a)ml';

export const DEFAULT_ENV_GLOB = '**/*.env';

export const DEFAULT_KOMODO_ENV_NAME = '.komodoEnv';

export const selectComposeFiles = async (glob: string, path: string, logger: Logger): Promise<string[] | undefined> => {

    let file_paths: string[];

    const composeFiles = await findFilesRecurive(glob, path);
    let sorted = [...composeFiles].reverse();
    if (composeFiles.length === 0) {
        logger.warn(`Did not find any files patterns matching compose glob`);
    } else {
        sorted = sortComposePaths(composeFiles);
        logger.info(stripIndents`Found ${composeFiles.length} files matching compose glob:
                ${sorted.join('\n')}`);

        // only take first file if using default
        if (DEFAULT_COMPOSE_GLOB === glob) {
            file_paths = [sorted[0]];
        } else {
            // otherwise assume user wants all matched files
            file_paths = sorted;
        }

        if (file_paths.length === 1 && file_paths[0] === 'compose.yaml') {
            logger.info(`Using file: compose.yaml but not writing to file_paths since this is the Komodo default`);
            return undefined;
        } else {
            logger.info(`Using file(s): ${file_paths.join('\n')}`);
            return file_paths;
        }
    }
};

export const selectEnvFiles = async (glob: string, path: string, logger: Logger): Promise<string[] | undefined> => {

    const envFiles = await findFilesRecurive(glob, path, { dot: true });
    if (envFiles.length > 0) {
        logger.info(stripIndents`Found ${envFiles.length} matching env files:
            ${envFiles.join('\n')}`);
        return envFiles;
    }
    return undefined;
}

export type StackEnvConfig = Pick<_PartialStackConfig, 'additional_env_files' | 'env_file_path' | 'environment'>;
export type ParseEnvOptions = Pick<CommonStackConfig, 'komodoEnvName' | 'writeEnv' | 'envFileGlob'> & { logger?: Logger, pathPrefix?: string };

export const parseEnvConfig = async (path: string, options: ParseEnvOptions = {}): Promise<StackEnvConfig> => {

    const {
        logger = loggerTest,
        komodoEnvName = DEFAULT_KOMODO_ENV_NAME,
        writeEnv = false,
        envFileGlob = DEFAULT_ENV_GLOB,
        pathPrefix: pathPrefix
    } = options;

    const config: StackEnvConfig = {};

    const envFiles = await selectEnvFiles(envFileGlob, path, logger);
    if (envFiles !== undefined) {
        if (writeEnv) {
            logger.verbose('Writing env file(s) contents to Komodo Environmnent');
            const envContents: string[] = [];
            for (const f of envFiles) {
                envContents.push(await readText(join(path, f)))
            }
            const nonEmptyContents = envContents.filter(x => x.trim() !== '');
            config.environment = nonEmptyContents.length > 0 ? nonEmptyContents.join('\n') : undefined;
        }
        else {
            config.env_file_path = komodoEnvName
            logger.info(`Using ${komodoEnvName} for Komodo-written env file`);
            config.additional_env_files = pathPrefix === undefined ? envFiles : envFiles.map(x => join(pathPrefix, x));
        }
    }

    return config;

}