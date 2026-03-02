import { ToolCall } from "../types";

const MAX_LABEL_LENGTH = 60;

function basename(p: string): string {
    const normalized = p.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || p;
}

/**
 * Returns a short human-readable label for a tool call, e.g. "Read foo.dart", "StrReplace in bar.ts".
 */
export function formatToolLabel(toolCall: ToolCall): string {
    const name = toolCall.name;
    const params = toolCall.parameters || {};
    const pathParam = params.path ?? params.filePath ?? params.file ?? params.target ?? "";
    const commandParam = params.command ?? params.cmd ?? "";
    const patternParam = params.pattern ?? params.query ?? "";
    const descriptionParam = params.description ?? params.prompt ?? "";

    const n = name.toLowerCase();

    if ((n.includes("task") || n === "mcp_task") && descriptionParam) {
        const short =
            descriptionParam.length > 50
                ? descriptionParam.slice(0, 47) + "..."
                : descriptionParam;
        return `Subagent: ${short}`;
    }

    if ((n.includes("read") || n === "read") && pathParam) {
        return `Read ${basename(pathParam)}`;
    }
    if ((n.includes("write") || n.includes("create") || n === "write") && pathParam) {
        return `Write ${basename(pathParam)}`;
    }
    if ((n.includes("replace") || n === "strreplace") && pathParam) {
        return `StrReplace in ${basename(pathParam)}`;
    }
    if ((n.includes("grep") || n.includes("search")) && patternParam) {
        const short = patternParam.length > 30 ? patternParam.slice(0, 27) + "..." : patternParam;
        return `Grep: ${short}`;
    }
    if ((n.includes("shell") || n.includes("exec") || n.includes("run")) && commandParam) {
        const trimmed = commandParam.trim();
        const firstLine = trimmed.split("\n")[0];
        const short = firstLine.length > 50 ? firstLine.slice(0, 47) + "..." : firstLine;
        return `Running: ${short}`;
    }
    if (n.includes("find") && pathParam) {
        return `Find in ${basename(pathParam)}`;
    }

    return name;
}
