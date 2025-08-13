import { parseRegexSingle } from '@foxxmd/regex-buddy-core';
import { execa, Options } from 'execa';
import { dirHasGitConfig, readDirectories } from './io.js';
import { Logger } from '@foxxmd/logging';
import { GitProviderAccount, RepoListItem } from 'komodo_client/dist/types.js';
import { getDefaultKomodoApi } from './komodo.js';
import { GitBranchStatus } from '../infrastructure/atomic.js';
import { isDebugMode } from './utils.js';

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

export const detectGitRepo = async (path: string, logger: Logger): Promise<[string, RemoteInfo] | undefined> => {

    const hasGit = dirHasGitConfig(await readDirectories(path));
    if (!hasGit) {
        return undefined;
    }
    logger.verbose('Detected path has .git folder, trying to parse as git-based stack...');

    let branchData: Awaited<ReturnType<typeof getGitBranch>>;
    let remote: Awaited<ReturnType<typeof matchRemote>>;


    try {
        branchData = await getGitBranch({ cwd: path });
        if (isDebugMode()) {
            logger.debug(`git status -sb => ${branchData.raw}`);
        }

        if (branchData.branch === undefined && branchData.remote === undefined) {
            logger.debug(`Could not determine tracked branch | Raw Output: ${branchData.raw.split('\n')[0]}`);
            return undefined;
        }
        if (branchData.remote === undefined) {
            logger.debug(`Could not parse remote branch for tracked branch '${branchData.branch}' | Raw Output: ${branchData.raw.split('\n')[0]}`);
            return undefined;
        }
        remote = await matchRemote(branchData.remote, { cwd: path });
        if (remote === undefined) {
            logger.warn(`No remote '${branchData.remote}' found for tracked branch '${branchData.branch}?? Will fallback to files-on-server mode`);
            return undefined;
        }
        return [branchData.branch, remote];
    } catch (e) {
        throw new Error(`Detected path ${path} contains .git folder but error occurred while getting git info`, { cause: e });
    }
}

export const komodoRepoFromRemoteAndDomain = (domain: string, remote: string): string | undefined => {
    const broken = remote.split(domain);
    if (broken.length < 2) {
        return undefined;
    }
    let cleaned = broken[1].replace('.git', '');
    if (cleaned[0] === '/') {
        cleaned = cleaned.substring(1);
    }
    if (cleaned[cleaned.length - 1] === '/') {
        cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    return cleaned;
}

export const matchGitDataWithKomodo = async (gitData: Awaited<ReturnType<typeof detectGitRepo>>): Promise<[GitProviderAccount?, RepoListItem?, string?]> => {
    const repos = await getDefaultKomodoApi().getRepos();

    let provider: GitProviderAccount;
    let repo: RepoListItem;
    let repoHint: string = 'No Komodo Repo matches the remote';

    const validRepos = repos.filter(x => gitData[1].url.includes(x.info.repo) && gitData[1].url.includes(x.info.git_provider));
    if (validRepos.length !== 0) {
        const branchAndRepo = validRepos.find(x => x.info.branch === gitData[0]);
        if (branchAndRepo === undefined) {
            repoHint = `Komodo Repos exist but branches (${validRepos.map(x => `${x.info.branch} on ${x.name}`).join(',')}) does not match`;
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
            throw new Error(`No Komodo Git Account provider matches remote ${gitData[1].url}`);
        }
    } else {
        provider = validProvider;
    }
    return [provider, repo, repoHint];
}