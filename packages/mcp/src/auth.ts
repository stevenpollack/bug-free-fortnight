import type { IncomingMessage } from "node:http";

export function checkAuth(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${token}`;
}
