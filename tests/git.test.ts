import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import { parseGitStatus } from '../src/common/utils/git.js';
import { stripIndents } from 'common-tags';

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

            for(const o of outputs) {
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
});