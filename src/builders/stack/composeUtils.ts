import { childLogger, Logger } from "@foxxmd/logging";
import { Container } from "../../common/dockerApi.js";
import { StackCandidate, StackCandidateCompose } from "../../common/infrastructure/atomic.js";

export const consolidateComposeStacks = (containers: Container[], parentLogger: Logger): StackCandidateCompose[] => {
    const stacks: Record<string, StackCandidateCompose> = {};
    const logger = childLogger(parentLogger, 'Compose Parser')

    logger.verbose('Finding Compose projects for reference...');

    for (const c of containers) {
        const name = c.Labels['com.docker.compose.project'];
        if (name !== undefined && stacks[name] === undefined) {
            const candidate: StackCandidateCompose = {
                discovered: 'compose',
                projectName: name,
                workingDir: c.Labels['com.docker.compose.project.working_dir'],
                path: c.Labels['com.docker.compose.project.working_dir'],
                composeFilePaths: c.Labels['com.docker.compose.project.config_files'].split(','),
                state: c.State
            }
            let ok = true;
            for (const [k, v] of Object.entries(candidate)) {
                if (v === undefined) {
                    logger.warn(`Cannot use ${name} compose project because ${k} label is missing`);
                    ok = false;
                }
            }
            if (!ok) {
                continue;
            }
            logger.verbose(`Found Project '${candidate.projectName}' at working dir '${candidate.workingDir}'`)
            stacks[name] = candidate;
        }
    }
    const s = Object.values(stacks);
    logger.verbose(`Found ${s.length} Compose projects`);
    return s;
}