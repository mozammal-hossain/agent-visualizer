import React, { useEffect, useState } from "react";
import { Session } from "./types";
import "./style.css";
import App from "./App";

function Root() {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        // Get initial session from window
        const initialSession = (window as any).__INITIAL_SESSION__;
        if (initialSession) {
            setSession(initialSession);
        }

        // Listen for messages from extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === "sessionData") {
                setSession(message.data);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (!session) {
        return <div className="loading">Loading session...</div>;
    }

    return <App session={session} />;
}

export default Root;
