import { Logger } from "@foxxmd/logging";
import { parseBool } from "../common/utils/utils.js";
import { stripIndents } from "common-tags";

const separator = '✂️  ✂️  ✂️  ✂️  ✂️  ✂️  ✂️  ✂️  ✂️  ✂️  ✂️  ✂️';

export const exportToLog = (toml: string, logger: Logger) => {
    if(parseBool(process.env.LOG_TOML ?? true)) {
        logger.info(stripIndents`
            Copy the text between the scissors to use as the *Resource File* contents within your Resource Sync

            ${separator}
            ${toml}
            ${separator}`);
    }
}