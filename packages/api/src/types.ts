import type pino from "pino";

export interface HonoVariables {
  logger: pino.Logger;
  requestId: string;
}

export type HonoEnv = { Variables: HonoVariables };
