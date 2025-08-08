import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import { sortComposePaths } from '../src/common/utils/io.js';

describe('#Utils', function () {

    describe('Compose File Sorting', function () {

        it('Sorts compose files before docker-compose', function () {
            const data = [
                'docker-compose.test.yaml',
                'docker-compose.yaml',
                'compose.yaml'
            ];

            const sorted = sortComposePaths(data)

            expect(sorted[0]).eq(data[2]);
        });

        it('Sorts by shortest path', function () {
            const sorted = sortComposePaths([
                '/docker/nested/docker-compose.test.yaml',
                'docker-compose.yaml',
                '/docker/compose.yaml'
            ])

            expect(sorted).eql([
                'docker-compose.yaml',
                '/docker/compose.yaml',
                '/docker/nested/docker-compose.test.yaml',
            ]);
        });

        it('Sorts by shortest name', function () {
            const data = [[
                'docker-compose.dev.yaml',
                'docker-compose.yaml'
            ], [
                'compose.dev.yaml',
                'compose.yaml'
            ]];
            for (const d of data) {
                const sorted = sortComposePaths(d)

                expect(sorted[0]).eq(d[1]);
            }
        });

    });

});