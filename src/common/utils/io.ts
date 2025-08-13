import { accessSync, constants, promises } from "fs";
import pathUtil from "path";
import { glob } from 'glob';
import clone from 'clone';

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

export const findFilesRecurive = async (filePattern: string, fromDir: string): Promise<string[]> => {
    try {
        return await glob(filePattern, {
            cwd: fromDir,
            //nodir: true
        });
    } catch (e) {
        throw new Error(`Error occurred while trying to find files for pattern ${filePattern}`, { cause: e });
    }
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

export const dirHasGitConfig = (paths: string[]): boolean => {
    return paths.some(x => x === '.git');
}