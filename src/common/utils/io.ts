import { accessSync, constants, promises } from "fs";
import pathUtil, { join, dirname } from "path";
import { glob, GlobOptionsWithFileTypesUnset } from 'glob';
import clone from 'clone';
import { DEFAULT_GLOB_FOLDER, DirectoryConfig, DirectoryConfigValues } from "../infrastructure/atomic.js";
import { parseBool } from "./utils.js";

export async function writeFile(path: any, text: any) {
    try {
        await promises.writeFile(path, text, 'utf8');
    } catch (e) {
        throw e;
    }
}

export const pathExistsAndIsReadable = (location: string) => {
    const pathInfo = pathUtil.parse(location);
    const isDir = pathInfo.ext === '';
    try {
        accessSync(location, constants.R_OK);
        return true;
    } catch (err: any) {
        const { code } = err;
        if (code === 'ENOENT') {
            throw new Error(`No ${isDir ? 'directory' : 'file'} exists at ${location}`);
        } else if (code === 'EACCES') {
            throw new Error(`${isDir ? 'Directory' : 'File'} exists at ${location} but application does not have permission to read it.`);
        } else {
            throw new Error(`${isDir ? 'Directory' : 'File'} exists at ${location} but application is unable to access it due to a system error`, { cause: err });
        }
    }
}


export const fileOrDirectoryIsWriteable = (location: string) => {
    const pathInfo = pathUtil.parse(location);
    const isDir = pathInfo.ext === '';
    try {
        accessSync(location, constants.R_OK | constants.W_OK);
        return true;
    } catch (err: any) {
        const { code } = err;
        if (code === 'ENOENT') {
            // file doesn't exist, see if we can write to directory in which case we are good
            try {
                accessSync(pathInfo.dir, constants.R_OK | constants.W_OK)
                // we can write to dir
                return true;
            } catch (accessError: any) {
                if (accessError.code === 'EACCES') {
                    // also can't access directory :(
                    throw new Error(`No ${isDir ? 'directory' : 'file'} exists at ${location} and application does not have permission to write to the parent directory`);
                } else {
                    throw new Error(`No ${isDir ? 'directory' : 'file'} exists at ${location} and application is unable to access the parent directory due to a system error`, { cause: accessError });
                }
            }
        } else if (code === 'EACCES') {
            throw new Error(`${isDir ? 'Directory' : 'File'} exists at ${location} but application does not have permission to write to it.`);
        } else {
            throw new Error(`${isDir ? 'Directory' : 'File'} exists at ${location} but application is unable to access it due to a system error`, { cause: err });
        }
    }
}

export async function readText(path: any) {
    await promises.access(path, constants.R_OK);
    const data = await promises.readFile(path);
    return data.toString();
}

export const findFilesRecurive = async (filePattern: string, fromDir: string, options: GlobOptionsWithFileTypesUnset = {}): Promise<string[]> => {
    try {
        return await glob(filePattern, {
            cwd: fromDir,
            nodir: true,
            ...options
        });
    } catch (e) {
        throw new Error(`Error occurred while trying to find files for pattern ${filePattern}`, { cause: e });
    }
}

export const findPathRecuriveParently = async (fromDir: string, path: string) => {

    let currDirectory = fromDir;
    let parentDirectory = fromDir;
    let firstRun = true;

    // https://hals.app/blog/recursively-read-parent-folder-nodejs/
    while (firstRun || currDirectory !== parentDirectory) {

        firstRun = false;

        const files = await glob(path, {
            cwd: parentDirectory,
        });

        if(files.length > 0) {
            return join(parentDirectory, path);
        }

        // The trick is here:
        // Using path.dirname() of a directory returns the parent directory!
        currDirectory = parentDirectory
        parentDirectory = dirname(parentDirectory);
    }

    return undefined;
}

export const sortComposePaths = (p: string[]): string[] => {
    const paths = clone(p);
    paths.sort((a, b) => {
        const aPathDepth = a.split(pathUtil.sep).length;
        const bPathDepth = b.split(pathUtil.sep).length;
        if (aPathDepth !== bPathDepth) {
            return aPathDepth - bPathDepth;
        }
        const patha = pathUtil.parse(a);
        const pathb = pathUtil.parse(b);
        // always sort `compose` ahead of `docker-compose`
        if (!patha.name.includes('docker') && pathb.name.includes('docker')) {
            return -1;
        }
        if (patha.name.includes('docker') && !pathb.name.includes('docker')) {
            return 1;
        }
        // otherwise sort by shortest name
        if (patha.name.length < pathb.name.length) {
            return -1;
        }
        return 1;
    });
    return paths;
}

export interface ReadDirectoryOptions {
    hidden?: boolean
}
export const readDirectories = async (path: string, options: ReadDirectoryOptions = {}): Promise<string[]> => {
    const {hidden = false} = options
    try {
        const directories = (await promises.readdir(path, { withFileTypes: true }))
            .filter(dirent => {
                if(!dirent.isDirectory()) {
                    return false;
                }
                if(!hidden && dirent.name[0] === '.') {
                    return false;
                }
                return true;
            })
            .map(dir => dir.name);
        return directories;
    } catch (e) {
        throw new Error(`Could not read folders at dir ${path}`);
    }
}

export const findFolders = async (fromDir: string, filePattern: string = DEFAULT_GLOB_FOLDER, ignore?: string): Promise<string[]> => {
    try {
        const res = await glob(filePattern, {
            cwd: fromDir,
            nodir: false,
            withFileTypes: true,
            ignore
        });
        return res.filter(x => x.isDirectory()).map(x => x.name);
    } catch (e) {
        throw new Error(`Error occurred while trying to find files for pattern ${filePattern}`, { cause: e });
    }
}

export const dirHasGitConfig = (paths: string[]): boolean => {
    return paths.some(x => x === '.git');
}

export const parseDirectoryConfig = async (dirConfig: DirectoryConfigValues = {}): Promise<[DirectoryConfigValues, DirectoryConfig]> => {
    const {
        mountVal = process.env.MOUNT_DIR,
        hostVal = process.env.HOST_DIR ?? mountVal,
        scanVal = process.env.SCAN_DIR ?? mountVal
    } = dirConfig;

    const configVal = {
        mountVal,
        hostVal,
        scanVal
    };

    let mountDir: string,
        hostDir: string,
        scanDir: string;

    try {
        mountDir = await promises.realpath(mountVal);
        pathExistsAndIsReadable(mountDir)
    } catch (e) {
        throw new Error(`Could not access directory for MOUNT_DIR ${mountVal}.${parseBool(process.env.IS_DOCKER) ? ' This is the path *in container* that is read so make sure you have mounted it on the host!' : ''}`);
    }

    if (hostVal === mountVal) {
        hostDir = mountDir;
    } else {
        hostDir = hostVal;
    }

    if (scanVal === mountVal) {
        scanDir = mountDir;
    } else {
        try {
            scanDir = await promises.realpath(join(mountDir, scanVal));
            pathExistsAndIsReadable(scanDir)
        } catch (e) {
            throw new Error(`Could not access directory for SCAN_DIR '${scanVal}' -- this should be the *relative* path from HOST_DIR that we look for stack-folders in.`);
        }
    }

    return [configVal, { host: hostDir, scan: scanDir, mount: mountDir }]
}