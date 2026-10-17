"use client";

// React binding for the local learning record (lib/latent/mastery/progress.ts). Browser-only storage, no network.

import { useSyncExternalStore } from "react";
import { EMPTY_STATE, readState, record, recordTeach, resetState, status, subscribe, writeState, type LearnState, type Status } from "@/lib/latent/mastery/progress";

/** One timestamp per page load, so render output is stable while you study; answers use the real time. */
export const PAGE_NOW = Date.now();
const clock = () => Date.now();

export const useLearn = (): LearnState => useSyncExternalStore(subscribe, readState, () => EMPTY_STATE);
export const useConceptStatus = (concept: string): Status => status(useLearn().concepts[concept], PAGE_NOW);
export const saveAnswer = (concept: string, correct: boolean) => writeState(record(readState(), concept, correct, clock()));
export const saveTeachBack = (concept: string, text: string, points: number) => writeState(recordTeach(readState(), concept, text, points, clock()));
export const clearProgress = () => resetState();
