import { childLogger, Logger } from "@foxxmd/logging";
import { KomodoClient, Types } from "komodo_client";
import { isDebugMode, isUndefinedOrEmptyString, parseBool } from "../common/utils/utils.js";
import path from 'path';
import { stripIndents } from "common-tags";
import dayjs from "dayjs";
import { normalizeWebAddress } from "../common/utils/network.js";

export const exportToSync = async (toml: string, parentLogger: Logger): Promise<void> => {
    const logger = childLogger(parentLogger, 'Sync API');

    if (parseBool(process.env.OUTPUT_API_SYNC)) {
        try {
            if (isUndefinedOrEmptyString(process.env.API_KEY)) {
                logger.error(`Cannot export to Resource Sync because env API_KEY is missing`);
                return;
            }
            if (isUndefinedOrEmptyString(process.env.API_SECRET)) {
                logger.error(`Cannot export to Resource Sync because env API_SECRET is missing`);
                return;
            }
            const syncName = isUndefinedOrEmptyString(process.env.SYNC_NAME) ? 'komodo-import' : process.env.SYNC_NAME;
            logger.info(`Using '${syncName}' as Sync Name`);

            const urlData = normalizeWebAddress(process.env.KOMODO_URL);
            logger.verbose(`KOMODO_URL: ${process.env.KOMODO_URL} | Normalized: ${urlData.url.toString()}`)

            const komodo = KomodoClient(urlData.url.toString(), {
                type: "api-key",
                params: {
                    key: process.env.API_KEY,
                    secret: process.env.API_SECRET
                },
            });

            let syncId: string;
            let existingBehaviorVal = process.env.EXISTING_SYNC ?? 'append';
            let existingBehavior: ExistingSyncBehavior;
            let existingSync: Types.ResourceSync;

            try {
                existingSync = await komodo.read('GetResourceSync', {
                    sync: syncName
                });
                syncId = existingSync._id.$oid;
                if (isUndefinedOrEmptyString(existingBehaviorVal)) {
                    logger.error(`Sync with name ${syncName} already exists (ID ${syncId}) and EXISTING_SYNC env was not defined: must be 'overwrite' or 'append'`);
                    return;
                }
                const cleanBehavior = existingBehaviorVal.trim().toLocaleLowerCase();
                if (asExistingSyncBehavior(cleanBehavior)) {
                    existingBehavior = cleanBehavior;
                } else {
                    logger.error(`Sync with name ${syncName} already exists (ID ${syncId}) and EXISTING_SYNC env val (${cleanBehavior}) must be 'overwrite' or 'append'`);
                    return;
                }
                logger.verbose(`Resource Sync ${syncName} alerady exists (ID ${syncId}), will ${existingBehavior} contents`);
            } catch (e) {
                // do nothing
            }


            if (syncId === undefined) {
                const sync = await komodo.write('CreateResourceSync', {
                    name: syncName,
                    config: {
                        include_resources: true,
                        file_contents: toml
                    }
                });
                syncId = sync._id.$oid;
                logger.info('Resource Sync created.');
            } else {
                if (existingBehavior === 'overwrite') {
                    const sync = await komodo.write('UpdateResourceSync', {
                        id: syncId,
                        config: {
                            include_resources: true,
                            file_contents: toml
                        }
                    });
                     logger.info('Resource Sync overwrriten.');
                } else {
                    const time = dayjs().format('YYYY-MM-DD--HH-mm-ss');
                    const sync = await komodo.write('UpdateResourceSync', {
                        id: syncId,
                        config: {
                            include_resources: true,
                            file_contents: stripIndents`${existingSync.config.file_contents}
                            
                            ## Added by Komodo Import ${time}
                            
                            ${toml}
                            
                            ##`
                        }
                    });
                     logger.info('Resource Sync appended.');
                }
            }

            const syncUrl = path.join(urlData.url.toString(), 'resource-syncs', syncId);

            logger.info(`Resource Sync URL: ${syncUrl}`);
        }
        catch (e) {
            let hint: string;
            switch (e.result?.error) {
                case 'Must provide unique name for resource.':
                    hint = 'Sync already exists! Use a different name.'
                    break;
            }
            throw new Error(`Komodo API error occurred while trying to export to Resource Sync${hint !== undefined ? `. Hint: ${hint}` : ''}`, { cause: e });
        }
    } else if (isDebugMode()) {
        logger.debug('Not exporting to Resource Sync because env KOMODO_URL was not defined.');
    }
}

type ExistingSyncBehavior = 'overwrite' | 'append';

const asExistingSyncBehavior = (val: string): val is ExistingSyncBehavior => {
    if (val === 'overwrite' || val === 'append') {
        return true;
    }
    return false;
}