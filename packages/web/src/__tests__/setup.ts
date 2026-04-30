import { afterAll, afterEach, beforeAll } from "bun:test";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
