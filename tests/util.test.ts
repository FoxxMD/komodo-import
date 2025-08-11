import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import { sortComposePaths } from '../src/common/utils/io.js';
import { normalizeWebAddress } from '../src/common/utils/network.js';

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

    describe('Normalizing URL', function () {

        const anIP = '192.168.0.100';

        it('Should unwrap a quoted value', function () {
            expect(normalizeWebAddress(`"${anIP}"`).url.hostname).to.eq(anIP);
        });

        it('Should normalize an IP to HTTP protocol', function () {
            expect(normalizeWebAddress(anIP).url.protocol).to.eq('http:');
        });

        it('Should normalize an IP without a port to port 80', function () {
            expect(normalizeWebAddress(anIP).port).to.eq(80);
        });

        it('Should normalize an IP to an HTTP URL', function () {
            expect(normalizeWebAddress(anIP).normal).to.eq(`http://${anIP}`);
        });

        it('Should normalize an IP with port 443 to an HTTPS URL', function () {
            expect(normalizeWebAddress(`${anIP}:443`).url.protocol).to.eq(`https:`);
            expect(normalizeWebAddress(`${anIP}:443`).url.toString()).to.include(`https:`);
            expect(normalizeWebAddress(`${anIP}:443`).normal).to.include(`https:`);
            expect(normalizeWebAddress(`${anIP}:443`).port).to.eq(443);
        });

        it('Should not normalize an IP with port 443 if protocol is specified', function () {
            expect(normalizeWebAddress(`http://${anIP}:443`).url.protocol).to.eq(`http:`);
            expect(normalizeWebAddress(`http://${anIP}:443`).url.toString()).to.include(`http:`);
            expect(normalizeWebAddress(`http://${anIP}:443`).normal).to.include(`http:`);
            expect(normalizeWebAddress(`http://${anIP}:443`).port).to.eq(443);
        });

        it('Should normalize an IP with a port and preserve port', function () {
            expect(normalizeWebAddress(`${anIP}:5000`).port).to.eq(5000);
            expect(normalizeWebAddress(`${anIP}:5000`).normal).to.eq(`http://${anIP}:5000`);
            expect(normalizeWebAddress(`${anIP}:5000`).url.protocol).to.eq('http:');
            expect(normalizeWebAddress(`${anIP}:5000`).url.port).to.eq('5000');
        });

        it('Should remove trailing slash', function () {
            expect(normalizeWebAddress(`${anIP}:5000/`).normal).to.eq(`http://${anIP}:5000`);
        });
    });

});