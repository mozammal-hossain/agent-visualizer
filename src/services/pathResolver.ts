import * as os from "os";
import * as path from "path";

export class PathResolver {
    /**
     * Derive the Cursor agent transcripts folder from a workspace path
     * Example: /Users/bs1101/Personal/1.projects/foo -> ~/.cursor/projects/Users-bs1101-Personal-1-projects-foo/agent-transcripts/
     */
    static getTranscriptFolderForWorkspace(workspacePath: string): string {
        // Convert path to slug: replace / with -, strip leading -
        const slug = workspacePath
            .split(path.sep)
            .filter((part) => part.length > 0)
            .join("-");

        const cursorProjectsDir = path.join(
            os.homedir(),
            ".cursor",
            "projects",
            slug,
            "agent-transcripts"
        );

        return cursorProjectsDir;
    }

    /**
     * Get the Cursor data directory
     */
    static getCursorDataDir(): string {
        return path.join(os.homedir(), ".cursor");
    }
}
