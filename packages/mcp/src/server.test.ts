import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createMcpServer } from "./server.js";

// ---------------------------------------------------------------------------
// Mock fetch so tests don't require a running API
// ---------------------------------------------------------------------------

const mockFetch = mock(async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (url.includes("/api/recipes") && !url.includes("/favourite")) {
    return new Response(JSON.stringify([{ id: "test-id", title: "Test Recipe" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.includes("/api/tags")) {
    return new Response(JSON.stringify([{ id: "tag-1", name: "Italian" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.includes("/api/meal-plans")) {
    return new Response(JSON.stringify([{ id: "plan-1", name: "Week 1" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  mockFetch.mockClear();
});

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

describe("createMcpServer", () => {
  test("returns an McpServer instance", () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });

  test("server has registered tools accessible via underlying Server", () => {
    const server = createMcpServer();
    // The McpServer exposes its underlying Server instance
    expect(server.server).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

describe("searchRecipes tool", () => {
  test("returns recipe list as JSON text", async () => {
    const { searchRecipes } = await import("./tools.js");
    const result = await searchRecipes({});
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const data = JSON.parse(result.content[0].text);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].title).toBe("Test Recipe");
  });

  test("passes query param to API", async () => {
    const { searchRecipes } = await import("./tools.js");
    await searchRecipes({ query: "pasta" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = String((mockFetch.mock.calls[0] as [string])[0]);
    expect(calledUrl).toContain("q=pasta");
  });

  test("passes favourite filter to API", async () => {
    const { searchRecipes } = await import("./tools.js");
    await searchRecipes({ favourite: true });
    const calledUrl = String((mockFetch.mock.calls[0] as [string])[0]);
    expect(calledUrl).toContain("favourite=true");
  });
});

describe("deleteRecipe tool", () => {
  test("returns deleted:true on success", async () => {
    const deleteMock = mock(async () => new Response(null, { status: 204 }));
    global.fetch = deleteMock as unknown as typeof fetch;

    const { deleteRecipe } = await import("./tools.js");
    const result = await deleteRecipe({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.content[0].text).toContain('"deleted": true');
  });
});

describe("manageTags tool", () => {
  test("throws when creating without a name", async () => {
    const { manageTags } = await import("./tools.js");
    await expect(manageTags({ action: "create" })).rejects.toThrow("name is required");
  });

  test("throws when deleting without an id", async () => {
    const { manageTags } = await import("./tools.js");
    await expect(manageTags({ action: "delete" })).rejects.toThrow("id is required");
  });
});

// ---------------------------------------------------------------------------
// Resource handlers
// ---------------------------------------------------------------------------

describe("readRecipesList resource", () => {
  test("returns recipes as application/json content", async () => {
    const { readRecipesList } = await import("./resources.js");
    const result = await readRecipesList();
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe("application/json");
    expect(result.contents[0].uri).toBe("recipes://list");
    const data = JSON.parse(result.contents[0].text);
    expect(data[0].title).toBe("Test Recipe");
  });
});

describe("readTagsList resource", () => {
  test("returns tags as application/json content", async () => {
    const { readTagsList } = await import("./resources.js");
    const result = await readTagsList();
    expect(result.contents[0].uri).toBe("tags://list");
    const data = JSON.parse(result.contents[0].text);
    expect(data[0].name).toBe("Italian");
  });
});

describe("readRecipe template resource", () => {
  test("fetches recipe by id and returns correct URI", async () => {
    const { readRecipe } = await import("./resources.js");
    const uri = new URL("recipes://00000000-0000-0000-0000-000000000001");
    const result = await readRecipe(uri, { id: "00000000-0000-0000-0000-000000000001" });
    expect(result.contents[0].uri).toBe("recipes://00000000-0000-0000-0000-000000000001");
    expect(result.contents[0].mimeType).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("checkAuth", () => {
  test("returns true when Authorization header matches token", async () => {
    const { checkAuth } = await import("./auth.js");
    const req = { headers: { authorization: "Bearer secret123" } } as Parameters<
      typeof checkAuth
    >[0];
    expect(checkAuth(req, "secret123")).toBe(true);
  });

  test("returns false when token does not match", async () => {
    const { checkAuth } = await import("./auth.js");
    const req = { headers: { authorization: "Bearer wrong" } } as Parameters<typeof checkAuth>[0];
    expect(checkAuth(req, "secret123")).toBe(false);
  });

  test("returns false when Authorization header is missing", async () => {
    const { checkAuth } = await import("./auth.js");
    const req = { headers: {} } as Parameters<typeof checkAuth>[0];
    expect(checkAuth(req, "secret123")).toBe(false);
  });
});
