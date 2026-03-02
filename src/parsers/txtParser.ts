import { Message, ToolCall, Session } from "./types";
import * as fs from "fs";
import * as path from "path";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export class TxtParser {
    /**
     * Parse a .txt format transcript file
     */
    static parse(filePath: string): Session {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(
                `Transcript file too large to parse: ${stat.size} bytes (limit: ${MAX_FILE_SIZE_BYTES})`
            );
        }
        const content = fs.readFileSync(filePath, "utf-8");
        const messages: Message[] = [];
        let firstUserMessage = "";

        // Split by user: and assistant: markers
        const lines = content.split("\n");
        let currentRole: "user" | "assistant" | null = null;
        let currentText = "";
        let currentToolCalls: ToolCall[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.trim() === "user:") {
                // Save previous message if exists
                if (currentRole !== null) {
                    messages.push({
                        role: currentRole,
                        text: currentText.trim(),
                        toolCalls: currentToolCalls,
                    });
                }
                currentRole = "user";
                currentText = "";
                currentToolCalls = [];
            } else if (line.trim() === "A:") {
                // Save previous message if exists
                if (currentRole !== null) {
                    messages.push({
                        role: currentRole,
                        text: currentText.trim(),
                        toolCalls: currentToolCalls,
                    });
                }
                currentRole = "assistant";
                currentText = "";
                currentToolCalls = [];
            } else if (line.trim().startsWith("[Tool call]")) {
                // Extract tool call
                const toolMatch = line.match(/\[Tool call\]\s+(\w+)/);
                if (toolMatch) {
                    const toolName = toolMatch[1];
                    const parameters: Record<string, string> = {};

                    // Read subsequent indented lines for parameters
                    let j = i + 1;
                    while (j < lines.length) {
                        const paramLine = lines[j];
                        if (!paramLine.startsWith("  ") || paramLine.trim() === "") {
                            break;
                        }
                        const paramMatch = paramLine.match(/^\s+(\w+):\s*(.*)$/);
                        if (paramMatch) {
                            parameters[paramMatch[1]] = paramMatch[2];
                            j++;
                        } else {
                            break;
                        }
                    }
                    i = j - 1;

                    currentToolCalls.push({
                        name: toolName,
                        parameters,
                        hasResult: false,
                    });
                }
            } else if (line.trim().startsWith("[Tool result]")) {
                // Mark the last tool call as having a result
                if (currentToolCalls.length > 0) {
                    currentToolCalls[currentToolCalls.length - 1].hasResult = true;
                }
            } else if (line.trim().startsWith("<user_query>")) {
                // Extract user query for first message
                currentText += line.replace(/<user_query>/, "").trim();
                let j = i + 1;
                while (j < lines.length && !lines[j].includes("</user_query>")) {
                    currentText += "\n" + lines[j];
                    j++;
                }
                if (j < lines.length) {
                    currentText += "\n" + lines[j].replace(/<\/user_query>/, "").trim();
                }
                i = j;
            } else if (currentRole !== null) {
                currentText += line + "\n";
            }
        }

        // Save final message
        if (currentRole !== null) {
            messages.push({
                role: currentRole,
                text: currentText.trim(),
                toolCalls: currentToolCalls,
            });
        }

        // Extract first user message
        const firstUserMsg = messages.find((m) => m.role === "user");
        if (firstUserMsg) {
            firstUserMessage = firstUserMsg.text.substring(0, 100);
        }

        const fileName = path.basename(filePath, ".txt");
        const id = fileName;

        return {
            id,
            format: "txt",
            filePath,
            firstUserMessage,
            messages,
            subagents: [],
        };
    }
}
