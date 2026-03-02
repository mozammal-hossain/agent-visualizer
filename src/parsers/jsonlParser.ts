import { Message, ToolCall, Session } from "./types";
import * as fs from "fs";
import * as path from "path";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_SUBAGENT_DEPTH = 5;

interface JsonlMessage {
    role: "user" | "assistant";
    message: {
        content: Array<{
            type: string;
            text: string;
        }>;
    };
}

export class JsonlParser {
    /**
     * Parse a .jsonl format transcript file
     */
    static parse(filePath: string, parentDir: string, depth: number = 0): Session {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(
                `Transcript file too large to parse: ${stat.size} bytes (limit: ${MAX_FILE_SIZE_BYTES})`
            );
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim());
        const messages: Message[] = [];
        let firstUserMessage = "";

        for (const line of lines) {
            try {
                const json: JsonlMessage = JSON.parse(line);
                const text =
                    json.message?.content?.[0]?.text ?? "";

                messages.push({
                    role: json.role ?? "assistant",
                    text,
                    toolCalls: [],
                });

                if (json.role === "user" && !firstUserMessage) {
                    firstUserMessage = (text || "(no query)").substring(0, 100);
                }
            } catch {
                // Skip invalid JSON lines
            }
        }

        const fileName = path.basename(filePath, ".jsonl");
        const id = fileName;

        // Load subagents up to the maximum allowed depth
        const subagents: Session[] = [];
        if (depth < MAX_SUBAGENT_DEPTH) {
            const subagentsDir = path.join(parentDir, "subagents");

            if (fs.existsSync(subagentsDir)) {
                const subagentFiles = fs
                    .readdirSync(subagentsDir)
                    .filter((f) => f.endsWith(".jsonl"));

                for (const file of subagentFiles) {
                    const subagentPath = path.join(subagentsDir, file);
                    const subagentSession = this.parse(subagentPath, subagentsDir, depth + 1);
                    subagents.push(subagentSession);
                }
            }
        }

        return {
            id,
            format: "jsonl",
            filePath,
            firstUserMessage,
            messages,
            subagents,
        };
    }
}
