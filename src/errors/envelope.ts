export type ToolErrorEnvelope = {
  code: string;
  message: string;
  retriable: boolean;
  details: Record<string, unknown>;
};
