import { Logger } from "@foxxmd/logging";
import { findFilesRecurive, sortComposePaths } from "../../common/utils/io.js";
import { stripIndents } from "common-tags";

export const DEFAULT_COMPOSE_GLOB = '**/{compose,docker-compose}*.y?(a)ml';

export const DEFAULT_ENV_GLOB = '**/.env';

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

    const envFiles = await findFilesRecurive(glob, path);
    if (envFiles.length > 0) {
        logger.info(stripIndents`Found ${envFiles.length} matching env files:
            ${envFiles.join('\n')}`);
        return envFiles;
    }
    return undefined;
}