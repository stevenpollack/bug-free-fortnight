import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "../app";
import { resetDb } from "../routes/testHelpers";

let rpcId = 0;

function nextId() {
  return ++rpcId;
}

async function mcpPost(method: string, params?: unknown): Promise<Response> {
  return app.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId(),
        method,
        ...(params !== undefined && { params }),
      }),
    }),
  );
}

// Parses a JSON-RPC response from either SSE or plain JSON.
async function parseMcp(
  res: Response,
): Promise<{ id: unknown; result?: unknown; error?: unknown }> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        const parsed = JSON.parse(line.slice(6)) as {
          id: unknown;
          result?: unknown;
          error?: unknown;
        };
        if ("result" in parsed || "error" in parsed) return parsed;
      }
    }
    throw new Error(`No result/error line in SSE body:\n${text}`);
  }
  return res.json();
}

// Send an MCP JSON-RPC message and return the parsed response.
async function rpc(
  method: string,
  params?: unknown,
): Promise<{ id: unknown; result?: unknown; error?: unknown }> {
  const res = await mcpPost(method, params);
  expect(res.status).toBe(200);
  return parseMcp(res);
}

// Call a tool and return its result object.
async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const msg = await rpc("tools/call", { name, arguments: args });
  return msg.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
}

// Parse the text content of a tool result as JSON.
function toolJson<T = unknown>(result: { content: Array<{ type: string; text: string }> }): T {
  return JSON.parse(result.content[0].text) as T;
}

beforeEach(async () => {
  await resetDb();
  rpcId = 0;
});

// ---------------------------------------------------------------------------
// Transport: stateless reuse regression
// ---------------------------------------------------------------------------

