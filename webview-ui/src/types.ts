export interface ToolCall {
    name: string;
    parameters: Record<string, string>;
    hasResult: boolean;
}

export interface Message {
    role: "user" | "assistant";
    text: string;
    toolCalls: ToolCall[];
}

export interface Session {
    id: string;
    format: "txt" | "jsonl";
    filePath: string;
    firstUserMessage: string;
    messages: Message[];
    subagents: Session[];
}
