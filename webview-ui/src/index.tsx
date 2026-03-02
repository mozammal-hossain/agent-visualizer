import React, { Component, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Session } from "./types";
import { SessionStatus } from "./utils/activityStatus";
import { playTurnCompleteChime } from "./utils/sound";
import "./style.css";
import App from "./App";

class ErrorBoundary extends Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    state = { hasError: false, error: undefined as Error | undefined };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError && this.state.error) {
            return (
                <div className="loading" style={{ flexDirection: "column", gap: "8px" }}>
                    <strong>Something went wrong</strong>
                    <span style={{ fontSize: "12px", maxWidth: "80%", textAlign: "center" }}>
                        {this.state.error.message}
                    </span>
                </div>
            );
        }
        return this.props.children;
    }
}

function isAssistantTurnComplete(session: Session): boolean {
    if ((session.messages?.length ?? 0) === 0) return false;
    const last = session.messages[session.messages.length - 1];
    if (last.role !== "assistant") return false;
    if ((last.toolCalls?.length ?? 0) === 0) return true;
    return (last.toolCalls ?? []).every((tc) => tc.hasResult);
}

function Root() {
    const [session, setSession] = useState<Session | null>(null);
    const [statusOverride, setStatusOverride] = useState<SessionStatus | null>(null);
    const prevMessageCountRef = useRef<number>(0);
    const playSoundEnabledRef = useRef<boolean>(false);

    useEffect(() => {
        const rawSession = window.__INITIAL_SESSION__;
        const initialSession: Session | null =
            rawSession !== undefined &&
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
        const api =
            typeof window.acquireVsCodeApi === "function"
                ? window.acquireVsCodeApi()
                : null;
        window.__vscodeApi = api;

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (
                typeof message !== "object" ||
                message === null ||
                typeof message.type !== "string"
            ) {
                return;
            }
            if (message.type === "sessionData") {
                const candidate = message.data;
                if (
                    typeof candidate !== "object" ||
                    candidate === null ||
                    typeof candidate.id !== "string" ||
                    !Array.isArray(candidate.messages)
                ) {
                    return;
                }
                const newSession = candidate as Session;
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

    return (
        <App
            session={session}
            statusOverride={statusOverride}
        />
    );
}

const rootEl = document.getElementById("root");
if (rootEl) {
    createRoot(rootEl).render(
        <ErrorBoundary>
            <Root />
        </ErrorBoundary>
    );
}

export default Root;
