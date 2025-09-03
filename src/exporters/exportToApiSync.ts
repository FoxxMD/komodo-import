import { childLogger, Logger } from "@foxxmd/logging";
import { Types } from "komodo_client";
import { isDebugMode, isUndefinedOrEmptyString, parseBool } from "../common/utils/utils.js";
import path from 'path';
import { stripIndents } from "common-tags";
import dayjs from "dayjs";
import { getDefaultKomodoApi } from "../common/utils/komodo.js";
import { asKomodoApiErrorResponse, KomodoApiError } from "../common/errors.js";

export const exportToSync = async (toml: string, parentLogger: Logger): Promise<void> => {
    const logger = childLogger(parentLogger, 'Sync API');

    if (parseBool(process.env.OUTPUT_API_SYNC)) {
        try {
            const komodo = getDefaultKomodoApi();
            if (komodo === undefined) {
                throw new Error('Komodo API is unavailable, cannot export to Sync');
            }
            const syncName = isUndefinedOrEmptyString(process.env.SYNC_NAME) ? 'komodo-import' : process.env.SYNC_NAME;
            logger.info(`Using '${syncName}' as Sync Name`);

            let syncId: string;
            let existingBehaviorVal = process.env.EXISTING_SYNC ?? 'append';
            let existingBehavior: ExistingSyncBehavior;
            let existingSync: Types.ResourceSync;

            try {
                existingSync = await komodo.api.read('GetResourceSync', {
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
                if (asKomodoApiErrorResponse(e)) {
                    if (e.result.error.toLocaleLowerCase().includes('did not find any resourcesync matching')) {
                        logger.verbose(`No Sync named ${syncName} exists, creating a new one.`);
                    } else {
                        const ke = new KomodoApiError(e);
                        throw new Error('Unexpected error from Komodo API while checking for existing Sync', { cause: ke });
                    }
                } else {
                    throw new Error('Unexpected error while trying to check for existing Sync', { cause: e });
                }
            }


            try {


                if (syncId === undefined) {
                    logger.debug('Trying to create Sync via API...');
                    const sync = await komodo.api.write('CreateResourceSync', {
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
                        logger.debug('Trying to overwrite existing Sync via API...');
                        const sync = await komodo.api.write('UpdateResourceSync', {
                            id: syncId,
                            config: {
                                include_resources: true,
                                file_contents: toml
                            }
                        });
                        logger.info('Resource Sync overwritten.');
                    } else {
                        logger.debug('Trying to append to existing Sync via API...');
                        const time = dayjs().format('YYYY-MM-DD--HH-mm-ss');
                        const sync = await komodo.api.write('UpdateResourceSync', {
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
            } catch (e) {
                if (asKomodoApiErrorResponse(e)) {
                    throw new Error('Unexpected error from Komodo API while writing Sync', { cause: new KomodoApiError(e) });
                } else {
                    throw new Error('Unexpected error while trying to write to Sync', { cause: e });
                }
            }

            const syncUrl = path.join(komodo.urlData.url.toString(), 'resource-syncs', syncId);

            logger.info(`Resource Sync URL: ${syncUrl}`);
        }
        catch (e) {
            throw new Error(`Error occurred while trying to export to Resource Sync`, { cause: e });
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