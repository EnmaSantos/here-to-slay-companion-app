use rand::{Rng, seq::SliceRandom};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use ts_rs::TS;
use uuid::Uuid;

pub const BASE: &str = "base-game";
pub const WARRIORS: &str = "warrior-and-druid";
pub const BERSERKERS: &str = "berserkers-and-necromancers";
const BOT_DELAY_MS: i64 = 1_200;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct Release {
    pub set: String,
    pub date: String,
    pub quantity: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct Card {
    pub slug: String,
    pub name: String,
    #[serde(rename = "type")]
    pub card_type: String,
    pub sets: Vec<String>,
    pub classes: Vec<String>,
    pub effect: Option<String>,
    pub image_url: Option<String>,
    pub roll_requirement: Option<String>,
    pub rules: Vec<String>,
    pub releases: Vec<Release>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct CardInstance {
    pub id: String,
    pub card: Card,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct RoomSettings {
    pub player_count: usize,
    pub expansions: Vec<String>,
    pub preset: String,
    pub class_target: usize,
    pub monster_target: usize,
}

impl Default for RoomSettings {
    fn default() -> Self {
        Self {
            player_count: 2,
            expansions: vec![],
            preset: "standard".into(),
            class_target: 6,
            monster_target: 3,
        }
    }
}

impl RoomSettings {
    pub fn validate(&self) -> Result<(), String> {
        ensure(
            (2..=6).contains(&self.player_count),
            "Choose between two and six players.",
        )?;
        ensure(
            ["quick", "standard"].contains(&self.preset.as_str()),
            "Unknown pacing preset.",
        )?;
        let unique: HashSet<_> = self.expansions.iter().collect();
        ensure(
            unique.len() == self.expansions.len(),
            "An expansion can only be included once.",
        )?;
        ensure(
            self.expansions
                .iter()
                .all(|s| [WARRIORS, BERSERKERS].contains(&s.as_str())),
            "This expansion is not supported yet.",
        )?;
        ensure(
            (6..=6 + 2 * self.expansions.len()).contains(&self.class_target),
            "The class target must be achievable with the selected sets.",
        )?;
        ensure(
            (3..=15 + 2 * self.expansions.len()).contains(&self.monster_target),
            "Choose an achievable monster target of at least three.",
        )
    }

    pub fn turn_ms(&self) -> i64 {
        if self.preset == "quick" {
            60_000
        } else {
            120_000
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct DiceRoll {
    pub dice: [u8; 2],
    pub total: u8,
}

impl DiceRoll {
    pub fn random() -> Self {
        let mut rng = rand::rng();
        let dice = [rng.random_range(1..=6), rng.random_range(1..=6)];
        Self {
            total: dice[0] + dice[1],
            dice,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_bot: bool,
    pub token_hash: String,
    pub ready: bool,
    pub rolls: Vec<DiceRoll>,
    pub leader: Option<Card>,
    pub hand: Vec<CardInstance>,
    pub party: Vec<CardInstance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct PlayerView {
    pub id: String,
    pub name: String,
    pub is_bot: bool,
    pub ready: bool,
    pub rolls: Vec<DiceRoll>,
    pub leader: Option<Card>,
    pub hand: Option<Vec<CardInstance>>,
    pub hand_count: usize,
    pub party: Vec<CardInstance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct GameEvent {
    pub sequence: u32,
    pub message: String,
    #[ts(type = "number")]
    pub at: i64,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub code: String,
    pub host_id: String,
    pub settings: RoomSettings,
    pub phase: String,
    pub version: u32,
    pub players: Vec<Player>,
    pub initiative_group: Vec<String>,
    pub rolled_in_round: Vec<String>,
    pub draft_order: Vec<String>,
    pub draft_index: usize,
    pub leaders: Vec<Card>,
    pub deck: Vec<CardInstance>,
    pub monster_deck: Vec<CardInstance>,
    pub monsters: Vec<CardInstance>,
    pub discard: Vec<CardInstance>,
    pub active_player: usize,
    pub action_points: u8,
    pub turn_number: u32,
    pub turn_deadline: Option<i64>,
    #[serde(default)]
    pub bot_action_due: Option<i64>,
    pub events: Vec<GameEvent>,
    pub receipts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct RoomView {
    pub code: String,
    pub host_id: String,
    pub settings: RoomSettings,
    pub phase: String,
    pub version: u32,
    pub players: Vec<PlayerView>,
    pub your_id: String,
    pub initiative_group: Vec<String>,
    pub rolled_in_round: Vec<String>,
    pub draft_order: Vec<String>,
    pub choosing_player_id: Option<String>,
    pub available_leaders: Vec<Card>,
    pub monsters: Vec<CardInstance>,
    pub main_deck_count: usize,
    pub monster_deck_count: usize,
    pub discard: Vec<CardInstance>,
    pub active_player_id: Option<String>,
    pub action_points: u8,
    pub turn_number: u32,
    #[ts(type = "number | null")]
    pub turn_deadline: Option<i64>,
    #[ts(type = "number")]
    pub server_now: i64,
    pub events: Vec<GameEvent>,
}

#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
#[ts(export, export_to = "../../lib/generated/")]
pub enum GameCommand {
    Ready { ready: bool },
    Settings { settings: RoomSettings },
    AddBot,
    RemoveBot { player_id: String },
    StartDraft,
    RollInitiative,
    PickLeader { slug: String },
    Draw,
    RefreshHand,
    EndTurn,
    Abort,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../lib/generated/")]
pub struct CommandEnvelope {
    pub request_id: String,
    pub expected_version: u32,
    pub command: GameCommand,
}

fn ensure(condition: bool, message: &str) -> Result<(), String> {
    if condition {
        Ok(())
    } else {
        Err(message.into())
    }
}

pub fn token_hash(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
pub fn new_token() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}

#[derive(Deserialize)]
struct VerifiedInventory {
    sets: Vec<VerifiedSet>,
}
#[derive(Deserialize)]
struct VerifiedSet {
    id: String,
    cards: Vec<VerifiedCard>,
}
#[derive(Deserialize)]
struct VerifiedCard {
    slug: String,
    name: String,
    #[serde(rename = "type")]
    card_type: String,
    quantity: usize,
}

pub fn catalog() -> Vec<Card> {
    #[derive(Deserialize)]
    struct Snapshot {
        cards: Vec<Card>,
    }
    let snapshot: Snapshot = serde_json::from_str(include_str!("../data/catalog.json"))
        .expect("valid bundled card catalog");
    select_verified_cards(&snapshot.cards).expect("catalog matches reviewed retail inventories")
}

fn select_verified_cards(source: &[Card]) -> Result<Vec<Card>, String> {
    let inventory: VerifiedInventory =
        serde_json::from_str(include_str!("../data/verified-inventory.json"))
            .expect("valid reviewed inventories");
    let mut cards = vec![];
    let mut seen = HashSet::new();
    for set in inventory.sets {
        for approved in set.cards {
            ensure(
                seen.insert(approved.slug.clone()),
                "Duplicate reviewed card.",
            )?;
            let matches: Vec<_> = source.iter().filter(|c| c.slug == approved.slug).collect();
            ensure(
                matches.len() == 1,
                "A reviewed card is missing or duplicated.",
            )?;
            let mut card = matches[0].clone();
            // The API uses numeric suffixes to disambiguate records with the
            // same printed modifier name. They are not part of the card name.
            let printed_name = card
                .name
                .rsplit_once(" (")
                .filter(|(_, suffix)| {
                    suffix
                        .strip_suffix(')')
                        .is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()))
                })
                .map_or(card.name.as_str(), |(name, _)| name);
            ensure(
                printed_name == approved.name && card.card_type == approved.card_type,
                "A reviewed card changed identity.",
            )?;
            ensure(card.sets.contains(&set.id), "A reviewed card changed sets.")?;
            let releases: Vec<_> = card.releases.iter().filter(|r| r.set == set.id).collect();
            ensure(
                !releases.is_empty() && releases.iter().all(|r| r.quantity == approved.quantity),
                "A reviewed card changed quantity.",
            )?;
            card.releases = vec![Release {
                set: set.id.clone(),
                date: releases[0].date.clone(),
                quantity: approved.quantity,
            }];
            card.sets = vec![set.id.clone()];
            card.name = approved.name;
            if card.slug == "the-charismatic-song" {
                card.classes = vec!["bard".into()];
            }
            cards.push(card);
        }
    }
    Ok(cards)
}

pub fn build_pool(settings: &RoomSettings, cards: &[Card], card_type: &str) -> Vec<CardInstance> {
    let mut instances = vec![];
    for set in std::iter::once(BASE).chain(settings.expansions.iter().map(String::as_str)) {
        for card in cards {
            let matches = if card_type == "main" {
                ["hero", "item", "magic", "modifier", "challenge"]
                    .contains(&card.card_type.as_str())
            } else {
                card.card_type == card_type
            };
            if !matches {
                continue;
            }
            // A reprint is another release of the same physical product, not another copy.
            if let Some(release) = card.releases.iter().find(|r| r.set == set) {
                for _ in 0..release.quantity {
                    instances.push(CardInstance {
                        id: Uuid::new_v4().to_string(),
                        card: card.clone(),
                    });
                }
            }
        }
    }
    instances
}

pub fn new_player(name: &str) -> Result<(Player, String), String> {
    let name = name.trim();
    ensure(
        !name.is_empty() && name.chars().count() <= 24 && !name.chars().any(char::is_control),
        "Enter a display name of 1–24 characters.",
    )?;
    let token = new_token();
    Ok((
        Player {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            is_bot: false,
            token_hash: token_hash(&token),
            ready: false,
            rolls: vec![],
            leader: None,
            hand: vec![],
            party: vec![],
        },
        token,
    ))
}

impl Room {
    pub fn new(
        code: String,
        host: Player,
        settings: RoomSettings,
        now: i64,
    ) -> Result<Self, String> {
        settings.validate()?;
        let mut room = Self {
            code,
            host_id: host.id.clone(),
            settings,
            phase: "lobby".into(),
            version: 1,
            players: vec![host],
            initiative_group: vec![],
            rolled_in_round: vec![],
            draft_order: vec![],
            draft_index: 0,
            leaders: vec![],
            deck: vec![],
            monster_deck: vec![],
            monsters: vec![],
            discard: vec![],
            active_player: 0,
            action_points: 3,
            turn_number: 1,
            turn_deadline: None,
            bot_action_due: None,
            events: vec![],
            receipts: vec![],
        };
        room.log(
            "The table is open. Your adventure starts here.",
            "room",
            now,
        );
        Ok(room)
    }

    pub fn player_id(&self, token: &str) -> Result<String, String> {
        let hash = token_hash(token);
        self.players
            .iter()
            .find(|p| !p.is_bot && p.token_hash == hash)
            .map(|p| p.id.clone())
            .ok_or_else(|| "This seat belongs to a different guest session.".into())
    }

    pub fn join(&mut self, player: Player, now: i64) -> Result<(), String> {
        ensure(self.phase == "lobby", "This adventure has already started.")?;
        ensure(
            self.players.len() < self.settings.player_count,
            "This table is full.",
        )?;
        ensure(
            !self
                .players
                .iter()
                .any(|p| p.name.eq_ignore_ascii_case(&player.name)),
            "That name is already at the table.",
        )?;
        self.log(&format!("{} joined the party.", player.name), "join", now);
        self.players.push(player);
        self.version += 1;
        Ok(())
    }

    pub fn view(&self, id: &str, now: i64) -> RoomView {
        RoomView {
            code: self.code.clone(),
            host_id: self.host_id.clone(),
            settings: self.settings.clone(),
            phase: self.phase.clone(),
            version: self.version,
            players: self
                .players
                .iter()
                .map(|p| PlayerView {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    is_bot: p.is_bot,
                    ready: p.ready,
                    rolls: p.rolls.clone(),
                    leader: p.leader.clone(),
                    hand: (p.id == id).then(|| p.hand.clone()),
                    hand_count: p.hand.len(),
                    party: p.party.clone(),
                })
                .collect(),
            your_id: id.into(),
            initiative_group: self.initiative_group.clone(),
            rolled_in_round: self.rolled_in_round.clone(),
            draft_order: self.draft_order.clone(),
            choosing_player_id: (self.phase == "draft")
                .then(|| self.draft_order[self.draft_index].clone()),
            available_leaders: self.leaders.clone(),
            monsters: self.monsters.clone(),
            main_deck_count: self.deck.len(),
            monster_deck_count: self.monster_deck.len(),
            discard: self.discard.clone(),
            active_player_id: (self.phase == "playing")
                .then(|| self.players[self.active_player].id.clone()),
            action_points: self.action_points,
            turn_number: self.turn_number,
            turn_deadline: self.turn_deadline,
            server_now: now,
            events: self.events.clone(),
        }
    }

    pub fn apply(
        &mut self,
        id: &str,
        envelope: &CommandEnvelope,
        cards: &[Card],
        now: i64,
    ) -> Result<(), String> {
        ensure(
            self.players.iter().any(|p| p.id == id),
            "You do not have a seat at this table.",
        )?;
        ensure(
            !envelope.request_id.is_empty() && envelope.request_id.len() <= 100,
            "Invalid request identifier.",
        )?;
        if self.receipts.contains(&envelope.request_id) {
            return Ok(());
        }
        ensure(
            envelope.expected_version == self.version,
            "The table changed. Your view has been refreshed; please try again.",
        )?;
        let player_index = self.players.iter().position(|p| p.id == id).unwrap();
        match &envelope.command {
            GameCommand::Ready { ready } => {
                self.require_phase("lobby")?;
                self.players[player_index].ready = *ready;
            }
            GameCommand::Settings { settings } => {
                self.require_phase("lobby")?;
                ensure(
                    id == self.host_id,
                    "Only the host can change the table settings.",
                )?;
                settings.validate()?;
                ensure(
                    settings.player_count >= self.players.len(),
                    "There are already more players at the table.",
                )?;
                self.settings = settings.clone();
                for p in &mut self.players {
                    p.ready = p.is_bot;
                }
                self.log(
                    "The host updated the adventure. Ready up again.",
                    "settings",
                    now,
                );
            }
            GameCommand::AddBot => {
                self.require_phase("lobby")?;
                ensure(id == self.host_id, "Only the host can add practice bots.")?;
                ensure(
                    self.players.len() < self.settings.player_count,
                    "This table is full. Increase the player count to add a bot.",
                )?;
                let number = (1..)
                    .find(|n| {
                        let name = format!("Practice Bot {n}");
                        !self
                            .players
                            .iter()
                            .any(|p| p.name.eq_ignore_ascii_case(&name))
                    })
                    .unwrap();
                let (mut bot, _) = new_player(&format!("Practice Bot {number}"))?;
                bot.is_bot = true;
                bot.token_hash.clear(); // Bots have no usable guest credential.
                bot.ready = true;
                self.log(&format!("{} joined the party.", bot.name), "bot", now);
                self.players.push(bot);
            }
            GameCommand::RemoveBot { player_id } => {
                self.require_phase("lobby")?;
                ensure(
                    id == self.host_id,
                    "Only the host can remove practice bots.",
                )?;
                let index = self
                    .players
                    .iter()
                    .position(|p| p.id == *player_id && p.is_bot)
                    .ok_or("That seat is not a practice bot.")?;
                let bot = self.players.remove(index);
                self.log(&format!("{} left the table.", bot.name), "bot", now);
            }
            GameCommand::StartDraft => {
                self.require_phase("lobby")?;
                ensure(
                    id == self.host_id,
                    "Only the host can begin leader selection.",
                )?;
                ensure(
                    self.players.len() == self.settings.player_count
                        && self.players.iter().all(|p| p.ready),
                    "Fill every seat and have everyone ready up first.",
                )?;
                self.phase = "initiative".into();
                self.initiative_group = self.players.iter().map(|p| p.id.clone()).collect();
                self.log(
                    "Roll two dice. High rolls choose their leaders first.",
                    "initiative",
                    now,
                );
            }
            GameCommand::RollInitiative => self.record_roll(id, DiceRoll::random(), now)?,
            GameCommand::PickLeader { slug } => {
                self.require_phase("draft")?;
                ensure(
                    self.draft_order[self.draft_index] == id,
                    "Wait for your place in the leader queue.",
                )?;
                let leader_index = self
                    .leaders
                    .iter()
                    .position(|c| c.slug == *slug)
                    .ok_or("That leader is no longer available.")?;
                let leader = self.leaders.remove(leader_index);
                self.log(
                    &format!("{} chose {}.", self.players[player_index].name, leader.name),
                    "leader",
                    now,
                );
                self.players[player_index].leader = Some(leader);
                self.draft_index += 1;
                if self.draft_index == self.players.len() {
                    self.deal(cards, now);
                }
            }
            GameCommand::Draw => {
                self.require_turn(id)?;
                ensure(
                    self.action_points >= 1,
                    "You need one action point to draw.",
                )?;
                ensure(
                    !self.deck.is_empty() || !self.discard.is_empty(),
                    "There are no cards left to draw.",
                )?;
                self.draw_to(player_index, 1);
                self.action_points -= 1;
                self.log(
                    &format!("{} drew a card.", self.players[player_index].name),
                    "draw",
                    now,
                );
                if self.action_points == 0 {
                    self.next_turn(now);
                }
            }
            GameCommand::RefreshHand => {
                self.require_turn(id)?;
                ensure(
                    self.action_points >= 3,
                    "Refreshing your hand costs three action points.",
                )?;
                self.discard.append(&mut self.players[player_index].hand);
                self.draw_to(player_index, 5);
                self.action_points -= 3;
                self.log(
                    &format!(
                        "{} discarded their hand and drew five cards.",
                        self.players[player_index].name
                    ),
                    "refresh",
                    now,
                );
                if self.action_points == 0 {
                    self.next_turn(now);
                }
            }
            GameCommand::EndTurn => {
                self.require_turn(id)?;
                self.next_turn(now);
            }
            GameCommand::Abort => {
                ensure(id == self.host_id, "Only the host can close the adventure.")?;
                ensure(
                    self.phase != "finished",
                    "This adventure has already ended.",
                )?;
                self.phase = "finished".into();
                self.turn_deadline = None;
                self.log("The host closed this adventure.", "finished", now);
            }
        }
        self.schedule_bot(now);
        self.version += 1;
        self.receipts.push(envelope.request_id.clone());
        if self.receipts.len() > 1000 {
            self.receipts.remove(0);
        }
        Ok(())
    }

    pub fn record_roll(&mut self, id: &str, roll: DiceRoll, now: i64) -> Result<(), String> {
        self.require_phase("initiative")?;
        ensure(
            self.initiative_group.iter().any(|p| p == id)
                && !self.rolled_in_round.iter().any(|p| p == id),
            "You have already rolled, or are not in this tie-break.",
        )?;
        ensure(
            roll.dice.iter().all(|d| (1..=6).contains(d))
                && roll.total == roll.dice[0] + roll.dice[1],
            "Invalid dice result.",
        )?;
        let p = self.players.iter_mut().find(|p| p.id == id).unwrap();
        p.rolls.push(roll.clone());
        let message = format!(
            "{} rolled {} + {} = {}.",
            p.name, roll.dice[0], roll.dice[1], roll.total
        );
        self.log(&message, "roll", now);
        self.rolled_in_round.push(id.into());
        if self.rolled_in_round.len() != self.initiative_group.len() {
            return Ok(());
        }

        let mut order: Vec<usize> = (0..self.players.len()).collect();
        order.sort_by(|a, b| {
            self.players[*b]
                .rolls
                .iter()
                .map(|r| r.total)
                .cmp(self.players[*a].rolls.iter().map(|r| r.total))
        });
        let path = |index: usize| {
            self.players[index]
                .rolls
                .iter()
                .map(|r| r.total)
                .collect::<Vec<_>>()
        };
        let mut tied = vec![];
        for pair in order.windows(2) {
            if path(pair[0]) == path(pair[1]) {
                let same_path = path(pair[0]);
                tied = order
                    .iter()
                    .filter(|i| path(**i) == same_path)
                    .map(|i| self.players[*i].id.clone())
                    .collect();
                break;
            }
        }
        self.rolled_in_round.clear();
        if !tied.is_empty() {
            self.initiative_group = tied;
            self.log("A tie! Only the tied players roll again, keeping their original place in the queue.", "tie", now);
        } else {
            self.draft_order = order.iter().map(|i| self.players[*i].id.clone()).collect();
            self.initiative_group.clear();
            self.phase = "draft".into();
            self.leaders = build_pool(&self.settings, &catalog(), "party-leader")
                .into_iter()
                .map(|i| i.card)
                .filter(|c| self.players.len() != 2 || c.slug != "the-shadow-claw")
                .collect();
            self.log("The order is set. Choose your party leaders.", "draft", now);
        }
        Ok(())
    }

    fn deal(&mut self, cards: &[Card], now: i64) {
        self.deck = build_pool(&self.settings, cards, "main");
        self.monster_deck = build_pool(&self.settings, cards, "monster");
        self.deck.shuffle(&mut rand::rng());
        self.monster_deck.shuffle(&mut rand::rng());
        for index in 0..self.players.len() {
            self.draw_to(index, 5);
        }
        self.monsters = (0..3).filter_map(|_| self.monster_deck.pop()).collect();
        let last_picker = self.draft_order.last().unwrap();
        self.active_player = self
            .players
            .iter()
            .position(|p| &p.id == last_picker)
            .unwrap();
        self.phase = "playing".into();
        self.leaders.clear();
        self.turn_deadline = Some(now + self.settings.turn_ms());
        self.log(
            &format!(
                "Five cards each. {} picked last and takes the first turn.",
                self.players[self.active_player].name
            ),
            "deal",
            now,
        );
    }

    fn draw_to(&mut self, player: usize, count: usize) {
        for _ in 0..count {
            if self.deck.is_empty() {
                self.deck.append(&mut self.discard);
                self.deck.shuffle(&mut rand::rng());
            }
            if let Some(card) = self.deck.pop() {
                self.players[player].hand.push(card);
            }
        }
    }

    fn require_phase(&self, phase: &str) -> Result<(), String> {
        ensure(
            self.phase == phase,
            "That action is not available in this phase.",
        )
    }
    fn require_turn(&self, id: &str) -> Result<(), String> {
        self.require_phase("playing")?;
        ensure(
            self.players[self.active_player].id == id,
            "It is another player's turn.",
        )
    }
    fn next_turn(&mut self, now: i64) {
        self.active_player = (self.active_player + 1) % self.players.len();
        self.action_points = 3;
        self.turn_number += 1;
        self.turn_deadline = Some(now + self.settings.turn_ms());
        self.log(
            &format!(
                "{}'s turn. Three action points.",
                self.players[self.active_player].name
            ),
            "turn",
            now,
        );
    }
    pub fn tick(&mut self, now: i64) -> bool {
        if self.phase == "playing" && self.turn_deadline.is_some_and(|d| now >= d) {
            self.log("Time is up. Passing the turn.", "timeout", now);
            self.next_turn(now);
            self.schedule_bot(now);
            self.version += 1;
            true
        } else {
            false
        }
    }

    fn bot_actor(&self) -> Option<&Player> {
        match self.phase.as_str() {
            "initiative" => self.players.iter().find(|p| {
                p.is_bot
                    && self.initiative_group.contains(&p.id)
                    && !self.rolled_in_round.contains(&p.id)
            }),
            "draft" => self
                .players
                .iter()
                .find(|p| p.is_bot && self.draft_order.get(self.draft_index) == Some(&p.id)),
            "playing" => self.players.get(self.active_player).filter(|p| p.is_bot),
            _ => None,
        }
    }

    fn schedule_bot(&mut self, now: i64) {
        self.bot_action_due = self.bot_actor().map(|_| now + BOT_DELAY_MS);
    }

    /// One paced, legal action at a time. The policy receives the same personal
    /// snapshot as a human, never another hand or the unrevealed deck order.
    pub fn tick_bot(&mut self, cards: &[Card], now: i64) -> bool {
        let Some(actor) = self.bot_actor() else {
            return false;
        };
        let id = actor.id.clone();
        let Some(due) = self.bot_action_due else {
            self.schedule_bot(now);
            self.version += 1;
            return true;
        };
        if now < due {
            return false;
        }
        let Some(command) = bot_command(&self.view(&id, now)) else {
            return false;
        };
        self.apply(
            &id,
            &CommandEnvelope {
                request_id: Uuid::new_v4().to_string(),
                expected_version: self.version,
                command,
            },
            cards,
            now,
        )
        .is_ok()
    }
    fn log(&mut self, message: &str, kind: &str, now: i64) {
        let sequence = self.events.last().map_or(1, |e| e.sequence + 1);
        self.events.push(GameEvent {
            sequence,
            message: message.into(),
            at: now,
            kind: kind.into(),
        });
        if self.events.len() > 100 {
            self.events.remove(0);
        }
    }
}

fn bot_command(view: &RoomView) -> Option<GameCommand> {
    match view.phase.as_str() {
        "initiative" => Some(GameCommand::RollInitiative),
        "draft" if !view.available_leaders.is_empty() => {
            let index = rand::rng().random_range(0..view.available_leaders.len());
            Some(GameCommand::PickLeader {
                slug: view.available_leaders[index].slug.clone(),
            })
        }
        "playing" => {
            let hand = view
                .players
                .iter()
                .find(|p| p.id == view.your_id)?
                .hand
                .as_ref()?;
            if view.action_points == 3
                && (hand.len() >= 8 || !hand.iter().any(|c| c.card.card_type == "hero"))
            {
                Some(GameCommand::RefreshHand)
            } else if view.main_deck_count > 0 || !view.discard.is_empty() {
                Some(GameCommand::Draw)
            } else {
                Some(GameCommand::EndTurn)
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn game(count: usize) -> Room {
        let (host, _) = new_player("Host").unwrap();
        let mut room = Room::new(
            "ABCDEF".into(),
            host,
            RoomSettings {
                player_count: count,
                ..Default::default()
            },
            0,
        )
        .unwrap();
        for index in 1..count {
            room.join(new_player(&format!("Player {index}")).unwrap().0, 0)
                .unwrap();
        }
        room.phase = "initiative".into();
        room.initiative_group = room.players.iter().map(|p| p.id.clone()).collect();
        room
    }
    fn roll(total: u8) -> DiceRoll {
        let a = total.saturating_sub(6).max(1);
        DiceRoll {
            dice: [a, total - a],
            total,
        }
    }
    fn command(room: &mut Room, id: &str, command: GameCommand, now: i64) -> Result<(), String> {
        room.apply(
            id,
            &CommandEnvelope {
                request_id: Uuid::new_v4().to_string(),
                expected_version: room.version,
                command,
            },
            &catalog(),
            now,
        )
    }
    #[test]
    fn inventories_match_all_four_physical_products() {
        for (expansions, main, monsters, leaders) in [
            (vec![], 115, 15, 6),
            (vec![WARRIORS], 146, 17, 8),
            (vec![BERSERKERS], 146, 17, 8),
            (vec![WARRIORS, BERSERKERS], 177, 19, 10),
        ] {
            let settings = RoomSettings {
                expansions: expansions.into_iter().map(String::from).collect(),
                ..Default::default()
            };
            assert_eq!(build_pool(&settings, &catalog(), "main").len(), main);
            assert_eq!(build_pool(&settings, &catalog(), "monster").len(), monsters);
            assert_eq!(
                build_pool(&settings, &catalog(), "party-leader").len(),
                leaders
            );
            let deck = build_pool(&settings, &catalog(), "main");
            assert_eq!(
                deck.iter().map(|i| &i.id).collect::<HashSet<_>>().len(),
                main
            );
        }
        assert_eq!(
            build_pool(&RoomSettings::default(), &catalog(), "main")
                .iter()
                .filter(|i| i.card.slug == "challenge")
                .count(),
            14
        );
    }
    #[test]
    fn reviewed_roster_excludes_unknown_cards_and_rejects_changed_counts() {
        let mut source = catalog();
        assert_eq!(source.len(), 163);
        let mut fake = source[0].clone();
        fake.slug = "invented-hero".into();
        fake.name = "Invented Hero".into();
        source.push(fake);
        let selected = select_verified_cards(&source).unwrap();
        assert_eq!(selected.len(), 163);
        assert!(!selected.iter().any(|c| c.slug == "invented-hero"));
        assert!(
            selected
                .iter()
                .all(|c| c.sets.len() == 1 && c.releases.len() == 1)
        );
        source[0].releases[0].quantity += 1;
        assert!(select_verified_cards(&source).is_err());
    }
    #[test]
    fn tiebreakers_never_escape_the_original_group() {
        let mut room = game(5);
        let ids: Vec<_> = room.players.iter().map(|p| p.id.clone()).collect();
        for (id, total) in ids.iter().zip([12, 10, 3, 5, 5]) {
            room.record_roll(id, roll(total), 0).unwrap();
        }
        assert_eq!(room.initiative_group, vec![ids[3].clone(), ids[4].clone()]);
        room.record_roll(&ids[3], roll(12), 0).unwrap();
        room.record_roll(&ids[4], roll(11), 0).unwrap();
        assert_eq!(
            room.draft_order,
            vec![
                ids[0].clone(),
                ids[1].clone(),
                ids[3].clone(),
                ids[4].clone(),
                ids[2].clone()
            ]
        );
    }
    #[test]
    fn repeated_and_separate_ties_are_resolved() {
        let mut room = game(4);
        let ids: Vec<_> = room.players.iter().map(|p| p.id.clone()).collect();
        for (id, total) in ids.iter().zip([9, 9, 4, 4]) {
            room.record_roll(id, roll(total), 0).unwrap();
        }
        for id in &ids[..2] {
            room.record_roll(id, roll(6), 0).unwrap();
        }
        room.record_roll(&ids[0], roll(3), 0).unwrap();
        room.record_roll(&ids[1], roll(12), 0).unwrap();
        assert_eq!(room.initiative_group, ids[2..]);
        room.record_roll(&ids[2], roll(8), 0).unwrap();
        room.record_roll(&ids[3], roll(2), 0).unwrap();
        assert_eq!(
            room.draft_order,
            vec![
                ids[1].clone(),
                ids[0].clone(),
                ids[2].clone(),
                ids[3].clone()
            ]
        );
    }
    #[test]
    fn last_picker_starts_and_hands_remain_private() {
        let mut room = game(2);
        let a = room.players[0].id.clone();
        let b = room.players[1].id.clone();
        room.record_roll(&a, roll(12), 0).unwrap();
        room.record_roll(&b, roll(2), 0).unwrap();
        assert!(!room.leaders.iter().any(|c| c.slug == "the-shadow-claw"));
        let slug = room.leaders[0].slug.clone();
        command(&mut room, &a, GameCommand::PickLeader { slug }, 0).unwrap();
        let slug = room.leaders[0].slug.clone();
        command(&mut room, &b, GameCommand::PickLeader { slug }, 0).unwrap();
        let view = room.view(&a, 0);
        assert_eq!(view.active_player_id, Some(b.clone()));
        assert_eq!(view.main_deck_count, 105);
        assert_eq!(view.monsters.len(), 3);
        assert_eq!(view.players[0].hand.as_ref().unwrap().len(), 5);
        assert!(view.players[1].hand.is_none());
        let serialized = serde_json::to_string(&view).unwrap();
        assert!(!serialized.contains("tokenHash"));
        assert!(!serialized.contains(&room.deck[0].id));
        assert!(command(&mut room, &a, GameCommand::Draw, 1).is_err());
        command(&mut room, &b, GameCommand::Draw, 1).unwrap();
        assert_eq!(room.players[1].hand.len(), 6);
        assert_eq!(room.turn_deadline, Some(120_000));
        assert!(!room.tick(119_999));
        assert!(room.tick(120_000));
        assert_eq!(room.active_player, 0);
    }
    #[test]
    fn duplicate_commands_are_idempotent_and_stale_writes_fail() {
        let mut room = game(2);
        room.phase = "lobby".into();
        let id = room.host_id.clone();
        let envelope = CommandEnvelope {
            request_id: "same".into(),
            expected_version: room.version,
            command: GameCommand::Ready { ready: true },
        };
        room.apply(&id, &envelope, &catalog(), 0).unwrap();
        let version = room.version;
        room.apply(&id, &envelope, &catalog(), 0).unwrap();
        assert_eq!(room.version, version);
        assert!(
            room.apply(
                &id,
                &CommandEnvelope {
                    request_id: "new".into(),
                    ..envelope
                },
                &catalog(),
                0
            )
            .is_err()
        );
    }
    #[test]
    fn settings_and_names_are_validated() {
        assert!(
            RoomSettings {
                class_target: 7,
                ..Default::default()
            }
            .validate()
            .is_err()
        );
        assert!(
            RoomSettings {
                expansions: vec![WARRIORS.into(), WARRIORS.into()],
                ..Default::default()
            }
            .validate()
            .is_err()
        );
        assert!(new_player("   ").is_err());
        assert_eq!(
            catalog()
                .iter()
                .find(|c| c.slug == "the-charismatic-song")
                .unwrap()
                .classes,
            ["bard"]
        );
    }

    #[test]
    fn only_host_can_manage_bot_seats_and_settings_keep_them_ready() {
        let mut room = game(3);
        room.phase = "lobby".into();
        room.players.pop();
        let host = room.host_id.clone();
        let guest = room.players[1].id.clone();
        assert!(command(&mut room, &guest, GameCommand::AddBot, 0).is_err());
        command(&mut room, &host, GameCommand::AddBot, 0).unwrap();
        let bot = room.players[2].clone();
        assert!(bot.is_bot && bot.ready && bot.token_hash.is_empty());
        assert!(command(&mut room, &host, GameCommand::AddBot, 0).is_err());
        assert!(room.player_id("").is_err());
        assert!(room.view(&host, 0).players[2].is_bot);
        let settings = RoomSettings {
            preset: "quick".into(),
            ..room.settings.clone()
        };
        command(&mut room, &host, GameCommand::Settings { settings }, 0).unwrap();
        assert!(!room.players[0].ready && room.players[2].ready);
        assert!(
            command(
                &mut room,
                &guest,
                GameCommand::RemoveBot {
                    player_id: bot.id.clone()
                },
                0
            )
            .is_err()
        );
        assert!(
            command(
                &mut room,
                &host,
                GameCommand::RemoveBot { player_id: guest },
                0
            )
            .is_err()
        );
        command(
            &mut room,
            &host,
            GameCommand::RemoveBot { player_id: bot.id },
            0,
        )
        .unwrap();
        assert_eq!(room.players.len(), 2);
    }

    #[test]
    fn solo_host_and_five_bots_finish_setup_and_pass_turns_without_clients() {
        let (host, _) = new_player("Practice Bot 1").unwrap();
        let host_id = host.id.clone();
        let mut room = Room::new(
            "BOTROOM1".into(),
            host,
            RoomSettings {
                player_count: 6,
                ..Default::default()
            },
            0,
        )
        .unwrap();
        let cards = catalog();
        for _ in 0..5 {
            command(&mut room, &host_id, GameCommand::AddBot, 0).unwrap();
        }
        assert_eq!(room.players[1].name, "Practice Bot 2");
        command(&mut room, &host_id, GameCommand::Ready { ready: true }, 0).unwrap();
        command(&mut room, &host_id, GameCommand::StartDraft, 0).unwrap();
        let mut time = 0;
        for _ in 0..1000 {
            if room.phase == "playing" {
                break;
            }
            time += BOT_DELAY_MS;
            if room.phase == "initiative"
                && room.initiative_group.contains(&host_id)
                && !room.rolled_in_round.contains(&host_id)
            {
                command(&mut room, &host_id, GameCommand::RollInitiative, time).unwrap();
            } else if room.phase == "draft" && room.draft_order[room.draft_index] == host_id {
                let slug = room.leaders[0].slug.clone();
                command(&mut room, &host_id, GameCommand::PickLeader { slug }, time).unwrap();
            } else {
                assert!(room.tick_bot(&cards, time));
            }
        }
        assert_eq!(room.phase, "playing");
        assert_eq!(room.deck.len(), 85);
        assert_eq!(
            room.players
                .iter()
                .filter_map(|p| p.leader.as_ref().map(|l| &l.slug))
                .collect::<HashSet<_>>()
                .len(),
            6
        );
        assert!(command(&mut room, &host_id, GameCommand::AddBot, time).is_err());
        for p in room
            .view(&host_id, time)
            .players
            .iter()
            .filter(|p| p.is_bot)
        {
            assert!(p.hand.is_none());
        }
        if room.players[room.active_player].id == host_id {
            command(&mut room, &host_id, GameCommand::EndTurn, time).unwrap();
        }
        let version = room.version;
        assert!(!room.tick_bot(&cards, time));
        assert_eq!(room.version, version);
        let mut actions = 0;
        while room.players[room.active_player].is_bot && actions < 16 {
            time = room.bot_action_due.unwrap();
            assert!(room.tick_bot(&cards, time));
            actions += 1;
        }
        assert!(actions > 0);
        assert_eq!(room.players[room.active_player].id, host_id);
        assert!(room.bot_action_due.is_none());
        assert!(!room.tick_bot(&cards, time + BOT_DELAY_MS));
        // Removing a bot flag from a legacy snapshot must still restore human seats.
        let mut snapshot = serde_json::to_value(&room).unwrap();
        snapshot["players"][0]
            .as_object_mut()
            .unwrap()
            .remove("isBot");
        snapshot.as_object_mut().unwrap().remove("botActionDue");
        let restored: Room = serde_json::from_value(snapshot).unwrap();
        assert!(!restored.players[0].is_bot);
        assert_eq!(restored.players[1].is_bot, room.players[1].is_bot);
    }

    #[test]
    fn bot_policy_uses_only_own_hand_and_ends_when_no_draws_are_possible() {
        let mut room = game(2);
        room.phase = "playing".into();
        room.players[1].is_bot = true;
        room.active_player = 1;
        room.action_points = 2;
        let bot_id = room.players[1].id.clone();
        let view = room.view(&bot_id, 0);
        assert!(view.players[0].hand.is_none());
        assert!(matches!(bot_command(&view), Some(GameCommand::EndTurn)));
        room.action_points = 3;
        assert!(matches!(
            bot_command(&room.view(&bot_id, 0)),
            Some(GameCommand::RefreshHand)
        ));
        // Pending automation survives a snapshot and still obeys its delay.
        room.schedule_bot(0);
        let mut restored: Room =
            serde_json::from_str(&serde_json::to_string(&room).unwrap()).unwrap();
        assert!(!restored.tick_bot(&catalog(), BOT_DELAY_MS - 1));
        assert!(restored.tick_bot(&catalog(), BOT_DELAY_MS));
        assert_eq!(restored.active_player, 0);
        let host = restored.host_id.clone();
        command(&mut restored, &host, GameCommand::Abort, BOT_DELAY_MS).unwrap();
        assert!(!restored.tick_bot(&catalog(), BOT_DELAY_MS * 10));
    }

    #[test]
    fn bots_reroll_only_inside_their_tied_group() {
        let mut room = game(4);
        room.players[1].is_bot = true;
        room.players[2].is_bot = true;
        let ids: Vec<_> = room.players.iter().map(|p| p.id.clone()).collect();
        for (id, total) in ids.iter().zip([12, 5, 5, 3]) {
            room.record_roll(id, roll(total), 0).unwrap();
        }
        room.schedule_bot(0);
        assert_eq!(room.initiative_group, ids[1..3]);
        assert!(room.tick_bot(&catalog(), BOT_DELAY_MS));
        assert!(room.tick_bot(&catalog(), BOT_DELAY_MS * 2));
        assert_eq!(room.players[0].rolls.len(), 1);
        assert_eq!(room.players[3].rolls.len(), 1);
        assert_eq!(room.players[1].rolls.len(), 2);
        assert_eq!(room.players[2].rolls.len(), 2);
        if room.phase == "draft" {
            assert_eq!(room.draft_order.first(), Some(&ids[0]));
            assert_eq!(room.draft_order.last(), Some(&ids[3]));
        } else {
            assert_eq!(room.initiative_group, ids[1..3]);
        }
    }
}
