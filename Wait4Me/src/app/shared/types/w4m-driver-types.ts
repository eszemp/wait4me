export type MapRequestIdsToDelays = { [delay: number]: string[] };
export type IncomingRequestState = { [stopRef: string]: MapRequestIdsToDelays };
