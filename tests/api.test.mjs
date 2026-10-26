import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

const base = process.env.SLAY_TEST_API ?? "http://127.0.0.1:8080/api";
async function api(path, { body, token, expected = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
const settings = {
  playerCount: 2,
  expansions: [],
  preset: "standard",
  classTarget: 6,
  monsterTarget: 3,
};
test("catalog responses retain all monster attack details and the Dracos exception", async () => {
  const { data: cards } = await api("/catalog");
  const monsters = cards.filter((c) => c.type === "monster");
  assert.equal(monsters.length, 19);
  for (const monster of monsters) {
    assert.ok(monster.requirements.length);
    assert.ok(
      monster.slayRollRequirement &&
        monster.failureRollRequirement &&
        monster.failurePenalty &&
        monster.passiveAbility,
    );
  }
  const dracos = monsters.find((c) => c.slug === "dracos");
  assert.equal(dracos.slayRollRequirement, "5-");
  assert.equal(dracos.failureRollRequirement, "8+");
  assert.equal(dracos.failurePenalty, "SACRIFICE a Hero card");
});
async function send(seat, command) {
  const current = await api(`/rooms/${seat.room.code}`, { token: seat.token });
  return api(`/rooms/${current.code}/commands`, {
    token: seat.token,
    body: {
      requestId: randomUUID(),
      expectedVersion: current.version,
      command,
    },
  });
}

for (const count of [2, 6])
  test(`${count}-player room: ready, dice queue, unique draft, exact deal, private hands, legal turns`, async () => {
    const host = await api("/rooms", {
      body: {
        name: "Test Host",
        settings: {
          ...settings,
          playerCount: count,
          expansions: ["warrior-and-druid", "berserkers-and-necromancers"],
        },
      },
    });
    const seats = [host];
    for (let n = 1; n < count; n++)
      seats.push(
        await api(`/rooms/${host.room.code}/join`, {
          body: { name: `Test Guest ${n}` },
        }),
      );
    for (const seat of seats) await send(seat, { type: "ready", ready: true });
    let view = await send(host, { type: "start_draft" });
    for (let round = 0; view.phase === "initiative" && round < 100; round++) {
      for (const id of view.initiativeGroup.filter(
        (id) => !view.rolledInRound.includes(id),
      )) {
        const seat = seats.find((s) => s.room.yourId === id);
        view = await send(seat, { type: "roll_initiative" });
      }
    }
    assert.equal(view.phase, "draft");
    const lastPicker = view.draftOrder.at(-1);
    while (view.phase === "draft") {
      const seat = seats.find((s) => s.room.yourId === view.choosingPlayerId);
      view = await send(seat, {
        type: "pick_leader",
        slug: view.availableLeaders[0].slug,
      });
    }
    assert.equal(view.phase, "playing");
    assert.equal(view.activePlayerId, lastPicker);
    assert.equal(view.mainDeckCount, 177 - count * 5);
    assert.equal(view.monsterDeckCount, 16);
    assert.equal(view.monsters.length, 3);
    assert.equal(new Set(view.players.map((p) => p.leader.slug)).size, count);
    for (const seat of seats) {
      const own = await api(`/rooms/${view.code}`, { token: seat.token });
      for (const player of own.players)
        assert.equal(player.hand === null, player.id !== own.yourId);
      assert.equal(own.players.find((p) => p.id === own.yourId).hand.length, 5);
      assert.ok(!JSON.stringify(own).includes("tokenHash"));
    }
    await api(`/rooms/${view.code}`, { expected: 401 });
    await api(`/rooms/${view.code}`, { token: "0".repeat(64), expected: 401 });
    const active = seats.find((s) => s.room.yourId === view.activePlayerId);
    const inactive = seats.find((s) => s.room.yourId !== view.activePlayerId);
    await api(`/rooms/${view.code}/commands`, {
      token: inactive.token,
      body: {
        requestId: randomUUID(),
        expectedVersion: view.version,
        command: { type: "draw" },
      },
      expected: 400,
    });
    view = await send(active, { type: "draw" });
    assert.equal(view.actionPoints, 2);
    assert.equal(
      view.players.find((p) => p.id === active.room.yourId).handCount,
      6,
    );
    await api(`/rooms/${view.code}/commands`, {
      token: host.token,
      body: {
        requestId: randomUUID(),
        expectedVersion: view.version,
        command: { type: "settings", settings },
      },
      expected: 400,
    });
    const envelope = {
      requestId: randomUUID(),
      expectedVersion: view.version,
      command: { type: "draw" },
    };
    const first = await api(`/rooms/${view.code}/commands`, {
      token: active.token,
      body: envelope,
    });
    const duplicate = await api(`/rooms/${view.code}/commands`, {
      token: active.token,
      body: envelope,
    });
    assert.equal(first.mainDeckCount, duplicate.mainDeckCount);
    view = await send(active, { type: "end_turn" });
    assert.notEqual(view.activePlayerId, active.room.yourId);
    await send(host, { type: "abort" });
  });

test("concurrent room creation generates independent codes, hands, and owners", async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      api("/rooms", { body: { name: `Concurrent ${i}`, settings } }),
    ),
  );
  assert.equal(new Set(results.map((r) => r.room.code)).size, 6);
  assert.equal(new Set(results.map((r) => r.token)).size, 6);
  await api(`/rooms/${results[0].room.code}`, {
    token: results[1].token,
    expected: 401,
  });
});

