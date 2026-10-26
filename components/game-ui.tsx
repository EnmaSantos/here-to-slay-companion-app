"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Dice5,
  Hand,
  Hourglass,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  CARD_BY_SLUG,
  GAME_CARDS,
  SETS,
  inventory,
  title,
} from "@/lib/game-catalog";
import { useRoom } from "@/lib/use-room";
import type { Card } from "@/lib/generated/Card";
import type { RoomSettings } from "@/lib/generated/RoomSettings";
import type { RoomView } from "@/lib/generated/RoomView";
import type { GameCommand } from "@/lib/generated/GameCommand";

type Command = (command: GameCommand) => Promise<void>;
const DEFAULTS: RoomSettings = {
  playerCount: 2,
  expansions: [],
  preset: "standard",
  classTarget: 6,
  monsterTarget: 3,
};
const CLASS_MARKS: Record<string, string> = {
  bard: "♫",
  fighter: "✦",
  guardian: "✥",
  ranger: "➶",
  thief: "♠",
  wizard: "✧",
  warrior: "⚔",
  druid: "❧",
  berserker: "✹",
  necromancer: "☽",
};
const ART_CLASSES = [
  "fighter",
  "guardian",
  "ranger",
  "wizard",
  "thief",
  "bard",
  "warrior",
  "druid",
  "berserker",
  "necromancer",
];

