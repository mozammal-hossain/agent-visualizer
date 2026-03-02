import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { playTurnCompleteChime } from "./utils/sound";
import "./style.css";
import App from "./App";
function isAssistantTurnComplete(session) {
    if (session.messages.length === 0)
        return false;
    const last = session.messages[session.messages.length - 1];
    if (last.role !== "assistant")
        return false;
    if (last.toolCalls.length === 0)
        return true;
    return last.toolCalls.every((tc) => tc.hasResult);
}
function Root() {
    const [session, setSession] = useState(null);
    const [statusOverride, setStatusOverride] = useState(null);
    const prevMessageCountRef = useRef(0);
    const playSoundEnabledRef = useRef(false);
    const [themeMode, setThemeMode] = useState("auto");
    const [baseTheme, setBaseTheme] = useState("dark");
    useEffect(() => {
        const rawSession = window.__INITIAL_SESSION__;
        const initialSession = rawSession !== undefined &&
            rawSession !== null &&
            typeof rawSession === "object" &&
            typeof rawSession.id === "string" &&
            Array.isArray(rawSession.messages)
            ? rawSession
            : null;
        if (initialSession) {
            setSession(initialSession);
            prevMessageCountRef.current = initialSession.messages?.length ?? 0;
        }
        playSoundEnabledRef.current = window.__PLAY_SOUND_ENABLED__ === true;
        const api = typeof window.acquireVsCodeApi === "function"
            ? window.acquireVsCodeApi()
            : null;
        window.__vscodeApi = api;
        const initialTheme = window.__INITIAL_THEME__ === "light" ? "light" : "dark";
        setBaseTheme(initialTheme);
        if (api && typeof api.getState === "function") {
            const persisted = api.getState();
            if (persisted?.themeMode === "auto" ||
                persisted?.themeMode === "light" ||
                persisted?.themeMode === "dark") {
                setThemeMode(persisted.themeMode);
            }
        }
        const handleMessage = (event) => {
            const message = event.data;
            if (typeof message !== "object" ||
                message === null ||
                typeof message.type !== "string") {
                return;
            }
            if (message.type === "sessionData") {
                const candidate = message.data;
                if (typeof candidate !== "object" ||
                    candidate === null ||
                    typeof candidate.id !== "string" ||
                    !Array.isArray(candidate.messages)) {
                    return;
                }
                const newSession = candidate;
                const prevCount = prevMessageCountRef.current;
                const newCount = newSession.messages?.length ?? 0;
                if (playSoundEnabledRef.current &&
                    newCount > prevCount &&
                    isAssistantTurnComplete(newSession)) {
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
        return _jsx("div", { className: "loading", children: "Loading session..." });
    }
    const resolvedTheme = themeMode === "auto" ? baseTheme : themeMode;
    const handleThemeModeChange = (next) => {
        setThemeMode(next);
        const api = window.__vscodeApi;
        if (api) {
            const prev = api.getState() ?? {};
            api.setState({ ...prev, themeMode: next });
        }
    };
    return (_jsx(App, { session: session, statusOverride: statusOverride, themeMode: themeMode, resolvedTheme: resolvedTheme, onThemeModeChange: handleThemeModeChange }));
}
export default Root;
