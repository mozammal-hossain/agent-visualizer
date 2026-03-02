/// <reference path="../global.d.ts" />
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
        const entries = fs.readdirSync(this.transcriptDir);

        for (const entry of entries) {
            const entryPath = path.join(this.transcriptDir, entry);
            let stat: ReturnType<typeof fs.statSync>;
            try {
                stat = fs.statSync(entryPath);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                // Cursor stores .jsonl as {uuid}/{uuid}.jsonl
                const jsonlPath = path.join(entryPath, `${entry}.jsonl`);
                if (!fs.existsSync(jsonlPath)) {
                    // Fallback: any .jsonl in this directory (e.g. different naming)
                    const dirFiles = fs.readdirSync(entryPath);
                    const firstJsonl = dirFiles.find((f: string) => f.endsWith(".jsonl"));
                    if (firstJsonl) {
                        const fallbackPath = path.join(entryPath, firstJsonl);
                        try {
                            const session = JsonlParser.parse(fallbackPath, entryPath);
                            sessions.push(session);
                            this.cache.set(session.id, session);
                        } catch (e) {
                            console.error(`Failed to parse jsonl in dir ${entry}:`, e);
                        }
                    }
                } else {
                    try {
                        const session = JsonlParser.parse(jsonlPath, entryPath);
                        sessions.push(session);
                        this.cache.set(session.id, session);
                    } catch (e) {
                        console.error(`Failed to parse jsonl in dir ${entry}:`, e);
                    }
                }
                continue;
            }

            if (entry.endsWith(".txt")) {
                try {
                    const session = TxtParser.parse(entryPath);
                    sessions.push(session);
                    this.cache.set(session.id, session);
                } catch (e) {
                    console.error(`Failed to parse txt file ${entry}:`, e);
                }
            } else if (entry.endsWith(".jsonl")) {
                try {
                    const parentDir = path.dirname(entryPath);
                    const session = JsonlParser.parse(entryPath, parentDir);
                    sessions.push(session);
                    this.cache.set(session.id, session);
                } catch (e) {
                    console.error(`Failed to parse jsonl file ${entry}:`, e);
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

    /**
     * Get the transcript directory path (for display when no sessions found)
     */
    getTranscriptDir(): string {
        return this.transcriptDir;
    }
}

export function createTranscriptService(
    workspacePath: string
): TranscriptService {
    const transcriptDir =
        PathResolver.getTranscriptFolderForWorkspace(workspacePath);
    return new TranscriptService(transcriptDir);
}
