"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView } from "./generated/RoomView";
import type { RoomSettings } from "./generated/RoomSettings";
import type { GameCommand } from "./generated/GameCommand";

export const API_BASE = (process.env.NEXT_PUBLIC_GAME_API_URL ?? "").replace(
  /\/$/,
  "",
);
const SESSION_KEY = "slay-table-session-v1";
type Seat = { code: string; token: string };

async function request<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "The table is unavailable. Check your connection and try again.";
    throw new Error(message);
  }
  return data as T;
}

export function useRoom() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const update = useCallback((next: RoomView) => {
    setRoom((current) =>
      current?.code === next.code && current.version > next.version
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function health() {
      try {
        await request("/health");
        if (!cancelled) setServerOnline(true);
      } catch {
        if (!cancelled) setServerOnline(false);
      }
    }
    void health();
    const timer = setInterval(health, 15000);
    const code = new URLSearchParams(window.location.search).get("room") ?? "";
    setInviteCode(code);
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Seat;
        if (
          /^[A-F0-9]{8}$/.test(parsed.code) &&
          /^[a-f0-9]{64}$/.test(parsed.token) &&
          (!code || code.toUpperCase() === parsed.code)
        ) {
          setSeat(parsed);
          request<RoomView>(`/rooms/${parsed.code}`, undefined, parsed.token)
            .then((next) => {
              if (!cancelled) update(next);
            })
            .catch((e) => {
              if (!cancelled) setError(e.message);
            });
        }
      }
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [update]);

  useEffect(() => {
    if (!seat || !room || seat.code !== room.code) return;
    let cancelled = false;
    let socket: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    function connect() {
      if (cancelled) return;
      const url = new URL(
        `${API_BASE || window.location.origin}/api/rooms/${seat!.code}/ws`,
      );
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);
      socket.onopen = () => {
        attempt = 0;
        socket?.send(
          JSON.stringify({ type: "authenticate", token: seat!.token }),
        );
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "snapshot") {
            setConnected(true);
            update(data.room as RoomView);
          }
        } catch {
          /* Ignore malformed transport frames; HTTP can restore the snapshot. */
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!cancelled)
          reconnect = setTimeout(
            connect,
            Math.min(1000 * 2 ** attempt++, 10000),
          );
      };
      socket.onerror = () => socket?.close();
    }
    connect();
    // Reconcile on focus, including messages missed while a phone was asleep.
    const resume = () => {
      if (!document.hidden)
        void request<RoomView>(`/rooms/${seat.code}`, undefined, seat.token)
          .then(update)
          .catch(() => {});
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      clearTimeout(reconnect);
      socket?.close();
      setConnected(false);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [seat, room?.code, update]);

  async function enter(
    code: string | null,
    name: string,
    settings?: RoomSettings,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = code
        ? await request<{ token: string; room: RoomView }>(
            `/rooms/${encodeURIComponent(code.toUpperCase())}/join`,
            { name },
          )
        : await request<{ token: string; room: RoomView }>("/rooms", {
            name,
            settings,
          });
      const nextSeat = { code: result.room.code, token: result.token };
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSeat));
      } catch {
        /* The live seat still works. */
      }
      setSeat(nextSeat);
      update(result.room);
      window.history.replaceState(null, "", `?room=${result.room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open this table.");
    } finally {
      setBusy(false);
    }
  }

  async function command(command: GameCommand) {
    const current = roomRef.current;
    if (!current || !seat || busy) return;
    setBusy(true);
    setError("");
    try {
      update(
        await request<RoomView>(
          `/rooms/${seat.code}/commands`,
          {
            requestId: crypto.randomUUID(),
            expectedVersion: current.version,
            command,
          },
          seat.token,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That action could not be completed.",
      );
      try {
        update(
          await request<RoomView>(`/rooms/${seat.code}`, undefined, seat.token),
        );
      } catch {
        /* Preserve the last valid state. */
      }
    } finally {
      setBusy(false);
    }
  }

  function home() {
    setRoom(null);
    setInviteCode("");
    setError("");
    window.history.replaceState(null, "", window.location.pathname);
  }
  async function resume() {
    if (seat) {
      setError("");
      try {
        update(
          await request<RoomView>(`/rooms/${seat.code}`, undefined, seat.token),
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to restore the table.",
        );
      }
    }
  }

  return {
    room,
    seat,
    busy,
    error,
    setError,
    connected,
    serverOnline,
    inviteCode,
    enter,
    command,
    home,
    resume,
  };
}
