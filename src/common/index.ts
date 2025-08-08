import * as path from 'path';
import { getVersion } from "@foxxmd/get-version";

export const projectDir = process.cwd();
export const configDir: string = path.resolve(projectDir, './config');

export let version: string = 'unknown';

export const parseVersion = async () => {
    version = await getVersion({priority: ['env', 'git', 'file']});
}