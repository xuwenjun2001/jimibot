import { Tool, type ToolSchemaDefinition } from "./base.js";
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool) {
    if (this.tools.has(tool.name)) throw new Error(`该工具${tool.name}已存在`);
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.execute(params);
  }

  getDefinitions(): ToolSchemaDefinition[] {
    return this.list().map((tool) => tool.toSchema());
  }
}
