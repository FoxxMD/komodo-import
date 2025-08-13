import { childLogger, Logger } from "@foxxmd/logging";
import { KomodoClient, Types } from "komodo_client";
import { isUndefinedOrEmptyString } from "./utils/utils.js";
import { normalizeWebAddress } from "./utils/network.js";
import { ListGitProviderAccountsResponse, ListReposResponse } from "komodo_client/dist/types.js";
import { initLogger } from "./logging.js";

export interface KomodoApiOptions {
    url?: string
    key?: string
    secret?: string
}

export class KomodoApi {
    options: KomodoApiOptions;
    api: ReturnType<typeof KomodoClient>
    logger: Logger;

    cachedRepos?: ListReposResponse;
    cachedGitProviders?: ListGitProviderAccountsResponse;

    constructor(logger?: Logger, options?: KomodoApiOptions) {
        this.logger = childLogger(logger ?? initLogger()[0], 'Komodo API');
        this.options = options;
    }

    init = () => {
        if (this.api === undefined) {
            if (isUndefinedOrEmptyString(process.env.API_KEY)) {
                throw new Error(`Cannot use Komodo API because env API_KEY is missing`);
                return;
            }
            if (isUndefinedOrEmptyString(process.env.API_SECRET)) {
                throw new Error(`Cannot use Komodo API because env API_SECRET is missing`);
                return;
            }
            if (isUndefinedOrEmptyString(process.env.KOMODO_URL)) {
                throw new Error(`Cannot use Komodo API because env KOMODO_URL is missing`);
            }
            const urlData = normalizeWebAddress(process.env.KOMODO_URL);
            this.logger.verbose(`KOMODO_URL: ${process.env.KOMODO_URL} | Normalized: ${urlData.url.toString()}`);

            this.api = KomodoClient(urlData.url.toString(), {
                type: "api-key",
                params: {
                    key: process.env.API_KEY,
                    secret: process.env.API_SECRET
                },
            });
        }
    }

    getRepos = async () => {
        this.init();
        if(this.cachedRepos === undefined) {
            this.cachedRepos = await this.api.read('ListRepos', {});
        }
        
        return this.cachedRepos;
    }

    getGitProviders = async () => {
        this.init();
        if(this.cachedGitProviders === undefined) {
            this.cachedGitProviders = await this.api.read('ListGitProviderAccounts', {});
            // res[0].domain = 'git.foxxmd.io'
        }
        
        return this.cachedGitProviders;
    }
}