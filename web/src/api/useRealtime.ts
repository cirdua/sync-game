import { useEffect, useRef, useState } from "react";
import { BroadcastMessage } from "./types";

// Connects to Web PubSub using the json.webpubsub.azure.v1 subprotocol and joins
// the session group. The server publishes ONCE to the group; this client just
// receives the fan-out. Auto-reconnects on socket drop (mobile networks).
//
// We use the subprotocol so the service understands "joinGroup" system messages
// and delivers group data messages as { type: "message", group, data }.

type Status = "connecting" | "connected" | "disconnected";

interface Options {
  /** group-scoped client URL from /join (wpsUrl) or /negotiate. */
  url: string | null;
  /** session code -> group name "session-CODE". */
  sessionCode: string | null;
  onMessage: (msg: BroadcastMessage) => void;
}

export function useRealtime({ url, sessionCode, onMessage }: Options): Status {
  const [status, setStatus] = useState<Status>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const closedByUs = useRef(false);
  const retryRef = useRef(0);

  // Keep latest callback without resubscribing the socket.
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url || !sessionCode) return;
    closedByUs.current = false;
    let reconnectTimer: number | undefined;

    const group = `session-${sessionCode}`;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(url, "json.webpubsub.azure.v1");
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("connected");
        // Join the session group so we receive its fan-out.
        ws.send(
          JSON.stringify({
            type: "joinGroup",
            group,
            ackId: 1,
          }),
        );
      };

      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          // Group data arrives as { type: "message", from: "group", group, data }.
          if (parsed.type === "message" && parsed.data) {
            const payload =
              typeof parsed.data === "string"
                ? JSON.parse(parsed.data)
                : parsed.data;
            onMessageRef.current(payload as BroadcastMessage);
          }
        } catch {
          // ignore non-JSON / ack frames
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (closedByUs.current) return;
        // Exponential-ish backoff, capped — survives flaky room wifi.
        const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
        retryRef.current += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closedByUs.current = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [url, sessionCode]);

  return status;
}
