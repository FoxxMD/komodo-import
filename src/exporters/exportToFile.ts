import { childLogger, Logger } from "@foxxmd/logging";
import { fileOrDirectoryIsWriteable } from "../common/utils/io.js";
import { mkdir, writeFile, chmod, constants } from 'node:fs/promises';
import path from "path";
import dayjs from 'dayjs'
import { isDebugMode } from "../common/utils/utils.js";

export const exportToFile = async (toml: string, parentLogger: Logger): Promise<void> => {
    const logger = childLogger(parentLogger, 'File Export');
    const outputDir = process.env.OUTPUT_DIR;
    if (outputDir !== undefined && outputDir.trim() !== '') {
        const time = dayjs().format('YYYY-MM-DD--HH-mm-ss');
        const outputFile = path.join(outputDir, `sync-${time}.toml`);
        try {
            fileOrDirectoryIsWriteable(outputDir);
            await mkdir(outputDir, { recursive: true });
            await writeFile(outputFile, toml);
            logger.info(`Contents written to ${outputFile}`);
        } catch (e) {
            logger.warn(new Error(`Unable to write toml to file ${outputFile}`, { cause: e }));
        }
    } else if(isDebugMode()) {
        logger.debug('Not writing to file because OUTPUT_DIR is empty or not defined.');
    }
}