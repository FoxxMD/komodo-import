import { AnyStackConfig } from "../../common/infrastructure/config/stackConfig.js";
import { TomlStack } from "../../common/infrastructure/tomlObjects.js";
import { findFolders } from "../../common/utils/io.js";
import { childLogger, Logger } from "@foxxmd/logging";
import { formatIntoColumns, parseBool } from "../../common/utils/utils.js";
import { buildGitStack } from "./gitStack.js";
import { join as joinPath, parse, ParsedPath } from 'path';
import { buildFileStack } from "./filesOnServer.js";
import { SimpleError } from "../../common/errors.js";
import { DEFAULT_GLOB_COMPOSE, DEFAULT_GLOB_FOLDER, KOMODO_GLOB_IGNORE_COMPOSE, DirectoryConfig, StackCandidateCompose, StackSourceOfTruth } from "../../common/infrastructure/atomic.js";
import { DockerApi } from "../../common/dockerApi.js";
import { consolidateComposeStacks } from "./composeUtils.js";
import { DEFAULT_ENV_GLOB } from "./stackUtils.js";
import { Minimatch, minimatch } from "minimatch";
import { stripIndents } from "common-tags";

export class StackBuilder {

    logger: Logger;
    stackConfigOptions: AnyStackConfig;

    dirData: DirectoryConfig;

    composeCandidateStacks: StackCandidateCompose[] = [];

    docker: DockerApi;

    constructor(stacksConfig: AnyStackConfig, dirs: DirectoryConfig, logger: Logger) {
        this.stackConfigOptions = stacksConfig;
        this.dirData = dirs;
        this.logger = childLogger(logger, 'Stacks');
        this.docker = new DockerApi();
    }

    parseComposeProjects = async () => {
        const containers = await this.docker.getContainers({ label: 'com.docker.compose.project' });
        if (containers.length > 0) {
            this.composeCandidateStacks = consolidateComposeStacks(containers, this.logger);
        }
    }

    buildStacks = async (sourceOfTruth: StackSourceOfTruth): Promise<TomlStack[]> => {

        this.logger.info(`Using ${sourceOfTruth === 'compose' ? 'parsed Compose projects' : 'child folders in SCAN_DIR'} to generate Stacks.`);

        const {
            folderGlob = DEFAULT_GLOB_FOLDER,
            ignoreFolderGlob,
            envFileGlob = DEFAULT_ENV_GLOB,
            composeGlob = DEFAULT_GLOB_COMPOSE,
            ignoreComposeGlob
        } = this.stackConfigOptions;

        let folderPaths: string[] = [];

        const writeEnvGlobal = parseBool(process.env.WRITE_ENV, true);
        const writeEnvFolder = parseBool(process.env.WRITE_ENV_DIR, writeEnvGlobal);
        const writeEnvGit = parseBool(process.env.WRITE_ENV_GIT, writeEnvGlobal);

        this.logger.info(`Env Glob: ${envFileGlob}`);
        this.logger.info(`Write .env to Komodo Environment -- Dir Stack: ${writeEnvFolder} | Git Stack: ${writeEnvGit} `);

        if (sourceOfTruth === 'compose') {
            this.logger.info(`Compose Working Dir Glob: ${composeGlob}`);
            this.logger.info(`Compose Working Dir Ignore Glob: ${ignoreComposeGlob ?? 'N/A'}`);

            await this.parseComposeProjects();

            const includeGlob = new Minimatch(composeGlob);
            const excludeGlob = ignoreComposeGlob === undefined ? undefined : new Minimatch(ignoreComposeGlob);
            const komodoGlob = new Minimatch(KOMODO_GLOB_IGNORE_COMPOSE);

            for (const c of this.composeCandidateStacks) {
                if (!c.workingDir.includes(this.dirData.host)) {
                    this.logger.warn(`Compose project '${c.projectName}' working dir '${c.workingDir}' is not present in Host Dir, cannot use project`);
                    continue;
                }

                if(!includeGlob.match(c.workingDir)) {
                    this.logger.verbose(`Compose project '${c.projectName}' working dir '${c.workingDir}' did not match file glob`);
                    continue;
                }
                if(excludeGlob !== undefined && excludeGlob.match(c.workingDir)) {
                    this.logger.verbose(`Compose project '${c.projectName}' working dir '${c.workingDir}' matches ignore file glob, skipping`);
                    continue;
                }
                if(komodoGlob.match(c.workingDir)) {
                    this.logger.verbose(`Compose project '${c.projectName}' working dir '${c.workingDir}' is in known komodo directory, skipping`);
                    continue;
                }
                const convertedPath = c.workingDir.replace(this.dirData.host, this.dirData.mount);
                this.logger.debug(stripIndents`Compose project '${c.projectName}' is valid!
                    Host Working Dir         => ${c.workingDir}
                    Komodo Import Mount Path => ${convertedPath}`);
                folderPaths.push(convertedPath);
            }
            this.logger.verbose(`Got ${folderPaths.length} valid compose project directories`);
        } else {
            this.logger.info(`Folder Glob: ${folderGlob}`);
            this.logger.info(`Folder Ignore Glob: ${ignoreFolderGlob ?? 'N/A'}`);

            await this.parseComposeProjects();
            const dirs = await findFolders(this.dirData.scan, folderGlob, ignoreFolderGlob)
            folderPaths = dirs.map(x => joinPath(this.dirData.scan, x));
            this.logger.verbose(`Got ${folderPaths.length} folders in ${this.dirData.scan}:\n${formatIntoColumns(dirs, 3)}`);
        }

        let stacks: TomlStack[] = [];

        let stackOptions = {
            ...this.stackConfigOptions,
            writeEnv: parseBool(process.env.WRITE_ENV, false)
        };

        for (const f of folderPaths) {

            let composeFiles: string[] = [];
            let projectName: string;

            const folderStackOptions = {...stackOptions};

            const matchedProject = this.composeCandidateStacks.find(x => x.workingDir.replace(this.dirData.host, this.dirData.mount) === f);
            if(matchedProject !== undefined) {
                projectName = matchedProject.projectName;
                composeFiles = matchedProject.composeFilePaths.map(x => x.replace(matchedProject.workingDir, ''));
                folderStackOptions.projectName = projectName;
                folderStackOptions.composeFiles = composeFiles;
            }


            const pathInfo: ParsedPath = parse(f);
            const folderLogger = childLogger(this.logger, `${pathInfo.name}${pathInfo.ext !== '' ? pathInfo.ext : ''}`);

            try {
                stacks.push(await buildGitStack(f, {
                    ...folderStackOptions,
                    writeEnv: writeEnvGit,
                    logger: this.logger,
                }));
                continue;
            } catch (e) {
                if (e instanceof SimpleError) {
                    folderLogger.verbose(`Falling back to Files-On-Server => ${e.message}`);
                } else {
                    folderLogger.error(new Error(`Unable to build Git Stack for folder ${f}`, { cause: e }));
                    continue;
                }
            }

            try {
                stacks.push(await buildFileStack(f, {
                    ...folderStackOptions,
                    writeEnv: writeEnvFolder,
                    hostParentPath: this.dirData.host, 
                    logger: this.logger }));
            } catch (e) {
                folderLogger.error(new Error(`Unable to build Files-On-Server Stack for folder ${f}`, { cause: e }));
            }

        }

        return stacks;
    }
}