test("host manages ready bot seats alongside friends, with capacity and authorization checks", async () => {
  const host = await api("/rooms", {
    body: { name: "Bot Host", settings: { ...settings, playerCount: 3 } },
  });
  const guest = await api(`/rooms/${host.room.code}/join`, {
    body: { name: "Human Friend" },
  });
  let view = await api(`/rooms/${host.room.code}`, { token: host.token });
  await api(`/rooms/${view.code}/commands`, {
    token: guest.token,
    body: {
      requestId: randomUUID(),
      expectedVersion: view.version,
      command: { type: "add_bot" },
    },
    expected: 400,
  });
  const envelope = {
    requestId: randomUUID(),
    expectedVersion: view.version,
    command: { type: "add_bot" },
  };
  view = await api(`/rooms/${view.code}/commands`, {
    token: host.token,
    body: envelope,
  });
  const bot = view.players.find((p) => p.isBot);
  assert.ok(bot.ready);
  assert.equal(view.players.length, 3);
  const duplicate = await api(`/rooms/${view.code}/commands`, {
    token: host.token,
    body: envelope,
  });
  assert.equal(duplicate.players.length, 3);
  await api(`/rooms/${view.code}/join`, {
    body: { name: "Extra Guest" },
    expected: 400,
  });
  await api(`/rooms/${view.code}/commands`, {
    token: host.token,
    body: {
      requestId: randomUUID(),
      expectedVersion: view.version,
      command: { type: "remove_bot", playerId: guest.room.yourId },
    },
    expected: 400,
  });
  view = await send(host, {
    type: "settings",
    settings: { ...view.settings, preset: "quick" },
  });
  assert.ok(view.players.find((p) => p.isBot).ready);
  view = await send(host, { type: "remove_bot", playerId: bot.id });
  assert.equal(view.players.length, 2);
  assert.ok(!view.players.some((p) => p.isBot));
  await send(host, { type: "abort" });
});

test(
  "solo practice: server bots roll, draft, keep their hand private, and finish turns automatically",
  { timeout: 30000 },
  async () => {
    const host = await api("/rooms", {
      body: { name: "Solo Practice", settings },
    });
    let view = await send(host, { type: "add_bot" });
    const botId = view.players.find((p) => p.isBot).id;
    await send(host, { type: "ready", ready: true });
    view = await send(host, { type: "start_draft" });
    const deadline = Date.now() + 20000;
    while (view.phase !== "playing" && Date.now() < deadline) {
      if (
        view.phase === "initiative" &&
        view.initiativeGroup.includes(host.room.yourId) &&
        !view.rolledInRound.includes(host.room.yourId)
      ) {
        view = await send(host, { type: "roll_initiative" });
      } else if (
        view.phase === "draft" &&
        view.choosingPlayerId === host.room.yourId
      ) {
        view = await send(host, {
          type: "pick_leader",
          slug: view.availableLeaders[0].slug,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
        view = await api(`/rooms/${view.code}`, { token: host.token });
      }
    }
    assert.equal(view.phase, "playing");
    assert.ok(view.players.find((p) => p.id === botId).leader);
    assert.equal(view.players.find((p) => p.id === botId).hand, null);
    assert.notEqual(view.players[0].leader.slug, view.players[1].leader.slug);
    await api(`/rooms/${view.code}/commands`, {
      token: host.token,
      body: {
        requestId: randomUUID(),
        expectedVersion: view.version,
        command: { type: "remove_bot", playerId: botId },
      },
      expected: 400,
    });
    if (view.activePlayerId === host.room.yourId)
      view = await send(host, { type: "end_turn" });
    assert.equal(view.activePlayerId, botId);
    const botTurn = view.turnNumber;
    while (view.activePlayerId === botId && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      view = await api(`/rooms/${view.code}`, { token: host.token });
    }
    assert.equal(view.activePlayerId, host.room.yourId);
    assert.equal(view.turnNumber, botTurn + 1);
    assert.equal(view.actionPoints, 3);
    assert.ok(
      view.events.some(
        (e) =>
          /Practice Bot/.test(e.message) &&
          ["draw", "refresh"].includes(e.kind),
      ),
    );
    const finished = await send(host, { type: "abort" });
    await new Promise((resolve) => setTimeout(resolve, 1600));
    const stopped = await api(`/rooms/${view.code}`, { token: host.token });
    assert.equal(stopped.phase, "finished");
    assert.equal(stopped.version, finished.version);
  },
);
