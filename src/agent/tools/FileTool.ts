import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";
import * as fs from "fs/promises";

export class ReadFileTool extends Tool {
  _MAX_CHARS = 128 * 1024;
  get name(): string {
    return "read_file";
  }

  get description(): string {
    return "Tool to read file contents.";
  }

  get parameters(): ToolParametersSchema {
    return {
      type: "object",
      properties: {
        path: {
          type: "string",
          minLength: 1,
        },
      },
      required: ["path"],
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    try {
      const castedParams = this.castParams(params);
      const errors = this.validateParams(castedParams);
      if (errors.length > 0) {
        throw new Error(errors.join("\n"));
      }
      const { path } = castedParams;
      if (typeof path !== "string") {
        throw new Error("path should be a string");
      }

      const state = await fs.stat(path);
      //先检验文件是否存在
      if (state.size > this._MAX_CHARS) {
        // 自定义一个错误抛出
        const currentSizeKB = (state.size / 1024).toFixed(2);
        throw new Error(
          `文件大小超限：当前大小为 ${currentSizeKB}KB，最大允许 128KB。`,
        );
      }
      const content = await fs.readFile(path, "utf-8");

      return content;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.error(`❌ 错误：文件不存在！请检查路径`);
      } else {
        console.error(`❌ 读取失败：${error.message}`);
      }

      // 根据你的业务逻辑，这里可以选择抛出异常，或者返回 null
      throw error;
    }
  }
}
