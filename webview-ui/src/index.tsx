import React, { useEffect, useRef, useState } from "react";
import { Session } from "./types";
import { SessionStatus } from "./utils/activityStatus";
import { playTurnCompleteChime } from "./utils/sound";
import "./style.css";
import App from "./App";
import { ThemeMode, ResolvedTheme } from "./theme";

function isAssistantTurnComplete(session: Session): boolean {
    if (session.messages.length === 0) return false;
    const last = session.messages[session.messages.length - 1];
    if (last.role !== "assistant") return false;
    if (last.toolCalls.length === 0) return true;
    return last.toolCalls.every((tc) => tc.hasResult);
}

function Root() {
    const [session, setSession] = useState<Session | null>(null);
    const [statusOverride, setStatusOverride] = useState<SessionStatus | null>(null);
    const prevMessageCountRef = useRef<number>(0);
    const playSoundEnabledRef = useRef<boolean>(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
    const [baseTheme, setBaseTheme] = useState<ResolvedTheme>("dark");

    useEffect(() => {
        const initialSession = (window as any).__INITIAL_SESSION__;
        if (initialSession) {
            setSession(initialSession);
            prevMessageCountRef.current = initialSession.messages?.length ?? 0;
        }
        playSoundEnabledRef.current = (window as any).__PLAY_SOUND_ENABLED__ === true;
        const api =
            typeof (window as any).acquireVsCodeApi === "function"
                ? (window as any).acquireVsCodeApi()
                : null;
        (window as any).__vscodeApi = api;

        const initialTheme = (window as any).__INITIAL_THEME__ === "light" ? "light" : "dark";
        setBaseTheme(initialTheme);

        if (api && typeof api.getState === "function") {
            const persisted = api.getState() as { themeMode?: ThemeMode } | undefined;
            if (
                persisted?.themeMode === "auto" ||
                persisted?.themeMode === "light" ||
                persisted?.themeMode === "dark"
            ) {
                setThemeMode(persisted.themeMode);
            }
        }

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === "sessionData") {
                const newSession = message.data as Session;
                const prevCount = prevMessageCountRef.current;
                const newCount = newSession.messages?.length ?? 0;
                if (
                    playSoundEnabledRef.current &&
                    newCount > prevCount &&
                    isAssistantTurnComplete(newSession)
                ) {
                    playTurnCompleteChime();
                }
                prevMessageCountRef.current = newCount;
                setSession(newSession);
                setStatusOverride(null);
            }
            if (message.type === "sessionStatus") {
                setStatusOverride(message.status ?? null);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (!session) {
        return <div className="loading">Loading session...</div>;
    }

    const resolvedTheme: ResolvedTheme =
        themeMode === "auto" ? baseTheme : themeMode;

    const handleThemeModeChange = (next: ThemeMode) => {
        setThemeMode(next);
        const api = (window as any).__vscodeApi;
        if (api && typeof api.setState === "function") {
            const prev = (typeof api.getState === "function" ? api.getState() : {}) ?? {};
            api.setState({ ...prev, themeMode: next });
        }
    };

    return (
        <App
            session={session}
            statusOverride={statusOverride}
            themeMode={themeMode}
            resolvedTheme={resolvedTheme}
            onThemeModeChange={handleThemeModeChange}
        />
    );
}

export default Root;
