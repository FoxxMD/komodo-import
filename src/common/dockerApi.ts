import { childLogger, Logger } from '@foxxmd/logging';
import Docker from 'dockerode'
import { initLogger } from './logging.js';

/**
 * There are tragically few, modern docker api libraries for typescript
 * 
 * https://github.com/leonitousconforti/the-moby-effect looks good but has a dependency on effect-ts
 * 
 * https://gitlab.com/thyran-npm-packages/docker-api looks good as well but does not support http/tcp for daemon connection, only physical socket file
 * https://gitlab.com/thyran-npm-packages/docker-api/-/issues/1
 * 
 * https://github.com/apocas/dockerode is the only one that works for any type of daemon connection but its ancient, uses prototyping, and @types/dockerode doesn't work
 */

export interface Container {
        Id: string
        Image: string
        Labels: Record<string, string>
        State: string
}

export class DockerApi {
        logger: Logger;
        api: any | null;

        constructor(logger?: Logger) {
                this.logger = childLogger(logger ?? initLogger(), 'Docker API');
        }

        init = async () => {
                if (this.api !== null) {
                        try {
                                const api = new Docker();
                                await api.ping();
                                this.api = api;
                        } catch (e) {
                                this.logger.warn(new Error('Could not use Docker API', { cause: e }));
                                this.api = null;
                        }
                }
        }

        getContainers = async (filters?: Record<string, string>): Promise<Container[]> => {
                await this.init();
                if (this.api !== null) {
                        return await this.api.listContainers(filters);
                }
                return [];
        }
}