import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import withLocalTmpDir from 'with-local-tmp-dir';
import { mkdir, writeFile, chmod, constants } from 'node:fs/promises';
import path from "path";
import { loggerTest } from "@foxxmd/logging";
import { buildFileStack, BuildFileStackOptions } from '../src/builders/stack/filesOnServer.js';
import { FilesOnServerConfig } from '../src/common/infrastructure/config/stackConfig.js';
import { stripIndents } from 'common-tags';

const DEFAULT_FOS_PATH = '/my/cool'
const DEFAULT_SERVER = 'test-server';

const defaultFOSConfig: BuildFileStackOptions = {
    server: DEFAULT_SERVER,
    hostParentPath: DEFAULT_FOS_PATH,
    logger: loggerTest,
    komodoEnvName: '.komodoEnv',
}

describe('#FilesOnServer', function () {

    it(`sets server`, async function () {
        await withLocalTmpDir(async () => {
            const dir = path.join(process.cwd(), 'test_1');

            await mkdir(dir);
            const data = await buildFileStack(dir, defaultFOSConfig);

            expect(data.config.server).eq(DEFAULT_SERVER);
        }, { unsafeCleanup: true });
    });

    it(`sets run_directory from hostParentPath`, async function () {
        await withLocalTmpDir(async () => {
            const dir = path.join(process.cwd(), 'test_1');

            await mkdir(dir);
            const data = await buildFileStack(dir, defaultFOSConfig);

            expect(data.config.run_directory).eq(path.join(defaultFOSConfig.hostParentPath, 'test_1'));
        }, { unsafeCleanup: true });
    });

    describe('Compose Files', function () {

        it(`does not include file_paths when no compose file found`, async function () {
            await withLocalTmpDir(async () => {
                const dir = path.join(process.cwd(), 'test_1');

                await mkdir(dir);
                const data = await buildFileStack(dir, defaultFOSConfig);

                expect(data.config.file_paths).to.be.undefined;
            }, { unsafeCleanup: true });
        });

        it(`includes compose file when one is found`, async function () {
            await withLocalTmpDir(async () => {

                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir);
                const fileName = 'docker-compose.yaml';
                await writeFile(path.join(dir, fileName), '');

                const data = await buildFileStack(dir, defaultFOSConfig);

                expect(data.config.file_paths).to.not.be.undefined;
                expect(data.config.file_paths.length).eq(1);
                expect(data.config.file_paths[0]).eq(fileName)

            }, { unsafeCleanup: true });
        });

        it(`does not use file_paths if only one compose file selected and it is named 'compose.yaml'`, async function () {
            await withLocalTmpDir(async () => {

                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir);
                const fileName = 'compose.yaml';
                await writeFile(path.join(dir, fileName), '');
                await mkdir(path.join(dir, 'nested'));
                await writeFile(path.join(dir, 'nested', fileName), '');

                const data = await buildFileStack(dir, defaultFOSConfig);

                expect(data.config.file_paths).to.be.undefined;
            }, { unsafeCleanup: true });
        });

        it(`includes only one compose file when using default glob`, async function () {
            await withLocalTmpDir(async () => {

                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir);
                await writeFile(path.join(dir, 'docker-compose.yaml'), '');
                await writeFile(path.join(dir, 'compose.prod.yaml'), '');

                const data = await buildFileStack(dir, { ...defaultFOSConfig });

                expect(data.config.file_paths).to.not.be.undefined;
                expect(data.config.file_paths.length).eq(1);
            }, { unsafeCleanup: true });
        });

        it(`includes all compose files when using non-default glob`, async function () {
            await withLocalTmpDir(async () => {

                const dir = path.join(process.cwd(), 'test_1');
                await mkdir(dir);
                await writeFile(path.join(dir, 'docker-compose.yaml'), '');
                await writeFile(path.join(dir, 'compose.prod.yaml'), '');

                const data = await buildFileStack(dir, { ...defaultFOSConfig, composeFileGlob: '**/{compose,docker-compose}*.yaml' });

                expect(data.config.file_paths).to.not.be.undefined;
                expect(data.config.file_paths.length).eq(2);
            }, { unsafeCleanup: true });
        });

    });

});
