import { Logger } from "@foxxmd/logging";
import { KomodoApi } from "../KomodoApi.js";
import { SimpleError } from "../errors.js";

let api: KomodoApi;
let init = false;

export const getDefaultKomodoApi = (logger?: Logger) => {
    if(init) {
        return api;
    }
    if(api !== undefined) {
        return api;
    } else {
        const maybeApi = new KomodoApi(logger);
        try {
            maybeApi.init();
            api = maybeApi;
        } catch (e) {
            if(e instanceof SimpleError) {
                maybeApi.logger.warn(`Komodo Client unavailable: ${e.message}`)
            } else {
                maybeApi.logger.warn(new Error('Komodo Client unavailable', {cause: e}));
            }
        } finally {
            init = true;
        }
    }
    return api;
}