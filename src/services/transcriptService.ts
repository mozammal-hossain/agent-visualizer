import * as fs from "fs";
import * as path from "path";
import { Session } from "../parsers/types";
import { TxtParser } from "../parsers/txtParser";
import { JsonlParser } from "../parsers/jsonlParser";
import { PathResolver } from "./pathResolver";

export class TranscriptService {
    private cache: Map<string, Session> = new Map();
    private transcriptDir: string;

    constructor(transcriptDir: string) {
        this.transcriptDir = transcriptDir;
    }

    /**
     * Discover and parse all transcript files in the transcript directory
     */
    getSessions(): Session[] {
        if (!fs.existsSync(this.transcriptDir)) {
            return [];
        }

        const sessions: Session[] = [];
        const files = fs.readdirSync(this.transcriptDir);

        for (const file of files) {
            const filePath = path.join(this.transcriptDir, file);
            const stat = fs.statSync(filePath);

            // Skip directories
            if (stat.isDirectory()) {
                continue;
            }

            if (file.endsWith(".txt")) {
                try {
                    const session = TxtParser.parse(filePath);
                    sessions.push(session);
                    this.cache.set(session.id, session);
                } catch (e) {
                    console.error(`Failed to parse txt file ${file}:`, e);
                }
            } else if (file.endsWith(".jsonl")) {
                try {
                    const parentDir = path.dirname(filePath);
                    const session = JsonlParser.parse(filePath, parentDir);
                    sessions.push(session);
                    this.cache.set(session.id, session);
                } catch (e) {
                    console.error(`Failed to parse jsonl file ${file}:`, e);
                }
            }
        }

        return sessions.sort(
            (a, b) =>
                fs.statSync(b.filePath).mtime.getTime() -
                fs.statSync(a.filePath).mtime.getTime()
        );
    }

    /**
     * Get a specific session by ID
     */
    getSession(id: string): Session | undefined {
        return this.cache.get(id);
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }
}

export function createTranscriptService(
    workspacePath: string
): TranscriptService {
    const transcriptDir =
        PathResolver.getTranscriptFolderForWorkspace(workspacePath);
    return new TranscriptService(transcriptDir);
}
