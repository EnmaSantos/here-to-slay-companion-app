"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  canSpendActionPoints,
  getNextPlayerId,
  getUniqueClasses,
  hasPlayerWon,
  updateNonNegativeCount,
  type HeroClass,
} from "@/lib/game-engine";

export type Player = {
  id: string;
  name: string;
  color: string;
  leaderClass: HeroClass | null;
  handCount: number;
  monstersSlain: number;
  heroClassCounts: Partial<Record<HeroClass, number>>;
};

export type PlayerDraft = Pick<Player, "name" | "leaderClass">;

export type GameEvent = {
  id: string;
  message: string;
  turn: number;
  createdAt: string;
};

type GamePhase = "setup" | "active" | "finished";

type Snapshot = {
  phase: GamePhase;
  players: Player[];
  activePlayerId: string | null;
  actionPoints: number;
  turnNumber: number;
  winnerId: string | null;
  events: GameEvent[];
};

type GameState = {
  phase: GamePhase;
  players: Player[];
  activePlayerId: string | null;
  actionPoints: number;
  turnNumber: number;
  classVictoryTarget: number;
  monsterVictoryTarget: number;
  winnerId: string | null;
  events: GameEvent[];
  history: Snapshot[];
};

type GameActions = {
  startGame: (
    players: PlayerDraft[],
    settings: { classTarget: number; monsterTarget: number },
  ) => void;
  drawCard: () => void;
  playHero: (heroClass: HeroClass) => void;
  attackMonster: () => void;
  adjustHand: (playerId: string, delta: number) => void;
  adjustHero: (
    playerId: string,
    heroClass: HeroClass,
    delta: number,
  ) => void;
  adjustMonsters: (playerId: string, delta: number) => void;
  endTurn: () => void;
  undo: () => void;
  resetGame: () => void;
};

const PLAYER_COLORS = [
  "#d7ff63",
  "#ff7566",
  "#62c8ff",
  "#d89cff",
  "#ffca56",
  "#79e5bd",
];