describe("transport: stateless reuse", () => {
  test("successive requests to /mcp all succeed (would 500 if transport was reused)", async () => {
    // This is the exact failure mode that was shipping: the second request to
    // the same transport instance throws "Stateless transport cannot be reused".
    const r1 = await mcpPost("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(r1.status).toBe(200);

    const r2 = await mcpPost("tools/list");
    expect(r2.status).toBe(200);

    const r3 = await mcpPost("resources/list");
    expect(r3.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// MCP handshake
// ---------------------------------------------------------------------------

describe("MCP handshake", () => {
  test("initialize returns server info and tool/resource capabilities", async () => {
    const msg = await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    const result = msg.result as {
      serverInfo: { name: string };
      capabilities: { tools?: object; resources?: object };
    };
    expect(result.serverInfo.name).toBe("family-recipes");
    expect(result.capabilities.tools).toBeDefined();
    expect(result.capabilities.resources).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// tools/list
// ---------------------------------------------------------------------------

describe("tools/list", () => {
  test("returns all 16 registered tools each with name, description, and inputSchema", async () => {
    const msg = await rpc("tools/list");
    const { tools } = msg.result as {
      tools: Array<{ name: string; description: string; inputSchema: unknown }>;
    };
    const names = tools.map((t) => t.name);
    const expectedNames = [
      "search_recipes",
      "get_recipe",
      "create_recipe",
      "update_recipe",
      "delete_recipe",
      "import_recipe",
      "toggle_favourite",
      "list_meal_plans",
      "create_meal_plan",
      "delete_meal_plan",
      "set_meal_plan_slot",
      "activate_meal_plan",
      "generate_shopping_list",
      "add_shopping_item",
      "check_shopping_item",
      "manage_tags",
    ];
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
    expect(tools.every((t) => Boolean(t.description))).toBe(true);
    expect(tools.every((t) => Boolean(t.inputSchema))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resources/list
// ---------------------------------------------------------------------------

describe("resources/list", () => {
  test("returns static resource URIs", async () => {
    const msg = await rpc("resources/list");
    const { resources } = msg.result as { resources: Array<{ uri?: string; name: string }> };
    const uris = resources.flatMap((r) => (r.uri ? [r.uri] : []));
    expect(uris).toContain("recipes://list");
    expect(uris).toContain("tags://list");
    expect(uris).toContain("schemas://recipe");
    expect(uris).toContain("schemas://meal-plan");
  });

  test("resource template list includes expected templates", async () => {
    const msg = await rpc("resources/templates/list");
    if (msg.error) {
      // Older SDK versions fold templates into resources/list — skip
      return;
    }
    const { resourceTemplates } = msg.result as {
      resourceTemplates: Array<{ uriTemplate: string }>;
    };
    const templates = resourceTemplates.map((r) => r.uriTemplate);
    expect(templates).toContain("recipes://{id}");
    expect(templates).toContain("meal-plans://{id}");
    expect(templates).toContain("meal-plans://{id}/shopping-list");
  });
});

// ---------------------------------------------------------------------------
// tool: search_recipes
// ---------------------------------------------------------------------------

describe("tool: search_recipes", () => {
  test("returns empty array when no recipes exist", async () => {
    const result = await callTool("search_recipes", {});
    const data = toolJson<Array<unknown>>(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  test("returns newly created recipe", async () => {
    await callTool("create_recipe", {
      recipe: {
        title: "Spaghetti Bolognese",
        baseServings: 4,
        instructions: ["Brown meat", "Add sauce"],
        ingredients: [{ item: "spaghetti", originalLine: "200g spaghetti", displayOrder: 0 }],
        favourite: false,
      },
    });

    const result = await callTool("search_recipes", {});
    const data = toolJson<Array<{ title: string }>>(result);
    expect(data.some((r) => r.title === "Spaghetti Bolognese")).toBe(true);
  });

  test("filters results by query term", async () => {
    await callTool("create_recipe", {
      recipe: {
        title: "Tacos",
        baseServings: 2,
        instructions: [],
        ingredients: [],
        favourite: false,
      },
    });
    await callTool("create_recipe", {
      recipe: {
        title: "Pasta Primavera",
        baseServings: 2,
        instructions: [],
        ingredients: [],
        favourite: false,
      },
    });

    const result = await callTool("search_recipes", { query: "pasta" });
    const data = toolJson<Array<{ title: string }>>(result);
    expect(data.some((r) => r.title === "Pasta Primavera")).toBe(true);
    expect(data.every((r) => r.title !== "Tacos")).toBe(true);
  });

  test("filters to favourites only", async () => {
    await callTool("create_recipe", {
      recipe: {
        title: "Soup",
        baseServings: 2,
        instructions: [],
        ingredients: [],
        favourite: false,
      },
    });
    await callTool("create_recipe", {
      recipe: {
        title: "Favourite Cake",
        baseServings: 8,
        instructions: [],
        ingredients: [],
        favourite: true,
      },
    });

    const result = await callTool("search_recipes", { favourite: true });
    const data = toolJson<Array<{ title: string; favourite: boolean }>>(result);
    expect(data.every((r) => r.favourite === true)).toBe(true);
    expect(data.some((r) => r.title === "Favourite Cake")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tool: get_recipe
// ---------------------------------------------------------------------------

describe("tool: get_recipe", () => {
  test("returns full recipe for a valid ID", async () => {
    const created = await callTool("create_recipe", {
      recipe: {
        title: "Risotto",
        baseServings: 2,
        instructions: ["Stir constantly"],
        ingredients: [{ item: "arborio rice", originalLine: "1 cup rice", displayOrder: 0 }],
        favourite: false,
      },
    });
    const { id } = toolJson<{ id: string }>(created);

    const result = await callTool("get_recipe", { id });
    const recipe = toolJson<{ id: string; title: string; ingredients: unknown[] }>(result);
    expect(recipe.id).toBe(id);
    expect(recipe.title).toBe("Risotto");
    expect(Array.isArray(recipe.ingredients)).toBe(true);
  });

  test("returns isError without crashing for an unknown UUID", async () => {
    const result = await callTool("get_recipe", {
      id: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tool: create_recipe / delete_recipe
// ---------------------------------------------------------------------------

describe("tool: create_recipe / delete_recipe", () => {
  test("create inserts the recipe and delete removes it", async () => {
    const created = await callTool("create_recipe", {
      recipe: {
        title: "Focaccia",
        baseServings: 8,
        instructions: ["Mix dough", "Bake at 220°C"],
        ingredients: [],
        favourite: false,
      },
    });
    const { id } = toolJson<{ id: string }>(created);
    expect(id).toBeTruthy();

    const del = await callTool("delete_recipe", { id });
    expect(toolJson<{ deleted: boolean }>(del).deleted).toBe(true);

    const fetched = await callTool("get_recipe", { id });
    expect(fetched.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resource: recipes://list
// ---------------------------------------------------------------------------

describe("resource: recipes://list", () => {
  test("resources/read returns application/json array content", async () => {
    await callTool("create_recipe", {
      recipe: {
        title: "Banana Bread",
        baseServings: 8,
        instructions: [],
        ingredients: [],
        favourite: false,
      },
    });

    const msg = await rpc("resources/read", { uri: "recipes://list" });
    const result = msg.result as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };
    expect(result.contents[0].uri).toBe("recipes://list");
    expect(result.contents[0].mimeType).toBe("application/json");
    const data = JSON.parse(result.contents[0].text) as Array<{ title: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((r) => r.title === "Banana Bread")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resource: recipes://{id}
// ---------------------------------------------------------------------------

describe("resource: recipes://{id}", () => {
  test("resources/read returns the correct recipe JSON", async () => {
    const created = await callTool("create_recipe", {
      recipe: {
        title: "Lemon Tart",
        baseServings: 6,
        instructions: ["Make curd", "Fill tart shell"],
        ingredients: [{ item: "lemon", originalLine: "2 lemons", displayOrder: 0 }],
        favourite: false,
      },
    });
    const { id } = toolJson<{ id: string }>(created);

    const msg = await rpc("resources/read", { uri: `recipes://${id}` });
    const result = msg.result as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };
    expect(result.contents[0].mimeType).toBe("application/json");
    const recipe = JSON.parse(result.contents[0].text) as { title: string; id: string };
    expect(recipe.id).toBe(id);
    expect(recipe.title).toBe("Lemon Tart");
  });
});

// ---------------------------------------------------------------------------
// OAuth discovery
// ---------------------------------------------------------------------------

describe("OAuth discovery", () => {
  test("GET /.well-known/oauth-protected-resource returns resource and authorization_servers", async () => {
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-protected-resource"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      resource: string;
      authorization_servers: string[];
    };
    expect(data.resource).toBeTruthy();
    expect(Array.isArray(data.authorization_servers)).toBe(true);
    expect(data.authorization_servers.length).toBeGreaterThan(0);
  });

  test("GET /.well-known/oauth-authorization-server returns RFC 8414 metadata", async () => {
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-authorization-server"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
      response_types_supported: string[];
      grant_types_supported: string[];
      code_challenge_methods_supported: string[];
    };
    expect(data.issuer).toBeTruthy();
    expect(data.authorization_endpoint).toContain("/authorize");
    expect(data.token_endpoint).toContain("/token");
    expect(data.registration_endpoint).toContain("/register");
    expect(data.response_types_supported).toContain("code");
    expect(data.grant_types_supported).toContain("authorization_code");
    expect(data.code_challenge_methods_supported).toContain("S256");
  });
});

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

describe("OAuth flow", () => {
  test("POST /register returns client_id and echoes redirect_uris", async () => {
    const res = await app.fetch(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://localhost:3000/callback"],
          grant_types: ["authorization_code"],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { client_id: string; redirect_uris: string[] };
    expect(data.client_id).toBeTruthy();
    expect(data.redirect_uris).toContain("http://localhost:3000/callback");
  });

  test("GET /authorize redirects with code and preserves state", async () => {
    const redirectUri = "http://localhost:3000/callback";
    const state = "test-state-xyz";
    const url = new URL("http://localhost/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", "test-client");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", "abc123");
    url.searchParams.set("code_challenge_method", "S256");

    const res = await app.fetch(new Request(url.toString()));
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    const dest = new URL(location);
    expect(dest.searchParams.get("code")).toBeTruthy();
    expect(dest.searchParams.get("state")).toBe(state);
    expect(`${dest.origin}${dest.pathname}`).toBe(redirectUri);
  });

  test("POST /token returns a bearer access token", async () => {
    const res = await app.fetch(
      new Request("http://localhost/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "test-code",
          client_id: "test-client",
          redirect_uri: "http://localhost:3000/callback",
        }).toString(),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };
    expect(data.access_token).toBeTruthy();
    expect(data.token_type).toBe("Bearer");
    expect(data.expires_in).toBeGreaterThan(0);
  });
});
