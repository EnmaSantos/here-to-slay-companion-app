"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CircleMinus,
  CirclePlus,
  Crown,
  Hand,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Undo2,
  Users,
} from "lucide-react";
import {
  HERO_CLASSES,
  formatClassName,
  getUniqueClasses,
  type HeroClass,
} from "@/lib/game-engine";
import {
  getPlayerClassCount,
  useGameStore,
  type PlayerDraft,
} from "@/store/game-store";

type ClassPickerState = {
  playerId: string;
  mode: "play" | "correct";
} | null;

const DEFAULT_DRAFTS: PlayerDraft[] = [
  { name: "", leaderClass: "fighter" },
  { name: "", leaderClass: "wizard" },
];

export function LocalGame() {
  const [mounted, setMounted] = useState(false);
  const [drafts, setDrafts] = useState<PlayerDraft[]>(DEFAULT_DRAFTS);
  const [classTarget, setClassTarget] = useState(6);
  const [monsterTarget, setMonsterTarget] = useState(3);
  const [classPicker, setClassPicker] = useState<ClassPickerState>(null);

  const game = useGameStore();

  useEffect(() => setMounted(true), []);

  const activePlayer = useMemo(
    () => game.players.find((player) => player.id === game.activePlayerId),
    [game.players, game.activePlayerId],
  );
  const winner = useMemo(
    () => game.players.find((player) => player.id === game.winnerId),
    [game.players, game.winnerId],
  );

  if (!mounted) {
    return (
      <main className="game-loading" role="status">
        <span className="brand-mark"><Sparkles size={20} /></span>
        <p>Restoring your game…</p>
      </main>
    );
  }

  function updateDraft(index: number, patch: Partial<PlayerDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function addPlayer() {
    if (drafts.length >= 6) return;
    setDrafts((current) => [
      ...current,
      {
        name: "",
        leaderClass: HERO_CLASSES[current.length % HERO_CLASSES.length],
      },
    ]);
  }

  function removePlayer(index: number) {
    if (drafts.length <= 2) return;
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  }

  function startGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = drafts.map((draft, index) => ({
      ...draft,
      name: draft.name.trim() || `Player ${index + 1}`,
    }));
    game.startGame(cleaned, { classTarget, monsterTarget });
  }

  function chooseClass(heroClass: HeroClass) {
    if (!classPicker) return;
    if (classPicker.mode === "play") game.playHero(heroClass);
    else game.adjustHero(classPicker.playerId, heroClass, 1);
    setClassPicker(null);
  }

  if (game.phase === "setup") {
    return (
      <main className="setup-shell">
        <div className="setup-topbar">
          <Link href="/" className="icon-link" aria-label="Back to home">
            <ArrowLeft size={21} />
          </Link>
          <div className="setup-progress">
            <span className="is-current">1</span>
            <i />
            <span>2</span>
          </div>
          <Link href="/cards" className="icon-link" aria-label="Open card reference">
            <BookOpen size={20} />
          </Link>
        </div>

        <form className="setup-card" onSubmit={startGame}>
          <div className="eyebrow"><Users size={16} /> Local game</div>
          <h1>Gather your party.</h1>
          <p className="setup-intro">
            Add the players in turn order. This game stays on this device and is
            restored automatically if the page refreshes.
          </p>

          <div className="player-drafts">
            {drafts.map((draft, index) => (
              <div className="player-draft" key={index}>
                <span className="draft-number">{index + 1}</span>
                <label>
                  <span>Player name</span>
                  <input
                    value={draft.name}
                    onChange={(event) => updateDraft(index, { name: event.target.value })}
                    placeholder={`Player ${index + 1}`}
                    maxLength={24}
                  />
                </label>
                <label>
                  <span>Leader class</span>
                  <select
                    value={draft.leaderClass ?? ""}
                    onChange={(event) =>
                      updateDraft(index, {
                        leaderClass: event.target.value as HeroClass,
                      })
                    }
                  >
                    {HERO_CLASSES.map((heroClass) => (
                      <option value={heroClass} key={heroClass}>
                        {formatClassName(heroClass)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="draft-remove"
                  onClick={() => removePlayer(index)}
                  disabled={drafts.length <= 2}
                  aria-label={`Remove player ${index + 1}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-player"
            onClick={addPlayer}
            disabled={drafts.length >= 6}
          >
            <Plus size={19} /> Add player
          </button>

          <div className="victory-settings">
            <div>
              <span className="setting-icon"><Sparkles size={18} /></span>
              <label htmlFor="class-target">Unique classes to win</label>
              <select
                id="class-target"
                value={classTarget}
                onChange={(event) => setClassTarget(Number(event.target.value))}
              >
                {[5, 6, 7, 8].map((target) => (
                  <option value={target} key={target}>{target}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="setting-icon"><Trophy size={18} /></span>
              <label htmlFor="monster-target">Monsters to win</label>
              <select
                id="monster-target"
                value={monsterTarget}
                onChange={(event) => setMonsterTarget(Number(event.target.value))}
              >
                {[2, 3, 4, 5].map((target) => (
                  <option value={target} key={target}>{target}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="button button-primary setup-submit" type="submit">
            Start tracking <ChevronRight size={20} />
          </button>
          <p className="form-note">No account needed. Multiplayer rooms come next.</p>
        </form>
      </main>
    );
  }

  if (!activePlayer) return null;

  return (
    <main className="tracker-shell">
      <header className="tracker-header">
        <Link href="/" className="brand compact" aria-label="Slay Tracker home">
          <span className="brand-mark"><Sparkles size={16} /></span>
          <span>SLAY TRACKER</span>
        </Link>
        <div className="turn-label">
          <span>Local game</span>
          <strong>Turn {game.turnNumber}</strong>
        </div>
        <button className="icon-link" onClick={game.resetGame} aria-label="Reset game">
          <RotateCcw size={19} />
        </button>
      </header>

      {winner && (
        <section className="winner-banner" role="status">
          <div className="winner-crown"><Crown size={28} /></div>
          <div>
            <span>Victory!</span>
            <h1>{winner.name} wins the game.</h1>
            <p>
              {getPlayerClassCount(winner)} unique classes · {winner.monstersSlain} monsters
            </p>
          </div>
          <button className="button button-dark" onClick={game.resetGame}>New game</button>
        </section>
      )}

      <div className="tracker-layout">
        <div className="tracker-main">
          <section className="active-turn-card" style={{ "--player-color": activePlayer.color } as React.CSSProperties}>
            <div className="active-heading">
              <div className="player-avatar">{activePlayer.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <span>Current turn</span>
                <h1>{activePlayer.name}</h1>
              </div>
              <div className="action-points" aria-label={`${game.actionPoints} action points remaining`}>
                <span>Actions</span>
                <div>
                  {[0, 1, 2].map((point) => (
                    <i className={point < game.actionPoints ? "is-full" : ""} key={point} />
                  ))}
                </div>
                <strong>{game.actionPoints} / 3</strong>
              </div>
            </div>

            <div className="victory-progress">
              <div>
                <span><Sparkles size={17} /> Classes</span>
                <strong>{getPlayerClassCount(activePlayer)} <small>/ {game.classVictoryTarget}</small></strong>
                <div className="progress-track"><i style={{ width: `${Math.min(100, (getPlayerClassCount(activePlayer) / game.classVictoryTarget) * 100)}%` }} /></div>
              </div>
              <div>
                <span><Trophy size={17} /> Monsters</span>
                <strong>{activePlayer.monstersSlain} <small>/ {game.monsterVictoryTarget}</small></strong>
                <div className="progress-track monster"><i style={{ width: `${Math.min(100, (activePlayer.monstersSlain / game.monsterVictoryTarget) * 100)}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="quick-actions">
            <div className="section-heading">
              <div>
                <span className="eyebrow">One-tap actions</span>
                <h2>What happened?</h2>
              </div>
              <button className="undo-button" onClick={game.undo} disabled={game.history.length === 0}>
                <Undo2 size={18} /> Undo
              </button>
            </div>
            <div className="action-grid">
              <button onClick={game.drawCard} disabled={game.actionPoints < 1 || game.phase === "finished"}>
                <span className="action-icon lime"><Hand size={25} /></span>
                <span><strong>Draw a card</strong><small>Costs 1 action</small></span>
                <b>1</b>
              </button>
              <button
                onClick={() => setClassPicker({ playerId: activePlayer.id, mode: "play" })}
                disabled={game.actionPoints < 1 || game.phase === "finished"}
              >
                <span className="action-icon blue"><Shield size={25} /></span>
                <span><strong>Play a Hero</strong><small>Choose its class</small></span>
                <b>1</b>
              </button>
              <button onClick={game.attackMonster} disabled={game.actionPoints < 2 || game.phase === "finished"}>
                <span className="action-icon coral"><Swords size={25} /></span>
                <span><strong>Attack Monster</strong><small>Log the attempt</small></span>
                <b>2</b>
              </button>
              <button className="end-turn-action" onClick={game.endTurn} disabled={game.phase === "finished"}>
                <span className="action-icon ink"><ChevronRight size={25} /></span>
                <span><strong>End turn</strong><small>Pass to next player</small></span>
              </button>
            </div>
          </section>

          {classPicker && (
            <section className="class-picker" aria-label="Choose a Hero class">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Party update</span>
                  <h2>Choose the Hero class</h2>
                </div>
                <button className="text-button" onClick={() => setClassPicker(null)}>Cancel</button>
              </div>
              <div className="class-grid">
                {HERO_CLASSES.map((heroClass) => (
                  <button onClick={() => chooseClass(heroClass)} key={heroClass}>
                    <span>{formatClassName(heroClass).slice(0, 1)}</span>
                    {formatClassName(heroClass)}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="party-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Scoreboard</span>
                <h2>Every party at a glance</h2>
              </div>
            </div>
            <div className="party-grid">
              {game.players.map((player) => {
                const uniqueClasses = getUniqueClasses(player);
                const isActive = player.id === game.activePlayerId;
                return (
                  <article className={`party-card ${isActive ? "is-active" : ""}`} key={player.id}>
                    <div className="party-card-heading">
                      <span className="mini-avatar" style={{ background: player.color }}>{player.name.slice(0, 1).toUpperCase()}</span>
                      <div><h3>{player.name}</h3><p>{isActive ? "Taking a turn" : "Waiting"}</p></div>
                      {isActive && <span className="active-pill">Active</span>}
                    </div>
                    <div className="counter-row">
                      <div><span>Hand</span><strong>{player.handCount}</strong></div>
                      <div className="counter-buttons">
                        <button onClick={() => game.adjustHand(player.id, -1)} aria-label={`Remove one card from ${player.name}'s hand`}><CircleMinus size={20} /></button>
                        <button onClick={() => game.adjustHand(player.id, 1)} aria-label={`Add one card to ${player.name}'s hand`}><CirclePlus size={20} /></button>
                      </div>
                    </div>
                    <div className="counter-row">
                      <div><span>Monsters</span><strong>{player.monstersSlain} / {game.monsterVictoryTarget}</strong></div>
                      <div className="counter-buttons">
                        <button onClick={() => game.adjustMonsters(player.id, -1)} aria-label={`Remove one Monster from ${player.name}`}><CircleMinus size={20} /></button>
                        <button onClick={() => game.adjustMonsters(player.id, 1)} aria-label={`Add one Monster to ${player.name}`}><CirclePlus size={20} /></button>
                      </div>
                    </div>
                    <div className="party-classes">
                      <div className="party-class-label"><span>Classes · {uniqueClasses.length} / {game.classVictoryTarget}</span><button onClick={() => setClassPicker({ playerId: player.id, mode: "correct" })}><Plus size={15} /> Add</button></div>
                      <div className="class-chips">
                        {player.leaderClass && <span className="leader-chip"><Crown size={12} /> {formatClassName(player.leaderClass)}</span>}
                        {HERO_CLASSES.filter((heroClass) => (player.heroClassCounts[heroClass] ?? 0) > 0).map((heroClass) => (
                          <button
                            key={heroClass}
                            onClick={() => game.adjustHero(player.id, heroClass, -1)}
                            title={`Remove one ${formatClassName(heroClass)} Hero`}
                          >
                            {formatClassName(heroClass)} ×{player.heroClassCounts[heroClass]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="activity-panel">
          <div className="section-heading">
            <div><span className="eyebrow">Game log</span><h2>Recent activity</h2></div>
          </div>
          <ol>
            {game.events.map((event, index) => (
              <li key={event.id}>
                <i className={index === 0 ? "is-latest" : ""} />
                <div><p>{event.message}</p><span>Turn {event.turn}</span></div>
              </li>
            ))}
          </ol>
          <Link href="/cards" className="activity-reference">
            <BookOpen size={20} />
            <span><strong>Need a ruling?</strong><small>Search the card reference</small></span>
            <ChevronRight size={18} />
          </Link>
        </aside>
      </div>
    </main>
  );
}