const initialState: GameState = {
  phase: "setup",
  players: [],
  activePlayerId: null,
  actionPoints: 3,
  turnNumber: 1,
  classVictoryTarget: 6,
  monsterVictoryTarget: 3,
  winnerId: null,
  events: [],
  history: [],
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapshot(state: GameState): Snapshot {
  return {
    phase: state.phase,
    players: state.players,
    activePlayerId: state.activePlayerId,
    actionPoints: state.actionPoints,
    turnNumber: state.turnNumber,
    winnerId: state.winnerId,
    events: state.events,
  };
}

function createEvent(message: string, turn: number): GameEvent {
  return {
    id: makeId("event"),
    message,
    turn,
    createdAt: new Date().toISOString(),
  };
}

function withVictoryCheck(
  state: GameState,
  players: Player[],
): Pick<GameState, "players" | "phase" | "winnerId"> {
  const winner = players.find((player) =>
    hasPlayerWon(player, {
      classVictoryTarget: state.classVictoryTarget,
      monsterVictoryTarget: state.monsterVictoryTarget,
    }),
  );

  return {
    players,
    phase: winner ? "finished" : state.phase,
    winnerId: winner?.id ?? null,
  };
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set) => ({
      ...initialState,

      startGame: (playerDrafts, settings) =>
        set(() => {
          const players = playerDrafts.map((draft, index) => ({
            id: makeId("player"),
            name: draft.name.trim(),
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            leaderClass: draft.leaderClass,
            handCount: 5,
            monstersSlain: 0,
            heroClassCounts: {},
          }));

          return {
            ...initialState,
            phase: "active" as const,
            players,
            activePlayerId: players[0]?.id ?? null,
            classVictoryTarget: settings.classTarget,
            monsterVictoryTarget: settings.monsterTarget,
            events: [createEvent("The game has begun.", 1)],
          };
        }),

      drawCard: () =>
        set((state) => {
          if (
            state.phase !== "active" ||
            !state.activePlayerId ||
            !canSpendActionPoints(state.actionPoints, 1)
          ) {
            return state;
          }

          const active = state.players.find(
            (player) => player.id === state.activePlayerId,
          );
          const players = state.players.map((player) =>
            player.id === state.activePlayerId
              ? { ...player, handCount: player.handCount + 1 }
              : player,
          );

          return {
            players,
            actionPoints: state.actionPoints - 1,
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(`${active?.name ?? "Player"} drew a card.`, state.turnNumber),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      playHero: (heroClass) =>
        set((state) => {
          if (
            state.phase !== "active" ||
            !state.activePlayerId ||
            !canSpendActionPoints(state.actionPoints, 1)
          ) {
            return state;
          }

          const active = state.players.find(
            (player) => player.id === state.activePlayerId,
          );
          const players = state.players.map((player) =>
            player.id === state.activePlayerId
              ? {
                  ...player,
                  heroClassCounts: {
                    ...player.heroClassCounts,
                    [heroClass]: (player.heroClassCounts[heroClass] ?? 0) + 1,
                  },
                }
              : player,
          );

          return {
            ...withVictoryCheck(state, players),
            actionPoints: state.actionPoints - 1,
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(
                `${active?.name ?? "Player"} played a ${heroClass} Hero.`,
                state.turnNumber,
              ),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      attackMonster: () =>
        set((state) => {
          if (
            state.phase !== "active" ||
            !state.activePlayerId ||
            !canSpendActionPoints(state.actionPoints, 2)
          ) {
            return state;
          }

          const active = state.players.find(
            (player) => player.id === state.activePlayerId,
          );
          return {
            actionPoints: state.actionPoints - 2,
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(
                `${active?.name ?? "Player"} started a Monster attack.`,
                state.turnNumber,
              ),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      adjustHand: (playerId, delta) =>
        set((state) => {
          const player = state.players.find((item) => item.id === playerId);
          if (!player || (delta < 0 && player.handCount === 0)) return state;
          const players = state.players.map((item) =>
            item.id === playerId
              ? {
                  ...item,
                  handCount: updateNonNegativeCount(item.handCount, delta),
                }
              : item,
          );

          return {
            players,
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(
                `${player.name}'s hand count was corrected.`,
                state.turnNumber,
              ),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      adjustHero: (playerId, heroClass, delta) =>
        set((state) => {
          const player = state.players.find((item) => item.id === playerId);
          const current = player?.heroClassCounts[heroClass] ?? 0;
          if (!player || (delta < 0 && current === 0)) return state;

          const players = state.players.map((item) =>
            item.id === playerId
              ? {
                  ...item,
                  heroClassCounts: {
                    ...item.heroClassCounts,
                    [heroClass]: updateNonNegativeCount(current, delta),
                  },
                }
              : item,
          );

          return {
            ...withVictoryCheck(state, players),
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(
                `${player.name}'s ${heroClass} count was corrected.`,
                state.turnNumber,
              ),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      adjustMonsters: (playerId, delta) =>
        set((state) => {
          const player = state.players.find((item) => item.id === playerId);
          if (!player || (delta < 0 && player.monstersSlain === 0)) return state;

          const players = state.players.map((item) =>
            item.id === playerId
              ? {
                  ...item,
                  monstersSlain: updateNonNegativeCount(
                    item.monstersSlain,
                    delta,
                  ),
                }
              : item,
          );

          return {
            ...withVictoryCheck(state, players),
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(
                delta > 0
                  ? `${player.name} marked a Monster slain!`
                  : `${player.name}'s Monster count was corrected.`,
                state.turnNumber,
              ),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      endTurn: () =>
        set((state) => {
          if (state.phase !== "active") return state;
          const nextPlayerId = getNextPlayerId(
            state.players,
            state.activePlayerId,
          );
          const nextPlayer = state.players.find(
            (player) => player.id === nextPlayerId,
          );

          return {
            activePlayerId: nextPlayerId,
            actionPoints: 3,
            turnNumber: state.turnNumber + 1,
            history: [...state.history, snapshot(state)].slice(-50),
            events: [
              createEvent(
                `${nextPlayer?.name ?? "Next player"}'s turn started.`,
                state.turnNumber + 1,
              ),
              ...state.events,
            ].slice(0, 30),
          };
        }),

      undo: () =>
        set((state) => {
          const previous = state.history.at(-1);
          if (!previous) return state;
          return {
            ...previous,
            history: state.history.slice(0, -1),
          };
        }),

      resetGame: () => set(() => ({ ...initialState })),
    }),
    {
      name: "slay-tracker-game-v1",
      partialize: (state) => ({
        phase: state.phase,
        players: state.players,
        activePlayerId: state.activePlayerId,
        actionPoints: state.actionPoints,
        turnNumber: state.turnNumber,
        classVictoryTarget: state.classVictoryTarget,
        monsterVictoryTarget: state.monsterVictoryTarget,
        winnerId: state.winnerId,
        events: state.events,
        history: state.history,
      }),
    },
  ),
);

export function getPlayerClassCount(player: Player): number {
  return getUniqueClasses(player).length;
}
