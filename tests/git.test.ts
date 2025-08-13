import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import { detectGitRepo, parseGitStatus } from '../src/common/utils/git.js';
import { stripIndents } from 'common-tags';
import withLocalTmpDir from 'with-local-tmp-dir';
import { mkdir, writeFile, chmod, constants } from 'node:fs/promises';
import path from "path";
import { buildGitStack, BuildGitStackOptions } from '../src/builders/stack/gitStack.js';
import { loggerTest } from "@foxxmd/logging";
import chaiAsPromised from 'chai-as-promised';
import git from 'isomorphic-git';
import fs from 'fs';
import { execa, Options } from 'execa';

chai.use(chaiAsPromised);

const DEFAULT_SERVER = 'test-server';

const defaultGitStandaloneConfig: BuildGitStackOptions = {
    server: DEFAULT_SERVER,
    logger: loggerTest
}

describe('#Git', function () {

    describe('#GitStatus Parsing', function () {
        it('detects no commits as no branch/remote', function () {

            expect(parseGitStatus('## No commits yet on master')).to.eql({
                raw: '## No commits yet on master'
            });

        });

        it('detects HEAD as branch but no remote', function () {
            const headOutput = stripIndents`## HEAD (no branch)
            ?? somefile/`;

            const parsed = parseGitStatus(headOutput);

            expect(parsed.branch).to.eq('HEAD');
            expect(parsed.remote).is.undefined;
        });

        it('detects branch with remote', function () {

            const outputs = [
                {
                    out: '## main...origin/main',
                    expect: {
                        branch: 'main',
                        remote: 'origin',
                        remoteBranch: 'main'
                    }
                },
                {
                    out: '## 3.18...origin/3.18',
                    expect: {
                        branch: '3.18',
                        remote: 'origin',
                        remoteBranch: '3.18'
                    }
                }
            ]

            for (const o of outputs) {
                const parsed = parseGitStatus(o.out);

                expect(parsed.branch).to.eq(o.expect.branch);
                expect(parsed.remote).to.eq(o.expect.remote);
                expect(parsed.remoteBranch).to.eq(o.expect.remoteBranch);
            }


        });

        it('detects local branch with different name than remote', function () {
            const output = stripIndents`## main-mine...origin/main`;

            const parsed = parseGitStatus(output);

            expect(parsed.branch).to.eq('main-mine');
            expect(parsed.remote).to.eq('origin');
            expect(parsed.remoteBranch).to.eq('main');
        });

        it('detects local branch with no remote', function () {

            const output = stripIndents`## temp-fix`;

            const parsed = parseGitStatus(output);

            expect(parsed.branch).to.eq('temp-fix');
            expect(parsed.remote).to.be.undefined;
        });

        it('does not add extraneous status to remote branch', function () {

            const checks = [
                '## main-mine...origin/main [behind 3]',
                '## main-mine...origin/main [ahead 1]'
            ]

            for (const c of checks) {

                const parsed = parseGitStatus(c);

                expect(parsed.branch).to.eq('main-mine');
                expect(parsed.remote).to.eq('origin');
                expect(parsed.remoteBranch).to.eq('main');
            }

        });
    });

    describe('#GitStack', function () {

        it(`detects as not a git repo when no .git folder is present`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');

                await mkdir(dir);
                await expect(detectGitRepo(dir)).to.eventually.be.rejected;
            }, { unsafeCleanup: true });
        });

        it(`detects as not a git repo when .git folder is ill-defined`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir, { recursive: true });
                await mkdir(path.join(dir, '.git'))
                await expect(detectGitRepo(dir)).to.eventually.be.rejected;
            }, { unsafeCleanup: true });
        });

        it(`detects as not a suitable git repo when no tracked branch`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir, { recursive: true });
                await git.init({ fs, dir });
                await expect(detectGitRepo(dir)).to.eventually.be.rejectedWith(/Could not determine tracked branch/);
            }, { unsafeCleanup: true });
        });

        it(`detects as not a suitable git repo when no remote repository`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir, { recursive: true });
                await git.init({ fs, dir });
                await git.commit({
                    fs,
                    dir: dir,
                    author: {
                        name: 'Mr. Test',
                        email: 'mrtest@example.com',
                    },
                    message: 'Added the a.txt file'
                });
                await expect(detectGitRepo(dir)).to.eventually.be.rejectedWith(/Could not parse remote branch/);
            }, { unsafeCleanup: true });
        });

        it(`detects as not a suitable git repo when tracked branch does not have a remote`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir);
                const localDir = path.join(dir, 'local');
                await mkdir(localDir);
                const remoteDir = path.join(dir, 'remote');
                await mkdir(remoteDir);
                await git.init({ fs, dir: localDir });
                await git.commit({
                    fs,
                    dir: localDir,
                    author: {
                        name: 'Mr. Test',
                        email: 'mrtest@example.com',
                    },
                    message: 'Added the a.txt file'
                });
                await git.init({ fs, dir: remoteDir });
                await git.addRemote({
                    fs,
                    remote: 'origin',
                    url: '../remote',
                    dir: remoteDir
                });
                await expect(detectGitRepo(localDir)).to.eventually.be.rejectedWith(/Could not parse remote branch/);
            }, { unsafeCleanup: true });
        });

         it(`detects as a suitable git repo when tracked branch has a remote`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir);
                const localDir = path.join(dir, 'local');
                //await mkdir(localDir);
                const remoteDir = path.join(dir, 'remote');
                await mkdir(remoteDir);
                await git.init({ fs, dir: remoteDir });
                await git.commit({
                    fs,
                    dir: remoteDir,
                    author: {
                        name: 'Mr. Test',
                        email: 'mrtest@example.com',
                    },
                    message: 'Added the a.txt file'
                });
                // cannot yet clone local repo with isomorphic git
                // https://github.com/isomorphic-git/isomorphic-git/issues/1263
                await execa({cwd: dir})`git clone remote local`
                await expect(detectGitRepo(localDir)).to.eventually.be.fulfilled;
            }, { unsafeCleanup: true });
        });
    });
});