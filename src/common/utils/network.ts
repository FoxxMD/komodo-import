import {join as joinPath} from 'path';
import { parseRegexSingle } from "@foxxmd/regex-buddy-core";
import normalizeUrl from "normalize-url";
import { URLData } from '../infrastructure/atomic.js';

export const joinedUrl = (url: URL, ...paths: string[]): URL => {
    // https://github.com/jfromaniello/url-join#in-nodejs
    const finalUrl = new URL(url);
    finalUrl.pathname = joinPath(url.pathname, ...(paths.filter(x => x.trim() !== '')));
    return finalUrl;
}

const QUOTES_UNWRAP_REGEX: RegExp = new RegExp(/^"(.*)"$/);

export const normalizeWebAddress = (val: string, options: {defaultPath?: string} = {}): URLData => {
    let cleanUserUrl = val.trim();
    const results = parseRegexSingle(QUOTES_UNWRAP_REGEX, val);
    if (results !== undefined && results.groups && results.groups.length > 0) {
        cleanUserUrl = results.groups[0];
    }

    const {defaultPath} = options;

    let normal = normalizeUrl(cleanUserUrl, {removeTrailingSlash: true});
    const u = new URL(normal);
    let port: number;

    if (u.port === '') {
        port = u.protocol === 'https:' ? 443 : 80;
    } else {
        port = parseInt(u.port);
        // if user val does not include protocol and port is 443 then auto set to https
        if(port === 443 && !val.includes('http')) {
            if(u.protocol === 'http:') {
                u.protocol = 'https:';
            }
            normal = normal.replace('http:', 'https:');
        }
    }

    if(u.pathname === '/' && defaultPath !== undefined) {
        u.pathname = defaultPath;
        normal = normalizeUrl(u.toString());
    }

    return {
        url: u,
        normal,
        port
    }
}