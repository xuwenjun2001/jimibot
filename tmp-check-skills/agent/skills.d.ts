export interface SkillRequirements {
    bins: string[];
    env: string[];
}
export type SkillSource = "workspace" | "builtin";
export interface Skill {
    name: string;
    description: string;
    content: string;
    alwaysLoad: boolean;
    requires: SkillRequirements;
    path: string;
    source: SkillSource;
    available: boolean;
    missingRequirements: string[];
}
export declare class SkillsLoader {
    readonly workspaceSkillsDir: string;
    readonly builtinSkillsDir: string;
    constructor(workspacePath: string, builtinSkillsDir?: string);
    listSkills(filterUnavailable?: boolean): Promise<Skill[]>;
    loadSkill(name: string): Promise<Skill | null>;
    loadSkillsForContext(skillNames: string[]): Promise<string>;
    getAlwaysLoadSkills(): Promise<Skill[]>;
    buildSkillsSummary(): Promise<string>;
    checkRequirements(requirements: SkillRequirements): Promise<{
        available: boolean;
        missingRequirements: string[];
    }>;
    private scanSkillsDir;
    private readSkillFile;
    private fileExists;
}
//# sourceMappingURL=skills.d.ts.map