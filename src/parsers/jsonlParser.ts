import { Message, ToolCall, Session } from "./types";
import * as fs from "fs";
import * as path from "path";

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
    static parse(filePath: string, parentDir: string): Session {
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

        // Extract parent UUID from path
        const fileName = path.basename(filePath, ".jsonl");
        const parentUuid = path.basename(parentDir);
        const id = fileName.substring(0, 8);

        // Load subagents
        const subagents: Session[] = [];
        const subagentsDir = path.join(parentDir, "subagents");

        if (fs.existsSync(subagentsDir)) {
            const subagentFiles = fs
                .readdirSync(subagentsDir)
                .filter((f) => f.endsWith(".jsonl"));

            for (const file of subagentFiles) {
                const subagentPath = path.join(subagentsDir, file);
                const subagentSession = this.parse(subagentPath, subagentsDir);
                subagents.push(subagentSession);
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
