import { parseRegexSingle } from '@foxxmd/regex-buddy-core';
import { execa, Options } from 'execa';
import { dirHasGitConfig, readDirectories } from './io.js';
import { Logger } from '@foxxmd/logging';
import { GitProviderAccount, RepoListItem } from 'komodo_client/dist/types.js';
import { getDefaultKomodoApi } from './komodo.js';
import { GitBranchStatus } from '../infrastructure/atomic.js';
import { isDebugMode } from './utils.js';
import { SimpleError } from '../errors.js';

/*
 * Would have preferred to use something like isomorphic-git, or another *tested* library, to get this info
 * but I could not find a library that had functionality to get the current tracked branch, the associated remote, and listed remotes???
*/

export const getGitBranch = async (options: Options = {}): Promise<GitBranchStatus> => {
    try {
        const res = await execa({ cwd: process.cwd(), ...options })`git status -sb`;
        const statusResults = parseGitStatus(res.stdout as string);
        statusResults.raw = statusResults.raw.split('\n')[0];
        return statusResults;
    } catch (e) {
        if (e.stderr !== undefined && (e.stderr as string).includes('not a git repository')) {
            return { raw: 'not a git repository' };
        }
        throw new Error(`Unexpected error occured while trying to get git branch with command ${e.command}`, { cause: e });
    }
}
// new RegExp(/^## (?<branch>[^\.\s]+)(?:\.\.\.(?<remote>[^\/\n\r]+)\/(?<remoteBranch>\S+))?/);
const TRACKED_BRANCH_REGEX: RegExp = new RegExp(/^## (?<branch>\S+)/);
const TRACKED_BRANCH_AND_REMOTE_REGEX: RegExp = new RegExp(/^## (?<branch>\S+)\.\.\.(?<remote>[^\/\n\r]+)\/(?<remoteBranch>\S+)/);
export const parseGitStatus = (output: string): GitBranchStatus => {
    if (output.includes('No commits yet')) {
        return { raw: output };
    }
    const remoteResult = parseRegexSingle(TRACKED_BRANCH_AND_REMOTE_REGEX, output);
    if (remoteResult !== undefined) {
        return {
            ...remoteResult.named,
            raw: output
        }
    }
    const localResult = parseRegexSingle(TRACKED_BRANCH_REGEX, output);
    if (localResult !== undefined) {
        return {
            ...localResult.named,
            raw: output
        }
    }

    return {
        raw: output
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
        if (matchedRemote === undefined) {
            matchedRemote = remotes.find(x => x.remote === remote && x.type === 'push');
        }
        return matchedRemote;
    } catch (e) {
        throw e;
    }
}

export type GitRepoData = [GitBranchStatus, RemoteInfo];
export const detectGitRepo = async (path: string): Promise<GitRepoData> => {

    const hasGit = dirHasGitConfig(await readDirectories(path, {hidden: true}));
    if (!hasGit) {
        throw new SimpleError('Path does not have a .git folder');
    }

    let branchData: GitBranchStatus;
    let remote: RemoteInfo;

    try {
        branchData = await getGitBranch({ cwd: path });

        if (branchData.branch === undefined && branchData.remote === undefined) {
            throw new SimpleError(`Could not determine tracked branch | Raw Output: ${branchData.raw.split('\n')[0]}`);
        }
        if (branchData.remote === undefined) {
            throw new SimpleError(`Could not parse remote branch for tracked branch '${branchData.branch}' | Raw Output: ${branchData.raw.split('\n')[0]}`);
        }
        remote = await matchRemote(branchData.remote, { cwd: path });
        if (remote === undefined) {
            throw new SimpleError(`No remote '${branchData.remote}' found for tracked branch '${branchData.branch} | Raw Output: ${branchData.raw.split('\n')[0]}`);
        }
        return [branchData, remote];
    } catch (e) {
        if(e instanceof SimpleError) {
            throw e;
        }
        throw new Error(`Detected path ${path} contains .git folder but error occurred while getting git info${branchData !== undefined ? ` | Raw Output: ${branchData.raw.split('\n')[0]}` : ''}`, { cause: e });
    }
}

const GIT_EXTENSION = new RegExp(/\.git$/);

export const komodoRepoFromRemote = (remote: string): [string, string?] => {
    const u = new URL(remote);
    const provider = u.host;
    // this shouldn't happen
    if(u.pathname === '/') {
        return [provider];
    }
    let repo: string = u.pathname.replace(GIT_EXTENSION, '');
    if (repo[0] === '/') {
        repo = repo.substring(1);
    }
    if (repo[repo.length - 1] === '/') {
        repo = repo.substring(0, repo.length - 1);
    }
    return [provider, repo];
}

export const matchGitDataWithKomodo = async (gitData: GitRepoData): Promise<[GitProviderAccount?, RepoListItem?, string?]> => {
    const repos = await getDefaultKomodoApi().getRepos();

    let provider: GitProviderAccount;
    let repo: RepoListItem;
    let repoHint: string = 'No Komodo Repo matches the remote';

    const validRepos = repos.filter(x => 
        gitData[1].url.toLocaleLowerCase().includes(x.info.repo.toLocaleLowerCase()) 
    && gitData[1].url.toLocaleLowerCase().includes(x.info.git_provider.toLocaleLowerCase()));
    if (validRepos.length !== 0) {
        const branchAndRepo = validRepos.find(x => x.info.branch.toLocaleLowerCase() === gitData[0].remoteBranch.toLocaleLowerCase());
        if (branchAndRepo === undefined) {
            repoHint = `Komodo Repos exist but branches (${validRepos.map(x => `${x.info.branch} on ${x.name}`).join(',')}) does not match`;
        } else {
            repo = branchAndRepo;
            repoHint = undefined;
        }
    }

    const providers = await getDefaultKomodoApi().getGitProviders();
    const validProvider = providers.find(x => gitData[1].url.includes(x.domain));
    if (validProvider !== undefined) {
        provider = validProvider;
    }
    return [provider, repo, repoHint];
}