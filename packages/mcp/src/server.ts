import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  mealPlanShoppingListTemplate,
  mealPlanTemplate,
  readMealPlan,
  readMealPlanSchema,
  readMealPlanShoppingList,
  readRecipe,
  readRecipeSchema,
  readRecipesList,
  readTagsList,
  recipeTemplate,
} from "./resources.js";
import {
  ActivateMealPlanInput,
  AddShoppingItemInput,
  CheckShoppingItemInput,
  CreateMealPlanInput,
  CreateRecipeInput,
  DeleteMealPlanInput,
  DeleteRecipeInput,
  GenerateShoppingListInput,
  GetRecipeInput,
  ImportRecipeInput,
  ManageTagsInput,
  SearchRecipesInput,
  SetMealPlanSlotInput,
  ToggleFavouriteInput,
  UpdateRecipeInput,
  activateMealPlan,
  addShoppingItem,
  checkShoppingItem,
  createMealPlan,
  createRecipe,
  deleteMealPlan,
  deleteRecipe,
  generateShoppingList,
  getRecipe,
  importRecipe,
  listMealPlans,
  manageTags,
  searchRecipes,
  setMealPlanSlot,
  toggleFavourite,
  updateRecipe,
} from "./tools.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "family-recipes",
    version: "0.0.0",
  });

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  server.registerTool(
    "search_recipes",
    {
      description: "Search and filter recipes by query, tags, or favourite status",
      inputSchema: SearchRecipesInput,
    },
    (args) => searchRecipes(args),
  );

  server.registerTool(
    "get_recipe",
    {
      description: "Get full detail for a single recipe by ID",
      inputSchema: GetRecipeInput,
    },
    (args) => getRecipe(args),
  );

  server.registerTool(
    "create_recipe",
    {
      description: "Create a new recipe",
      inputSchema: CreateRecipeInput,
    },
    (args) => createRecipe(args),
  );

  server.registerTool(
    "update_recipe",
    {
      description: "Fully replace an existing recipe",
      inputSchema: UpdateRecipeInput,
    },
    (args) => updateRecipe(args),
  );

  server.registerTool(
    "delete_recipe",
    {
      description: "Permanently delete a recipe",
      inputSchema: DeleteRecipeInput,
    },
    (args) => deleteRecipe(args),
  );

  server.registerTool(
    "import_recipe",
    {
      description: "Preview/import a recipe from a URL",
      inputSchema: ImportRecipeInput,
    },
    (args) => importRecipe(args),
  );

  server.registerTool(
    "toggle_favourite",
    {
      description: "Toggle the favourite status of a recipe",
      inputSchema: ToggleFavouriteInput,
    },
    (args) => toggleFavourite(args),
  );

  server.registerTool(
    "list_meal_plans",
    {
      description: "List all meal plans",
      inputSchema: {},
    },
    () => listMealPlans(),
  );

  server.registerTool(
    "create_meal_plan",
    {
      description: "Create a new meal plan",
      inputSchema: CreateMealPlanInput,
    },
    (args) => createMealPlan(args),
  );

  server.registerTool(
    "delete_meal_plan",
    {
      description: "Delete a meal plan",
      inputSchema: DeleteMealPlanInput,
    },
    (args) => deleteMealPlan(args),
  );

  server.registerTool(
    "set_meal_plan_slot",
    {
      description: "Assign a recipe or note to a day slot in a meal plan",
      inputSchema: SetMealPlanSlotInput,
    },
    (args) => setMealPlanSlot(args),
  );

  server.registerTool(
    "activate_meal_plan",
    {
      description: "Set a meal plan as the active plan for this week",
      inputSchema: ActivateMealPlanInput,
    },
    (args) => activateMealPlan(args),
  );

  server.registerTool(
    "generate_shopping_list",
    {
      description: "Generate a shopping list from a meal plan's assigned recipes",
      inputSchema: GenerateShoppingListInput,
    },
    (args) => generateShoppingList(args),
  );

  server.registerTool(
    "add_shopping_item",
    {
      description: "Add a custom item to a meal plan's shopping list",
      inputSchema: AddShoppingItemInput,
    },
    (args) => addShoppingItem(args),
  );

  server.registerTool(
    "check_shopping_item",
    {
      description: "Toggle the checked state of a shopping list item",
      inputSchema: CheckShoppingItemInput,
    },
    (args) => checkShoppingItem(args),
  );

  server.registerTool(
    "manage_tags",
    {
      description: "Create or delete a recipe tag",
      inputSchema: ManageTagsInput,
    },
    (args) => manageTags(args),
  );

  // -------------------------------------------------------------------------
  // Resources — static
  // -------------------------------------------------------------------------

  server.registerResource(
    "recipes-list",
    "recipes://list",
    { description: "All recipes with titles, IDs, and tags" },
    (_uri) => readRecipesList(),
  );

  server.registerResource("tags-list", "tags://list", { description: "All recipe tags" }, (_uri) =>
    readTagsList(),
  );

  server.registerResource(
    "schema-recipe",
    "schemas://recipe",
    { description: "JSON Schema for the recipe object" },
    (_uri) => readRecipeSchema(),
  );

  server.registerResource(
    "schema-meal-plan",
    "schemas://meal-plan",
    { description: "JSON Schema for meal plan generation" },
    (_uri) => readMealPlanSchema(),
  );

  // -------------------------------------------------------------------------
  // Resources — templates
  // -------------------------------------------------------------------------

  server.registerResource(
    "recipe",
    recipeTemplate,
    { description: "Full recipe detail including ingredients" },
    (uri, vars) => readRecipe(uri, vars as Record<string, string | string[]>),
  );

  server.registerResource(
    "meal-plan",
    mealPlanTemplate,
    { description: "Meal plan with all day slots" },
    (uri, vars) => readMealPlan(uri, vars as Record<string, string | string[]>),
  );

  server.registerResource(
    "meal-plan-shopping-list",
    mealPlanShoppingListTemplate,
    { description: "Shopping list for a meal plan" },
    (uri, vars) => readMealPlanShoppingList(uri, vars as Record<string, string | string[]>),
  );

  return server;
}
