import { __Serror } from "komodo_client/dist/types.js";

export class SimpleError extends Error {
    
}

export class KomodoApiError extends Error {

    constructor(e: KomodoApiErrorResponse) {
        super(`(HTTP ${e.status}) ${e.result.error}`);
        this.name = 'KomodoApiError';
        if(e.error !== undefined) {
            this.cause = e.error;
        }
        let kTrace: string;
        if(e.result.trace.length > 0) {
            kTrace = `${e.result.trace.join('\n')}`
        } else {
            kTrace = '(No trace returned from Komodo)'
        }
        this.stack = `${this.stack ?? ''}\nKomodo Trace: ${kTrace}`;
    }
}

export type KomodoResultError = __Serror;

export const asKomodoResultError = (e: any): e is KomodoResultError => {
    return e !== null 
    && typeof e === 'object'
    && 'error' in e
    && typeof e.error === 'string'
    && 'trace' in e
    && Array.isArray(e.trace);
}

export interface KomodoApiErrorResponse {
    result: KomodoResultError
    status: number
    error?: Error
}

export const asKomodoApiErrorResponse = (e: any): e is KomodoApiErrorResponse => {
    return e !== null 
    && typeof e === 'object'
    && 'result' in e
    && asKomodoResultError(e.result)
    && 'status' in e
    && typeof e.status === 'number'
    && (
        !('error' in e)
        ||
        ('error' in e && e.error instanceof Error)
    );
}