import { Logger } from "@foxxmd/logging";
import { KomodoApi } from "../KomodoApi.js";

let api: KomodoApi;

export const getDefaultKomodoApi = (logger?: Logger) => {
    if(api !== undefined) {
        return api;
    } else {
        api = new KomodoApi(logger);
    }
    return api;
}