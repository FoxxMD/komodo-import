import { parseRegexSingle } from '@foxxmd/regex-buddy-core';
import { execa, Options } from 'execa';
import { dirHasGitConfig, readDirectories } from './io.js';
import { Logger } from '@foxxmd/logging';
import { GitProviderAccount, RepoListItem } from 'komodo_client/dist/types.js';
import { getDefaultKomodoApi } from './komodo.js';

/*
 * Would have preferred to use something like isomorphic-git, or another *tested* library, to get this info
 * but I could not find a library that had functionality to get the current tracked branch, the associated remote, and listed remotes???
*/


const TRACKED_BRANCH_REGEX: RegExp = new RegExp(/^## (?<branch>[^\.]+)\.\.\.(?<remote>[^\/\n\r]+)/);
export const getGitBranch = async (options: Options = {}): Promise<{ branch: string, remote: string } | undefined> => {
    try {
        const res = await execa({ cwd: process.cwd(), ...options })`git status -sb`;
        const regResult = parseRegexSingle(TRACKED_BRANCH_REGEX, res.stdout as string);
        if (regResult === undefined) {
            return undefined;
        }
        return {
            branch: regResult.named.branch,
            remote: regResult.named.remote
        }
    } catch (e) {
        if (e.stderr !== undefined && (e.stderr as string).includes('not a git repository')) {
            return undefined;
        }
        throw new Error(`Unexpected error occured while trying to get git branch with command ${e.command}`, { cause: e });
    }
}

export interface RemoteInfo {
    remote: string,
    url: string,
    type: string
}

const REMOTE_REGEX: RegExp = new RegExp(/^(?<remote>\S+)\s+(?<url>\S+)\s+\((?<type>\w+)\)/);
export const listRemotes = async (options: Options = {}): Promise<RemoteInfo[] | undefined> => {
    try {
        const res = await execa({ cwd: process.cwd(), ...options })`git remote -v`;
        const out = res.stdout as string;
        if (out.trim() === '') {
            return undefined;
        }
        const remoteLine = out.split('\n');
        let remotes: RemoteInfo[] = [];
        for (const r of remoteLine) {
            const regResult = parseRegexSingle(REMOTE_REGEX, r);
            if (regResult !== undefined) {
                remotes.push(
                    {
                        url: regResult.named.url,
                        remote: regResult.named.remote,
                        type: regResult.named.type
                    }
                );
            }
        }
        return remotes;
    } catch (e) {
        if (e.stderr !== undefined && (e.stderr as string).includes('not a git repository')) {
            return undefined;
        }
        throw new Error(`Unexpected error occured while trying to get git branch with command ${e.command}`, { cause: e });
    }
}

export const matchRemote = async (remote: string, options: Options = {}): Promise<RemoteInfo | undefined> => {
    let remotes: RemoteInfo[];

    try {
        remotes = await listRemotes(options);
        if (remotes === undefined || remotes.length === 0) {
            return undefined;
        }
        let matchedRemote: RemoteInfo | undefined;
        // prefer fetch
        matchedRemote = remotes.find(x => x.remote === remote && x.type === 'fetch');
        if(matchedRemote === undefined) {
            matchedRemote = remotes.find(x => x.remote === remote && x.type === 'push');
        }
        return matchedRemote;
    } catch (e) {
        throw e;
    }
}

export const detectGitRepo = async (path: string, logger: Logger): Promise<[string, RemoteInfo] | undefined> => {

    const hasGit = dirHasGitConfig(await readDirectories(path));
    if(!hasGit) {
        return undefined;
    }
    logger.verbose('Detected path has .git folder, trying to parse as git-based stack...');

    let branchData: Awaited<ReturnType<typeof getGitBranch>>;
    let remote: Awaited<ReturnType<typeof matchRemote>>;


    try {
        branchData = await getGitBranch({cwd: path});
        if(branchData === undefined) {
            logger.warn('The tracked branch does not have a remote branch! Will fallback to files-on-server mode');
            return undefined;
        }
        remote = await matchRemote(branchData.remote);
        if(remote === undefined) {
            logger.warn(`No remote '${branchData.remote}' found for tracked branch '${branchData.branch}?? Will fallback to files-on-server mode`);
            return undefined;
        }
        return [branchData.branch, remote];
    } catch (e) {
        throw new Error(`Detected path ${path} contains .git folder but error occurred while getting git info`, {cause: e});
    }
}

export const komodoRepoFromRemoteAndDomain = (domain: string, remote: string): string | undefined => {
    const broken = remote.split(domain);
    if(broken.length < 2) {
        return undefined;
    }
    return broken[1].replace('.git', '');
}

export const matchGitDataWithKomodo = async (gitData: Awaited<ReturnType<typeof detectGitRepo>>): Promise<[GitProviderAccount?, RepoListItem?, string?]> => {
    const repos = await getDefaultKomodoApi().getRepos();

    let provider: GitProviderAccount;
    let repo: RepoListItem;
    let repoHint: string = 'No existing Komodo Repo resource matches the remote';

    const validRepos = repos.filter(x => gitData[1].url.includes(x.info.repo) && gitData[1].url.includes(x.info.git_provider));
    if (validRepos.length !== 0) {
        const branchAndRepo = validRepos.find(x => x.info.branch === gitData[0]);
        if (branchAndRepo === undefined) {
            repoHint = 'There are existing Komodo Repo resource that match the remote but none have a matching branch';
        } else {
            repo = branchAndRepo;
            repoHint = undefined;
        }
    }

    const providers = await getDefaultKomodoApi().getGitProviders();
    const validProvider = providers.find(x => gitData[1].url.includes(x.domain));
    if (validProvider === undefined) {
        // default provider, we don't need to find an added one
        if (!gitData[1].url.includes('github.com')) {
            throw new Error(`No existing Komodo Git Account provider that matches remote ${gitData[1].url} exists.`);
        }
    } else {
        provider = validProvider;
    }
    return [provider, repo, repoHint];
}