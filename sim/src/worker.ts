/** Worker: führt einen Seed eines Szenarios aus (Parallelisierung über worker_threads). */
import { parentPort, workerData } from 'node:worker_threads';
import type { Params, Proposals } from './params.js';
import { runSeed, type Scenario } from './run.js';

const { params, proposals, scenario, seed } = workerData as { params: Params; proposals: Proposals; scenario: Scenario; seed: string };
parentPort!.postMessage(runSeed(params, proposals, scenario, seed));