function CardArtwork({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  let index = ART_CLASSES.indexOf(card.classes[0]);
  if (index < 0)
    index =
      card.type === "monster"
        ? 10 + ([...card.slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 3)
        : ["modifier", "challenge"].includes(card.type)
          ? 14
          : 13;
  // The wiki currently rejects image requests. Preserve its URLs and opt back in
  // when source artwork becomes reachable; never show a broken image as a card.
  const useSource = process.env.NEXT_PUBLIC_USE_SOURCE_ART === "1";
  return (
    <span className="card-artwork">
      <span
        className="atlas-portrait"
        style={{
          backgroundPosition: `${(index % 5) * 25}% ${Math.floor(index / 5) * 50}%`,
        }}
      />
      <span className="art-credit">PREVIEW ART</span>
      <span className="art-name">{card.name}</span>
      <span className="art-type">{title(card.classes[0] ?? card.type)}</span>
      {useSource && card.imageUrl && !failed ? (
        <img
          className="source-card-art"
          src={card.imageUrl}
          alt={card.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

export function ClassMark({ value }: { value: string }) {
  return (
    <span className={`class-mark class-${value}`} aria-label={title(value)}>
      {CLASS_MARKS[value] ?? "✧"}
    </span>
  );
}

function useChime() {
  const [muted, setMuted] = useState(true);
  const context = useRef<AudioContext | null>(null);
  function chime(kind = "click") {
    if (muted) return;
    const audio = context.current ?? (context.current = new AudioContext());
    void audio.resume();
    const note = audio.createOscillator();
    const gain = audio.createGain();
    note.type = "sine";
    note.frequency.setValueAtTime(
      kind === "roll" ? 330 : 660,
      audio.currentTime,
    );
    note.frequency.exponentialRampToValueAtTime(
      kind === "roll" ? 880 : 440,
      audio.currentTime + 0.18,
    );
    gain.gain.setValueAtTime(0.045, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
    note.connect(gain);
    gain.connect(audio.destination);
    note.start();
    note.stop(audio.currentTime + 0.3);
  }
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  return { muted, toggle: () => setMuted((v) => !v), chime };
}

function Dialog({
  children,
  onClose,
  label,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </dialog>
  );
}

export function GameCard({
  card,
  onClick,
  small = false,
}: {
  card: Card;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <button
      className={`game-card ${small ? "small-card" : ""}`}
      onClick={onClick}
      aria-label={`Inspect ${card.name}`}
    >
      <div className="card-image">
        <CardArtwork card={card} />
      </div>
      <span className="card-caption">
        <strong>{card.name}</strong>
        <span>
          {card.classes[0] ? title(card.classes[0]) : title(card.type)}
        </span>
      </span>
    </button>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} />
        </button>
        <strong>{value}</strong>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function Settings({
  value,
  onChange,
  minPlayers = 2,
}: {
  value: RoomSettings;
  onChange: (s: RoomSettings) => void;
  minPlayers?: number;
}) {
  const counts = inventory(value.expansions);
  const update = (patch: Partial<RoomSettings>) =>
    onChange({ ...value, ...patch });
  function toggle(id: string) {
    const expansions = value.expansions.includes(id)
      ? value.expansions.filter((s) => s !== id)
      : [...value.expansions, id];
    update({
      expansions,
      classTarget: Math.min(value.classTarget, 6 + expansions.length * 2),
      monsterTarget: Math.min(value.monsterTarget, 15 + expansions.length * 2),
    });
  }
  return (
    <div className="settings-fields">
      <Stepper
        label="Players at the table"
        value={value.playerCount}
        min={minPlayers}
        max={6}
        onChange={(playerCount) => update({ playerCount })}
      />
      <div>
        <div className="field-label">Set your pace</div>
        <div className="pace-options">
          {[
            { id: "quick", name: "Quick", time: "60 sec", icon: Zap },
            {
              id: "standard",
              name: "Standard",
              time: "120 sec",
              icon: Hourglass,
            },
          ].map((p) => (
            <button
              type="button"
              key={p.id}
              className={value.preset === p.id ? "selected" : ""}
              onClick={() => update({ preset: p.id })}
            >
              <p.icon size={17} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.time} turns</small>
              </span>
              {value.preset === p.id ? <Check size={15} /> : null}
            </button>
          ))}
        </div>
        <p className="field-hint">
          Challenges: 10s · Modifiers: {value.preset === "quick" ? "5s" : "10s"}{" "}
          · Everyone can pass early
        </p>
      </div>
      <div>
        <div className="field-label">
          A bigger adventure <span>Optional expansions</span>
        </div>
        <div className="expansion-options">
          {SETS.map((set) => (
            <button
              type="button"
              key={set.id}
              aria-pressed={value.expansions.includes(set.id)}
              className={value.expansions.includes(set.id) ? "selected" : ""}
              onClick={() => toggle(set.id)}
            >
              <span className="expansion-symbols">
                {set.classes.map((c) => (
                  <ClassMark key={c} value={c} />
                ))}
              </span>
              <span>
                <strong>{set.name}</strong>
                <small>31 cards · 2 monsters · 2 leaders</small>
              </span>
              <span className="checkbox">
                {value.expansions.includes(set.id) ? <Check size={12} /> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="victory-settings">
        <Stepper
          label="Classes to win"
          value={value.classTarget}
          min={6}
          max={6 + value.expansions.length * 2}
          onChange={(classTarget) => update({ classTarget })}
        />
        <Stepper
          label="Monsters to slay"
          value={value.monsterTarget}
          min={3}
          max={counts.monsters}
          onChange={(monsterTarget) => update({ monsterTarget })}
        />
      </div>
      <div className="inventory-strip">
        <Layers3 size={14} />
        <strong>{counts.main}</strong> deck cards<span>·</span>
        <strong>{counts.monsters}</strong> monsters<span>·</span>
        <strong>{counts.leaders}</strong> leaders
      </div>
    </div>
  );
}

function CardDetail({ card, close }: { card: Card; close: () => void }) {
  return (
    <Dialog label={card.name} onClose={close}>
      <div className="card-detail">
        <div className="detail-art">
          <CardArtwork card={card} />
        </div>
        <span className="eyebrow">
          {title(card.type)}
          {card.classes[0] ? ` · ${title(card.classes[0])}` : ""}
        </span>
        <h2>{card.name}</h2>
        {card.rollRequirement ? (
          <span className="roll-requirement">
            <Dice5 size={16} /> Roll {card.rollRequirement}
          </span>
        ) : null}
        <p>
          {card.effect ?? "Inspect this card’s printed rules before playing."}
        </p>
        {card.rules.map((rule) => (
          <p className="card-rule" key={rule}>
            {rule}
          </p>
        ))}
      </div>
    </Dialog>
  );
}

function Library({
  close,
  inspect,
}: {
  close: () => void;
  inspect: (c: Card) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const cards = GAME_CARDS.filter(
    (c) =>
      (filter === "all" || c.type === filter) &&
      `${c.name} ${c.effect ?? ""} ${c.classes.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Dialog label="Card library" onClose={close} wide>
      <span className="eyebrow">Know your party</span>
      <h2>The card library</h2>
      <p className="muted">
        Base game and both expansions. Every adventure starts with the right
        company.
      </p>
      <div className="library-controls">
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a hero, monster, or spell…"
            aria-label="Search the card library"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by card type"
        >
          <option value="all">All cards</option>
          {[
            "hero",
            "party-leader",
            "monster",
            "item",
            "magic",
            "modifier",
            "challenge",
          ].map((t) => (
            <option value={t} key={t}>
              {title(t)}
            </option>
          ))}
        </select>
      </div>
      <div className="library-count">{cards.length} unique cards</div>
      <div className="library-grid">
        {cards.map((c) => (
          <GameCard key={c.slug} card={c} onClick={() => inspect(c)} small />
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="empty-message">No cards found. Try another search.</p>
      ) : null}
    </Dialog>
  );
}

function HowToPlay({ close }: { close: () => void }) {
  return (
    <Dialog label="How to play" onClose={close}>
      <span className="eyebrow">An adventure in good company</span>
      <h2>
        A little strategy.
        <br />A little sabotage.
      </h2>
      <div className="rules-list">
        <div>
          <Dice5 />
          <section>
            <h3>Roll for your leader</h3>
            <p>
              Everyone rolls two dice. High rolls pick first. Ties reroll inside
              their own group. The last picker takes the first turn.
            </p>
          </section>
        </div>
        <div>
          <Hand />
          <section>
            <h3>Three actions. Your move.</h3>
            <p>
              Draw or play a card for one action, attack a monster for two, or
              refresh your hand for three. The turn clock pauses for reactions.
            </p>
          </section>
        </div>
        <div>
          <Shield />
          <section>
            <h3>Keep your enemies close</h3>
            <p>
              Challenge a play within 10 seconds. Modifiers get 5 seconds in
              Quick and 10 in Standard. Everyone passing ends the wait early.
            </p>
          </section>
        </div>
        <div>
          <Trophy />
          <section>
            <h3>Build a party or slay monsters</h3>
            <p>
              The host sets the targets. Win by slaying enough monsters, or
              ending your turn with enough different classes, including your
              leader.
            </p>
          </section>
        </div>
      </div>
      <div className="preview-note">
        <Sparkles size={17} />
        <span>
          This first preview includes rooms, leader selection, dealing, drawing,
          and turn timing. Playing cards, reactions, abilities, and monster
          combat are the next milestone.
        </span>
      </div>
    </Dialog>
  );
}

function Home({
  busy,
  online,
  enter,
  inviteCode,
  canResume,
  resume,
}: {
  busy: boolean;
  online: boolean;
  enter: ReturnType<typeof useRoom>["enter"];
  inviteCode: string;
  canResume: boolean;
  resume: () => void;
}) {
  const [settings, setSettings] = useState<RoomSettings>(DEFAULTS);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("create");
  const [code, setCode] = useState("");
  useEffect(() => {
    if (inviteCode) {
      setCode(inviteCode);
      setMode("join");
    }
  }, [inviteCode]);
  const featured = ["bad-axe", "the-cloaked-sage", "big-buckley"].map((slug) =>
    CARD_BY_SLUG.get(slug)!,
  );
  return (
    <main className="home-main">
      <section className="hero-intro">
        <div className="eyebrow">
          <span className="tiny-star">✦</span> Your next game night starts here
        </div>
        <h1>
          Small heroes.
          <br />
          Big monsters.
          <br />
          <em>Questionable friends.</em>
        </h1>
        <p className="hero-description">
          Gather your party. Slay a monster. Betray your best friend.
          <br className="desktop-only" /> The adventure comes to your table,
          wherever you are.
        </p>
        <div className="hero-meta">
          <span>
            <Users size={16} /> 2–6 players
          </span>
          <i />
          <span>
            <LockKeyhole size={14} /> Private tables
          </span>
          <i />
          <span>
            <Sparkles size={15} /> Endless chaos
          </span>
        </div>
        <div className="card-fan" aria-label="Meet your adventurers">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="floating-rune rune-one">✧</span>
          <span className="floating-rune rune-two">✦</span>
          {featured.map((card, i) => (
            <motion.div
              className={`fan-card fan-${i}`}
              key={card.slug}
              initial={{ opacity: 0, y: 35 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.65 }}
            >
              <CardArtwork card={card} />
            </motion.div>
          ))}
          <div className="fan-caption">
            <span /> A party worth fighting for. Mostly.
          </div>
        </div>
      </section>
      <section className="create-panel">
        <div className="panel-tabs">
          <button
            className={mode === "create" ? "active" : ""}
            onClick={() => setMode("create")}
          >
            <Plus size={16} /> Create a table
          </button>
          <button
            className={mode === "join" ? "active" : ""}
            onClick={() => setMode("join")}
          >
            <Users size={16} /> Join friends
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enter(mode === "join" ? code : null, name, settings);
          }}
        >
          <div className="panel-heading">
            <span className="eyebrow">
              {mode === "create"
                ? "Make room for adventure"
                : "Your party is waiting"}
            </span>
            <h2>
              {mode === "create" ? "Gather your party." : "Pull up a chair."}
            </h2>
            <p>
              {mode === "create"
                ? "Invite friends or add practice bots in the lobby."
                : "Enter your invitation code and join the table."}
            </p>
          </div>
          <label className="input-label">
            Your adventurer name
            <input
              required
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="nickname"
            />
          </label>
          {mode === "create" ? (
            <Settings value={settings} onChange={setSettings} />
          ) : (
            <>
              <label className="input-label room-code-input">
                Table code
                <input
                  required
                  pattern="[a-fA-F0-9]{8}"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="A1B2C3D4"
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </label>
              <div className="join-illustration">
                <div className="invite-seats">
                  <span>✦</span>
                  <span>✧</span>
                  <span>?</span>
                </div>
                <h3>Good company. Bad intentions.</h3>
                <p>
                  Your hand stays private. Your friends’ plans probably don’t.
                </p>
              </div>
            </>
          )}
          <button
            className="button primary create-button"
            disabled={busy || !online}
            type="submit"
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Swords size={18} />
            )}
            {busy
              ? "Opening your table…"
              : mode === "create"
                ? "Create your table"
                : "Join the adventure"}
            <ArrowRight size={18} />
          </button>
          <p className="privacy-note">
            <LockKeyhole size={12} />{" "}
            {online
              ? "No sign-up. Just a name and good company."
              : "Start the game server to open a table."}
          </p>
          {canResume ? (
            <button
              type="button"
              className="text-button resume-link"
              onClick={resume}
            >
              Return to your table <ArrowRight size={13} />
            </button>
          ) : null}
        </form>
      </section>
      <section className="home-bottom">
        <span className="section-number">01 — THE ADVENTURE</span>
        <div>
          <h3>
            Same delightful chaos.
            <br />
            <em>A whole new table.</em>
          </h3>
          <p>
            The original card pool, private hands, and the friends you love to
            challenge. Add expansions when your party is ready for more.
          </p>
        </div>
        <div className="class-parade">
          {["fighter", "guardian", "ranger", "wizard", "thief", "bard"].map(
            (c) => (
              <ClassMark key={c} value={c} />
            ),
          )}
        </div>
      </section>
    </main>
  );
}

function Invite({ room }: { room: RoomView }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}?room=${room.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      className="invite-button"
      onClick={copy}
      aria-label="Copy invitation link"
    >
      <span>TABLE</span>
      <strong>{room.code}</strong>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <small>{copied ? "Link copied" : "Invite friends"}</small>
    </button>
  );
}

function LobbySettings({
  room,
  command,
  busy,
}: {
  room: RoomView;
  command: Command;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(room.settings);
  const changed = JSON.stringify(draft) !== JSON.stringify(room.settings);
  return (
    <div className="lobby-settings">
      <span className="eyebrow">The host’s rulebook</span>
      <h2>The adventure ahead</h2>
      <Settings
        value={draft}
        onChange={setDraft}
        minPlayers={Math.max(2, room.players.length)}
      />
      {changed ? (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void command({ type: "settings", settings: draft })}
        >
          Save table settings
        </button>
      ) : null}
    </div>
  );
}

function PlayerSeat({
  name,
  number,
  self,
  ready,
  host,
  bot,
  remove,
  busy,
}: {
  name: string;
  number: number;
  self?: boolean;
  ready?: boolean;
  host?: boolean;
  bot?: boolean;
  remove?: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className={`player-seat seat-color-${number % 6} ${ready ? "is-ready" : ""}`}
    >
      <div className="seat-avatar">
        {bot ? (
          <Bot size={20} className="bot-avatar" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
        {host ? <Crown size={11} /> : null}
      </div>
      <span>
        <strong>
          {name} {self ? <small>you</small> : null}
          {bot ? <small className="bot-label">BOT</small> : null}
        </strong>
        <small>
          {bot
            ? "Practice partner · automatically ready"
            : ready
              ? "Ready for adventure"
              : "Getting comfortable"}
        </small>
      </span>
      {remove ? (
        <button
          className="remove-bot icon-button"
          aria-label={`Remove ${name}`}
          disabled={busy}
          onClick={remove}
        >
          <X size={16} />
        </button>
      ) : null}
      <span className="ready-dot">
        {ready ? <Check size={15} /> : <span />}
      </span>
    </div>
  );
}

function Lobby({
  room,
  command,
  busy,
}: {
  room: RoomView;
  command: Command;
  busy: boolean;
}) {
  const me = room.players.find((p) => p.id === room.yourId)!;
  const isHost = room.hostId === room.yourId;
  const allReady =
    room.players.length === room.settings.playerCount &&
    room.players.every((p) => p.ready);
  return (
    <div className="lobby-layout">
      <section className="party-lobby">
        <div className="eyebrow">Before the first betrayal</div>
        <h1>
          Your party is
          <br />
          <em>coming together.</em>
        </h1>
        <p className="muted">
          Invite friends or fill empty seats with practice bots.
          <br />
          One human and a bot is all you need to get started.
        </p>
        <div className="seat-list">
          {room.players.map((p, i) => (
            <PlayerSeat
              key={p.id}
              name={p.name}
              number={i}
              self={p.id === room.yourId}
              ready={p.ready}
              host={p.id === room.hostId}
              bot={p.isBot}
              busy={busy}
              remove={
                isHost && p.isBot
                  ? () => void command({ type: "remove_bot", playerId: p.id })
                  : undefined
              }
            />
          ))}
          {Array.from(
            { length: room.settings.playerCount - room.players.length },
            (_, i) => (
              <div className="empty-seat" key={i}>
                <span>
                  <Plus size={21} />
                </span>
                <div>
                  <strong>A seat for a future rival</strong>
                  <small>
                    Invite a friend
                    {isHost
                      ? " or add a bot below"
                      : " or ask the host for a bot"}
                  </small>
                </div>
              </div>
            ),
          )}
        </div>
        {isHost ? (
          <div className="practice-controls">
            <button
              className="button secondary"
              disabled={
                busy || room.players.length >= room.settings.playerCount
              }
              onClick={() => void command({ type: "add_bot" })}
            >
              <Bot size={17} /> Add practice bot
            </button>
            <small>
              {room.players.length >= room.settings.playerCount
                ? "Table full. Remove a bot or increase the player count for another seat."
                : "Bots fill the player count you chose. Mix them with friends or practice solo."}
            </small>
          </div>
        ) : null}
        {room.players.some((p) => p.isBot) ? (
          <p className="bot-preview-note">
            <Bot size={15} /> Practice bots currently roll, draft, draw, refresh
            their hand, and pass. Card plays and combat are coming with the game
            engine.
          </p>
        ) : null}
        <div className="lobby-actions">
          <button
            className={`button ${me.ready ? "secondary" : "primary"}`}
            disabled={busy}
            onClick={() => void command({ type: "ready", ready: !me.ready })}
          >
            {me.ready ? <Check size={17} /> : <Sparkles size={17} />}
            {me.ready ? "You’re ready" : "I’m ready"}
          </button>
          {isHost ? (
            <button
              className="button primary"
              disabled={busy || !allReady}
              onClick={() => void command({ type: "start_draft" })}
            >
              <Dice5 size={17} /> Roll for leaders <ArrowRight size={17} />
            </button>
          ) : (
            <span className="waiting-label">
              The host starts when everyone is ready.
            </span>
          )}
        </div>
        <p className="field-hint">
          Leader selection uses your dice queue. The last picker goes first.
        </p>
      </section>
      {isHost ? (
        <LobbySettings
          key={JSON.stringify(room.settings)}
          room={room}
          command={command}
          busy={busy}
        />
      ) : (
        <div className="lobby-settings guest-settings">
          <span className="eyebrow">Your adventure</span>
          <h2>{title(room.settings.preset)} game night</h2>
          <div className="big-stat">
            <Hourglass />
            <strong>{room.settings.preset === "quick" ? "60" : "120"}</strong>
            <span>seconds per turn</span>
          </div>
          <div className="rules-summary">
            <p>
              <Trophy size={17} /> {room.settings.classTarget} classes or{" "}
              {room.settings.monsterTarget} monsters to win
            </p>
            <p>
              <Shield size={17} /> 10-second challenge window
            </p>
            <p>
              <Layers3 size={17} /> {inventory(room.settings.expansions).main}{" "}
              cards in the main deck
            </p>
          </div>
          <p className="muted">
            Base game
            {room.settings.expansions.length
              ? ` + ${room.settings.expansions.map((s) => SETS.find((set) => set.id === s)?.name).join(" + ")}`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function DiceFace({
  value,
  rolling = false,
}: {
  value: number;
  rolling?: boolean;
}) {
  const positions: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <div
      className={`dice-face ${rolling ? "rolling" : ""}`}
      aria-label={`Dice: ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={positions[value]?.includes(i) ? "pip" : ""} />
      ))}
    </div>
  );
}

function Initiative({
  room,
  command,
  busy,
  chime,
}: {
  room: RoomView;
  command: Command;
  busy: boolean;
  chime: (kind?: string) => void;
}) {
  const me = room.players.find((p) => p.id === room.yourId)!;
  const canRoll =
    room.initiativeGroup.includes(me.id) && !room.rolledInRound.includes(me.id);
  const latest = me.rolls.at(-1);
  const tiebreak = room.players.every((p) => p.rolls.length > 0);
  return (
    <section className="initiative-stage">
      <span className="eyebrow">
        {tiebreak
          ? "A little friendly competition"
          : "Let fate choose the order"}
      </span>
      <h1>{tiebreak ? "Settle the tie." : "Roll for your destiny."}</h1>
      <p className="muted">
        {tiebreak
          ? "Only the tied players reroll. Your original group keeps its place."
          : "High rolls pick their party leaders first. Everyone gets two dice."}
      </p>
      <div className="dice-stage">
        <DiceFace value={latest?.dice[0] ?? 5} rolling={busy && canRoll} />
        <DiceFace value={latest?.dice[1] ?? 3} rolling={busy && canRoll} />
        <span className="dice-total">{latest ? latest.total : "?"}</span>
      </div>
      <button
        className="button primary roll-button"
        disabled={busy || !canRoll}
        onClick={() => {
          chime("roll");
          void command({ type: "roll_initiative" });
        }}
      >
        <Dice5 size={20} />
        {canRoll
          ? tiebreak
            ? "Roll the tie-break"
            : "Roll my dice"
          : "Waiting for the other adventurers…"}
      </button>
      <div className="initiative-results">
        {room.players.map((p, i) => (
          <div
            key={p.id}
            className={`initiative-result seat-color-${i} ${room.initiativeGroup.includes(p.id) ? "in-group" : ""}`}
          >
            <span className="seat-avatar">{p.name.slice(0, 1)}</span>
            <strong>
              {p.name}
              {p.id === room.yourId ? <small>you</small> : null}
              {p.isBot ? <small className="bot-label">BOT</small> : null}
            </strong>
            <div className="roll-history">
              {p.rolls.map((r, n) => (
                <span key={n}>
                  {n ? <ChevronRight size={12} /> : null}
                  {r.total}
                </span>
              ))}
            </div>
            {!p.rolls.length ? (
              <span className="muted">Not rolled yet</span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="field-hint">
        The server rolls the dice. Your place is settled fairly, including
        repeated ties.
      </p>
    </section>
  );
}

function LeaderDraft({
  room,
  command,
  busy,
  inspect,
}: {
  room: RoomView;
  command: Command;
  busy: boolean;
  inspect: (c: Card) => void;
}) {
  const choosing = room.players.find((p) => p.id === room.choosingPlayerId)!;
  const myPick = choosing.id === room.yourId;
  return (
    <section className="leader-draft">
      <div className="draft-heading">
        <div>
          <span className="eyebrow">Every party needs a leader</span>
          <h1>
            {myPick ? "Choose your champion." : `${choosing.name} is choosing.`}
          </h1>
          <p className="muted">
            {myPick
              ? "A familiar face. A powerful advantage. A very important decision."
              : "Your party leader will be waiting when it’s your turn."}
          </p>
        </div>
        <Crown className="large-crown" size={54} />
      </div>
      <div className="draft-queue">
        {room.draftOrder.map((id, i) => {
          const player = room.players.find((p) => p.id === id)!;
          return (
            <div
              className={
                id === choosing.id ? "current" : player.leader ? "picked" : ""
              }
              key={id}
            >
              <span>{player.leader ? <Check size={14} /> : i + 1}</span>
              <strong>
                {player.name}
                {player.isBot ? <small className="bot-label">BOT</small> : null}
              </strong>
              {player.leader ? (
                <small>{player.leader.name}</small>
              ) : (
                <small>{id === choosing.id ? "Choosing now" : "Up next"}</small>
              )}
            </div>
          );
        })}
      </div>
      <div className="leader-grid">
        {room.availableLeaders.map((card) => (
          <article className="leader-choice" key={card.slug}>
            <GameCard card={card} onClick={() => inspect(card)} />
            <div className="leader-ability">
              <ClassMark value={card.classes[0]} />
              <p>{card.effect}</p>
            </div>
            <button
              className="button secondary"
              disabled={!myPick || busy}
              onClick={() =>
                void command({ type: "pick_leader", slug: card.slug })
              }
            >
              <Crown size={15} /> Choose {card.name.replace(/^The /, "")}
            </button>
          </article>
        ))}
      </div>
      <p className="field-hint">
        One leader per player. The last picker starts the game; turns then
        follow the table’s seating order.
      </p>
    </section>
  );
}

function Countdown({ room }: { room: RoomView }) {
  const [clock, setClock] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    setOffset(room.serverNow - Date.now());
  }, [room.serverNow]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.min(
    room.settings.preset === "quick" ? 60 : 120,
    Math.max(
      0,
      Math.ceil(((room.turnDeadline ?? clock) - clock - offset) / 1000),
    ),
  );
  return (
    <div className={`turn-clock ${seconds <= 15 ? "urgent" : ""}`}>
      <Hourglass size={16} />
      <strong>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </strong>
    </div>
  );
}

function Table({
  room,
  command,
  busy,
  inspect,
}: {
  room: RoomView;
  command: Command;
  busy: boolean;
  inspect: (c: Card) => void;
}) {
  const active = room.players.find((p) => p.id === room.activePlayerId)!;
  const me = room.players.find((p) => p.id === room.yourId)!;
  const mine = active.id === me.id;
  return (
    <section className="table-layout">
      <div className="board-main">
        <div className="turn-banner">
          <div>
            <span className="turn-indicator" />
            <span>TURN {room.turnNumber}</span>
            <strong>
              {mine
                ? "Your adventure. Your move."
                : `${active.name} is taking a turn.`}
            </strong>
          </div>
          <div
            className="action-pips"
            aria-label={`${room.actionPoints} action points`}
          >
            {[0, 1, 2].map((i) => (
              <i key={i} className={i < room.actionPoints ? "filled" : ""}>
                ✦
              </i>
            ))}
          </div>
          <Countdown room={room} />
        </div>
        <div className="opponent-row">
          {room.players
            .filter((p) => p.id !== me.id)
            .map((p, i) => (
              <div
                className={`opponent seat-color-${i + 1} ${p.id === active.id ? "active" : ""}`}
                key={p.id}
              >
                <span className="seat-avatar">{p.name.slice(0, 1)}</span>
                <div>
                  <strong>
                    {p.name}
                    {p.isBot ? <small className="bot-label">BOT</small> : null}
                  </strong>
                  <small>{p.leader?.name}</small>
                </div>
                <span className="hand-count">
                  <Hand size={14} /> {p.handCount}
                </span>
                {p.leader ? (
                  <button
                    className="opponent-leader"
                    onClick={() => inspect(p.leader!)}
                    aria-label={`Inspect ${p.name}'s leader`}
                  >
                    <ClassMark value={p.leader.classes[0]} />
                  </button>
                ) : null}
              </div>
            ))}
        </div>
        <div className="battlefield">
          <div className="board-runes" aria-hidden="true">
            ✧
          </div>
          <div className="monster-heading">
            <span>THE HUNT</span>
            <h2>Choose your trouble.</h2>
            <span>3 monsters await</span>
          </div>
          <div className="monster-row">
            {room.monsters.map((m) => (
              <GameCard
                key={m.id}
                card={m.card}
                onClick={() => inspect(m.card)}
              />
            ))}
          </div>
          <div className="deck-row">
            <button
              className="draw-deck"
              disabled={!mine || busy}
              onClick={() => void command({ type: "draw" })}
            >
              <div className="card-back">
                <span>
                  H<span>✦</span>S
                </span>
              </div>
              <strong>{room.mainDeckCount}</strong>
              <small>DRAW · 1 ACTION</small>
            </button>
            <button
              className="discard-pile"
              disabled={!room.discard.length}
              onClick={() => {
                const card = room.discard.at(-1);
                if (card) inspect(card.card);
              }}
            >
              <Layers3 size={24} />
              <strong>{room.discard.length}</strong>
              <small>DISCARD</small>
            </button>
            <div className="table-inscription">
              A brave little party.
              <br />
              <em>A beautifully bad idea.</em>
            </div>
          </div>
        </div>
        <div className="my-party">
          <button className="my-leader" onClick={() => inspect(me.leader!)}>
            {me.leader ? (
              <span className="mini-leader-art">
                <CardArtwork card={me.leader} />
              </span>
            ) : (
              <Crown />
            )}
            <span>
              <small>YOUR PARTY LEADER</small>
              <strong>{me.leader?.name}</strong>
              <span>
                {me.leader?.classes.map((c) => (
                  <ClassMark key={c} value={c} />
                ))}
              </span>
            </span>
          </button>
          <div className="party-empty">
            <Plus size={18} />
            <span>Your heroes will gather here.</span>
          </div>
          <div className="victory-chips">
            <span>
              <Trophy size={15} /> 0 / {room.settings.monsterTarget}
            </span>
            <span>
              <Sparkles size={15} /> 1 / {room.settings.classTarget}
            </span>
          </div>
        </div>
        <div className="hand-heading">
          <div>
            <Hand size={16} />
            <strong>Your hand</strong>
            <span>{me.handCount} cards · only you can see these</span>
          </div>
          <button
            className="text-button"
            disabled={!mine || busy || room.actionPoints < 3}
            onClick={() => void command({ type: "refresh_hand" })}
          >
            Refresh hand <span>3 AP</span>
          </button>
        </div>
        <div className="player-hand">
          <AnimatePresence initial={false}>
            {me.hand?.map((instance) => (
              <motion.div
                key={instance.id}
                layout
                initial={{ opacity: 0, y: 45, rotate: 4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ type: "spring", stiffness: 220, damping: 23 }}
              >
                <GameCard
                  card={instance.card}
                  onClick={() => inspect(instance.card)}
                  small
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="table-actions">
          <span>
            {mine
              ? "Drawing costs one action. Inspect any card to read its effect."
              : "Your hand stays private while your friends take their turns."}
          </span>
          <button
            className="button primary"
            disabled={!mine || busy}
            onClick={() => void command({ type: "end_turn" })}
          >
            End my turn <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <aside className="game-sidebar">
        <div className="sidebar-goal">
          <span className="eyebrow">The path to glory</span>
          <h3>
            {room.settings.monsterTarget} monsters
            <br />
            <em>or {room.settings.classTarget} classes.</em>
          </h3>
          <p>Class victory counts at the end of your turn.</p>
        </div>
        <div className="preview-note">
          <Sparkles size={16} />
          <span>
            Foundation preview: the table, hands, drawing, and turn clock are
            live. Card plays and combat arrive in the next milestone.
          </span>
        </div>
        <div className="activity-heading">
          <span className="eyebrow">Around the table</span>
          <span className="live-dot" />
        </div>
        <ol className="activity-log">
          {room.events
            .slice(-12)
            .reverse()
            .map((e) => (
              <li key={e.sequence}>
                <i className={`event-${e.kind}`} />
                <p>{e.message}</p>
              </li>
            ))}
        </ol>
      </aside>
    </section>
  );
}

export function GameApp() {
  const game = useRoom();
  const audio = useChime();
  const reduced = useReducedMotion();
  const [library, setLibrary] = useState(false);
  const [rules, setRules] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const room = game.room;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [room?.phase]);
  return (
    <MotionConfig reducedMotion="user">
      <div className={`game-app ${reduced ? "reduced-motion" : ""}`}>
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <header className="site-nav">
          <button className="brand" onClick={game.home}>
            <span className="brand-icon">
              <Swords size={23} strokeWidth={1.6} />
            </span>
            <span>
              HERE TO SLAY<small>THE ONLINE TABLE · EARLY PREVIEW</small>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={!library && !rules ? "active" : ""}
              onClick={game.home}
            >
              The table
            </button>
            <button onClick={() => setLibrary(true)}>Card library</button>
            <button onClick={() => setRules(true)}>How to play</button>
          </nav>
          <div className="nav-tools">
            <span
              className={`connection-label ${game.serverOnline ? "online" : ""}`}
            >
              <i />
              {room
                ? game.connected
                  ? "Table connected"
                  : "Reconnecting…"
                : game.serverOnline
                  ? "Tables are open"
                  : "Tables offline"}
            </span>
            <button
              className="icon-button mobile-library"
              onClick={() => setLibrary(true)}
              aria-label="Open card library"
            >
              <BookOpen size={19} />
            </button>
            <button
              className="icon-button sound-toggle"
              onClick={audio.toggle}
              aria-label={
                audio.muted ? "Enable sound effects" : "Mute sound effects"
              }
            >
              {audio.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
          </div>
        </header>
        {game.error ? (
          <div className="error-banner" role="alert">
            <span>{game.error}</span>
            <button
              aria-label="Dismiss error"
              onClick={() => game.setError("")}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        {room ? (
          <main className="room-main">
            <div className="room-topbar">
              <button className="text-button" onClick={game.home}>
                <ArrowLeft size={15} /> Your table
              </button>
              <span className="phase-label">
                {
                  (
                    {
                      lobby: "GATHERING THE PARTY",
                      initiative: "ROLLING FOR LEADERS",
                      draft: "CHOOSING CHAMPIONS",
                      playing: "THE ADVENTURE",
                      finished: "ADVENTURE CLOSED",
                    } as Record<string, string>
                  )[room.phase]
                }
              </span>
              <Invite room={room} />
            </div>
            {room.phase === "lobby" ? (
              <Lobby room={room} command={game.command} busy={game.busy} />
            ) : room.phase === "initiative" ? (
              <Initiative
                room={room}
                command={game.command}
                busy={game.busy}
                chime={audio.chime}
              />
            ) : room.phase === "draft" ? (
              <LeaderDraft
                room={room}
                command={game.command}
                busy={game.busy}
                inspect={setSelected}
              />
            ) : room.phase === "playing" ? (
              <Table
                room={room}
                command={game.command}
                busy={game.busy}
                inspect={setSelected}
              />
            ) : (
              <section className="finished-stage">
                <Trophy size={45} />
                <h1>Until the next adventure.</h1>
                <p className="muted">
                  This table has closed. There’s always another monster to slay.
                </p>
                <button className="button primary" onClick={game.home}>
                  Gather a new party <ArrowRight size={16} />
                </button>
              </section>
            )}
          </main>
        ) : (
          <Home
            busy={game.busy}
            online={game.serverOnline}
            enter={game.enter}
            inviteCode={game.inviteCode}
            canResume={!!game.seat}
            resume={() => void game.resume()}
          />
        )}
        <footer className="site-footer">
          <span>
            <Swords size={13} /> A little magic. A lot of friendly rivalry.
          </span>
          <span>Unofficial fan project · Game & artwork © Unstable Games</span>
          <button onClick={() => setRules(true)}>
            <BookOpen size={13} /> Rules & preview details
          </button>
        </footer>
        {library ? (
          <Library close={() => setLibrary(false)} inspect={setSelected} />
        ) : null}
        {rules ? <HowToPlay close={() => setRules(false)} /> : null}
        {selected ? (
          <CardDetail card={selected} close={() => setSelected(null)} />
        ) : null}
      </div>
    </MotionConfig>
  );
}
