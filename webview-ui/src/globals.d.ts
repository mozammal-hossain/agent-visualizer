import type { Session } from "./types";

interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

interface WebkitWindow {
    webkitAudioContext?: typeof AudioContext;
}

interface AgentVisualizerGlobals {
    __INITIAL_SESSION__?: Session;
    __PLAY_SOUND_ENABLED__?: boolean;
    __INITIAL_TAB__?: string;
    __INITIAL_THEME__?: string;
    __vscodeApi?: VsCodeApi | null;
    acquireVsCodeApi?(): VsCodeApi;
}

declare global {
    interface Window extends AgentVisualizerGlobals, WebkitWindow {}
}
