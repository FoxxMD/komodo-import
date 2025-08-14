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
import { DEFAULT_KOMODO_ENV_NAME, parseEnvConfig } from '../src/builders/stack/stackUtils.js';

chai.use(chaiAsPromised);

const DEFAULT_SERVER = 'test-server';

const defaultGitStandaloneConfig: BuildGitStackOptions = {
    server: DEFAULT_SERVER,
    logger: loggerTest
}

describe('#StackCommon', function () {

    describe('#EnvironmentParsing', function () {

        it(`does not include additional_env_files when no env files found`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');

                await mkdir(dir);
                const data = await parseEnvConfig(dir, { logger: loggerTest });

                expect(data.additional_env_files).to.be.undefined;
            }, { unsafeCleanup: true });
        });

        it(`includes additional_env_files when env files found`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');

                await mkdir(dir);
                await writeFile(path.join(dir, '.env'), '');
                await mkdir(path.join(dir, 'nested'));
                await writeFile(path.join(dir, 'nested', 'additional.env'), '');
                const data = await parseEnvConfig(dir, { logger: loggerTest });

                expect(data.additional_env_files).to.not.be.undefined;
                expect(data.additional_env_files.length).eq(2);
                expect(data.additional_env_files[0]).eq('.env');
                expect(data.additional_env_files[1]).eq('nested/additional.env');
            }, { unsafeCleanup: true });
        });

        it(`uses pathPrefix for additional_env_files`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');

                await mkdir(dir);
                await writeFile(path.join(dir, '.env'), '');
                const data = await parseEnvConfig(dir, { logger: loggerTest, pathPrefix: '/mytest' });

                expect(data.additional_env_files).to.not.be.undefined;
                expect(data.additional_env_files.length).eq(1);
                expect(data.additional_env_files[0]).eq('/mytest/.env');
            }, { unsafeCleanup: true });
        });

        it(`uses komodo env name when files found includes .env`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');

                await mkdir(dir);
                await writeFile(path.join(dir, '.env'), '');
                const data = await parseEnvConfig(dir, { logger: loggerTest });

                expect(data.env_file_path).eq(DEFAULT_KOMODO_ENV_NAME)
            }, { unsafeCleanup: true });
        });

        describe('When writeEnv is true', function () {

            it(`writes env contents`, async function () {
                await withLocalTmpDir(async () => {
                    const dir = path.join(process.cwd(), 'test_1');

                    await mkdir(dir);
                    await writeFile(path.join(dir, '.env'), stripIndents`MY_1ENV=foo
                MY_2ENV=bar`);
                    const data = await parseEnvConfig(dir, { logger: loggerTest, writeEnv: true });

                    expect(data.env_file_path).to.be.undefined;
                    expect(data.environment).to.eq(`MY_1ENV=foo\nMY_2ENV=bar`)

                }, { unsafeCleanup: true });
            });

            it(`writes multiple env contents`, async function () {
                await withLocalTmpDir(async () => {
                    const dir = path.join(process.cwd(), 'test_1');

                    await mkdir(dir);
                    await writeFile(path.join(dir, '.env'), stripIndents`MY_1ENV=foo
                MY_2ENV=bar`);
                    await writeFile(path.join(dir, 'additional.env'), stripIndents`MY_3ENV=foo
                MY_4ENV=bar`);
                    const data = await parseEnvConfig(dir, { logger: loggerTest, writeEnv: true });

                    expect(data.env_file_path).to.be.undefined;
                    expect(data.environment).to.eq(`MY_3ENV=foo\nMY_4ENV=bar\nMY_1ENV=foo\nMY_2ENV=bar`)

                }, { unsafeCleanup: true });
            });

        });

    });
});