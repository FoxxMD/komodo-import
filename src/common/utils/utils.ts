import { searchAndReplace } from "@foxxmd/regex-buddy-core";
import { stripIndents } from "common-tags";
import path, {sep} from 'path';

export const isDebugMode = (): boolean => process.env.DEBUG_MODE === 'true';

export function parseBool(value: any, prev: any = false): boolean {
    let usedVal = value;
    if (value === undefined || value === '') {
        usedVal = prev;
    }
    if(usedVal === undefined || usedVal === '') {
        return false;
    }
    if (typeof usedVal === 'string') {
        return ['1','true','yes'].includes(usedVal.toLocaleLowerCase().trim());
    } else if (typeof usedVal === 'boolean') {
        return usedVal;
    }
    throw new Error(`'${value.toString()}' is not a boolean value.`);
}

export const removeUndefinedKeys = <T extends Record<string, any>>(obj: T): T | undefined => {
    const newObj: any = {};
    Object.keys(obj).forEach((key) => {
        if(Array.isArray(obj[key])) {
            newObj[key] = obj[key];
        } else if (obj[key] === Object(obj[key])) {
            newObj[key] = obj[key];
        } else if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    });
    if(Object.keys(newObj).length === 0) {
        return undefined;
    }
    Object.keys(newObj).forEach(key => {
        if(newObj[key] === undefined || (null !== newObj[key] && typeof newObj[key] === 'object' && Object.keys(newObj[key]).length === 0)) {
            delete newObj[key]
        }
    });
    //Object.keys(newObj).forEach(key => newObj[key] === undefined || newObj[key] && delete newObj[key])
    return newObj;
}

export const isUndefinedOrEmptyString = (val: undefined | string): boolean => {
    if(val === undefined) {
        return true;
    }
    if(val.trim() === '') {
        return true;
    }
    return false;
}

export const formatIntoColumns = (strings: string[], numColumns: number) => {
    if (numColumns <= 0) {
        throw new Error('Number of columns must be more than 0')
    }

    const maxLength = strings.reduce((max, str) => Math.max(max, str.length), 0);
    const columnWidth = maxLength + 2; // Add some padding for readability

    let result = '';
    let row = '';

    for (let i = 0; i < strings.length; i++) {
        if ((i % numColumns) === 0 && row !== '') {
            result += row.trimEnd() + '\n';
            row = '';
        }
        row += strings[i].padEnd(columnWidth, ' ');
    }

    // Add the last row if it's not empty
    if (row !== '') {
        result += row.trimEnd();
    }

    return result;
}

const SINGLE_LINE_ENV_REGEX = new RegExp(/environment = "{1}(.+?)"{1}(?:\n|$)/gms); //new RegExp(/environment = (".+")(?:\\n|$)/g);
export const transformMultiline = (toml: string): string => {

    const transformed = toml.replaceAll(SINGLE_LINE_ENV_REGEX, (match, p1) => {
        return stripIndents`environment = """
        ${p1.replaceAll('\\n', '\n').replace(/\n$/, '')}
        """
        `.concat('\n');
    });

    return transformed;
}

export const removeRootPathSeparator = (pathStr: string): string => {
    if(pathStr.at(0) === sep) {
        return pathStr.substring(1);
    }
    return pathStr;
}