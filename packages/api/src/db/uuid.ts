import { uuidv7 } from "uuidv7";

/** Generate a new UUIDv7 string for use as a primary key. */
export function newId(): string {
  return uuidv7();
}
