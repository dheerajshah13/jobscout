import type { Job, SearchSegment } from "../index.js";

export type RawJob = {
  source: string;
  sourceId: string;
  sourceUrl: string;
  payload: unknown;
};

export type SourceAdapter = {
  name: string;
  fetch(segment: SearchSegment): Promise<RawJob[]>;
  normalize(raw: RawJob): Job;
};
