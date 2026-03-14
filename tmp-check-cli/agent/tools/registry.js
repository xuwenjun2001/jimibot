import { Tool } from "./base.js";
export class ToolRegistry {
    tools = new Map();
    register(tool) {
        if (this.tools.has(tool.name))
            throw new Error(`该工具${tool.name}已存在`);
        this.tools.set(tool.name, tool);
    }
    get(name) {
        return this.tools.get(name);
    }
    list() {
        return [...this.tools.values()];
    }
    async execute(name, params) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Unknown tool: ${name}`);
        }
        return tool.execute(params);
    }
    getDefinitions() {
        return this.list().map((tool) => tool.toSchema());
    }
}
//# sourceMappingURL=registry.js.map