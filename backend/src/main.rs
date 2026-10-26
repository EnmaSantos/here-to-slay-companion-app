use axum::{
    Json, Router,
    extract::{
        Path, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{HeaderMap, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};
use slay_server::engine::*;
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{Mutex, RwLock, watch};
use tower_http::cors::CorsLayer;

type ApiResult<T> = Result<Json<T>, ApiError>;
struct ApiError(StatusCode, String);
impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.0, Json(json!({"error":self.1}))).into_response()
    }
}
fn bad(message: impl Into<String>) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, message.into())
}
fn internal(error: impl std::fmt::Display) -> ApiError {
    tracing::error!("{error}");
    ApiError(
        StatusCode::INTERNAL_SERVER_ERROR,
        "The table could not be saved. Please try again.".into(),
    )
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

struct Hub {
    room: Mutex<Room>,
    changes: watch::Sender<Room>,
}
struct App {
    rooms: RwLock<HashMap<String, Arc<Hub>>>,
    cards: Vec<Card>,
    directory: PathBuf,
    database: Option<PgPool>,
}

impl App {
    async fn persist(&self, room: &Room) -> Result<(), ApiError> {
        if let Some(pool) = &self.database {
            sqlx::query("insert into slay_private.rooms (code, state, updated_at) values ($1, $2, now()) on conflict (code) do update set state = excluded.state, updated_at = now()")
                .bind(&room.code).bind(sqlx::types::Json(room)).execute(pool).await.map_err(internal)?;
        } else {
            let target = self.directory.join(format!("{}.json", room.code));
            let temporary = self.directory.join(format!("{}.tmp", room.code));
            let bytes = serde_json::to_vec(room).map_err(internal)?;
            tokio::fs::write(&temporary, bytes)
                .await
                .map_err(internal)?;
            tokio::fs::rename(&temporary, &target)
                .await
                .map_err(internal)?;
        }
        Ok(())
    }
    async fn hub(&self, code: &str) -> Result<Arc<Hub>, ApiError> {
        self.rooms
            .read()
            .await
            .get(&code.to_uppercase())
            .cloned()
            .ok_or(ApiError(
                StatusCode::NOT_FOUND,
                "That room could not be found. Check the code.".into(),
            ))
    }
}

fn bearer(headers: &HeaderMap) -> Result<&str, ApiError> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|v| v.len() == 64)
        .ok_or(ApiError(
            StatusCode::UNAUTHORIZED,
            "Rejoin this table with your guest session.".into(),
        ))
}
fn authorize(room: &Room, headers: &HeaderMap) -> Result<String, ApiError> {
    room.player_id(bearer(headers)?)
        .map_err(|e| ApiError(StatusCode::UNAUTHORIZED, e))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoom {
    name: String,
    settings: RoomSettings,
}
#[derive(Deserialize)]
struct JoinRoom {
    name: String,
}

async fn health(State(app): State<Arc<App>>) -> Json<Value> {
    Json(
        json!({"status":"ok","engine":"rust","version":env!("CARGO_PKG_VERSION"),"persistence":if app.database.is_some(){"postgres"}else{"local-file"},"milestone":"rooms-draft-deal","capabilities":["rooms","settings","practice-bots","initiative","nested-tiebreaks","leader-draft","exact-inventory","private-hands","draw","refresh-hand","turn-timers","reconnect"]}),
    )
}
async fn get_catalog(State(app): State<Arc<App>>) -> Json<Value> {
    Json(json!({"data":app.cards,"version":"2026-10-25-retail-inventory-v1"}))
}

async fn create_room(
    State(app): State<Arc<App>>,
    Json(body): Json<CreateRoom>,
) -> ApiResult<Value> {
    let (host, token) = new_player(&body.name).map_err(bad)?;
    let id = host.id.clone();
    let mut rooms = app.rooms.write().await;
    if rooms.len() >= 1000 {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "All tables are busy. Please try later.".into(),
        ));
    }
    let mut code;
    loop {
        code = uuid::Uuid::new_v4().simple().to_string()[..8].to_uppercase();
        if !rooms.contains_key(&code) {
            break;
        }
    }
    let room = Room::new(code.clone(), host, body.settings, now()).map_err(bad)?;
    app.persist(&room).await?;
    let view = room.view(&id, now());
    let (changes, _) = watch::channel(room.clone());
    rooms.insert(
        code,
        Arc::new(Hub {
            room: Mutex::new(room),
            changes,
        }),
    );
    Ok(Json(json!({"token":token,"room":view})))
}
async fn join_room(
    State(app): State<Arc<App>>,
    Path(code): Path<String>,
    Json(body): Json<JoinRoom>,
) -> ApiResult<Value> {
    let hub = app.hub(&code).await?;
    let mut guard = hub.room.lock().await;
    let (player, token) = new_player(&body.name).map_err(bad)?;
    let id = player.id.clone();
    let mut next = guard.clone();
    next.join(player, now()).map_err(bad)?;
    app.persist(&next).await?;
    *guard = next;
    hub.changes.send_replace(guard.clone());
    Ok(Json(json!({"token":token,"room":guard.view(&id, now())})))
}
async fn get_room(
    State(app): State<Arc<App>>,
    Path(code): Path<String>,
    headers: HeaderMap,
) -> ApiResult<RoomView> {
    let hub = app.hub(&code).await?;
    let room = hub.room.lock().await;
    let id = authorize(&room, &headers)?;
    Ok(Json(room.view(&id, now())))
}
async fn command(
    State(app): State<Arc<App>>,
    Path(code): Path<String>,
    headers: HeaderMap,
    Json(body): Json<CommandEnvelope>,
) -> ApiResult<RoomView> {
    let hub = app.hub(&code).await?;
    let mut guard = hub.room.lock().await;
    let id = authorize(&guard, &headers)?;
    // Mutate a candidate so persistence failures never leave an uncommitted live state.
    let mut next = guard.clone();
    // Enforce deadlines here as well as on the background clock, closing the tick race.
    let advanced = next.tick(now());
    if advanced {
        app.persist(&next).await?;
        *guard = next.clone();
        hub.changes.send_replace(next.clone());
    }
    next.apply(&id, &body, &app.cards, now()).map_err(|e| {
        ApiError(
            if e.starts_with("The table changed") {
                StatusCode::CONFLICT
            } else {
                StatusCode::BAD_REQUEST
            },
            e,
        )
    })?;
    app.persist(&next).await?;
    *guard = next;
    hub.changes.send_replace(guard.clone());
    Ok(Json(guard.view(&id, now())))
}

async fn upgrade(
    State(app): State<Arc<App>>,
    Path(code): Path<String>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, ApiError> {
    let hub = app.hub(&code).await?;
    // Browser WebSockets do not use CORS. Validate their Origin explicitly.
    let allowed = allowed_origins();
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !allowed.iter().any(|value| value == origin) {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "This origin cannot connect to the table.".into(),
        ));
    }
    Ok(ws
        .max_message_size(4096)
        .on_upgrade(move |socket| room_socket(socket, hub)))
}
async fn room_socket(mut socket: WebSocket, hub: Arc<Hub>) {
    // Authenticate inside the encrypted socket, never in a query string or access log.
    let first = tokio::time::timeout(std::time::Duration::from_secs(5), socket.recv()).await;
    let token = match first {
        Ok(Some(Ok(Message::Text(text)))) => serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|v| v.get("token").and_then(Value::as_str).map(str::to_owned)),
        _ => None,
    };
    let Some(token) = token.filter(|t| t.len() == 64) else {
        let _ = socket.send(Message::Close(None)).await;
        return;
    };
    let mut updates = hub.changes.subscribe();
    let initial = updates.borrow_and_update().clone();
    let Ok(id) = initial.player_id(&token) else {
        let _ = socket.send(Message::Close(None)).await;
        return;
    };
    if send_view(&mut socket, &initial, &id).await.is_err() {
        return;
    }
    let mut ping = tokio::time::interval(std::time::Duration::from_secs(20));
    loop {
        tokio::select! {
            result = updates.changed() => {
                if result.is_err() { break; }
                let room = updates.borrow_and_update().clone();
                if send_view(&mut socket, &room, &id).await.is_err() { break; }
            }
            message = socket.recv() => match message {
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                Some(Ok(Message::Ping(data))) => if socket.send(Message::Pong(data)).await.is_err() { break; },
                _ => {}
            },
            _ = ping.tick() => if socket.send(Message::Ping(vec![].into())).await.is_err() { break; }
        }
    }
}
async fn send_view(socket: &mut WebSocket, room: &Room, id: &str) -> Result<(), axum::Error> {
    socket
        .send(Message::Text(
            json!({"type":"snapshot","room":room.view(id, now())})
                .to_string()
                .into(),
        ))
        .await
}
fn allowed_origins() -> Vec<String> {
    std::env::var("FRONTEND_ORIGINS").unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173".into()).split(',').map(|s| s.trim().trim_end_matches('/').into()).filter(|s: &String| !s.is_empty()).collect()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "slay_server=info,tower_http=info".into()),
        )
        .init();
    let directory = PathBuf::from(
        std::env::var("SLAY_DATA_DIR").unwrap_or_else(|_| "backend/.slay-data".into()),
    );
    tokio::fs::create_dir_all(&directory).await?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).await?;
    }
    let database = if let Ok(url) = std::env::var("DATABASE_URL") {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await?;
        // Provision through the checked-in SQL migration, not at request time.
        sqlx::raw_sql(include_str!("../migrations/001_rooms.sql"))
            .execute(&pool)
            .await?;
        Some(pool)
    } else {
        None
    };
    let mut rooms = HashMap::new();
    let snapshots: Vec<Room> = if let Some(pool) = &database {
        sqlx::query_scalar::<_, sqlx::types::Json<Room>>("select state from slay_private.rooms")
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|r| r.0)
            .collect()
    } else {
        let mut entries = tokio::fs::read_dir(&directory).await?;
        let mut snapshots = vec![];
        while let Some(entry) = entries.next_entry().await? {
            if entry.path().extension().is_some_and(|e| e == "json") {
                let bytes = tokio::fs::read(entry.path()).await?;
                snapshots.push(serde_json::from_slice(&bytes)?);
            }
        }
        snapshots
    };
    for mut room in snapshots {
        // Restarting cannot silently spend a disconnected player's turn budget.
        if room.phase == "playing" {
            room.turn_deadline = Some(now() + room.settings.turn_ms());
            room.version += 1;
        }
        let (changes, _) = watch::channel(room.clone());
        rooms.insert(
            room.code.clone(),
            Arc::new(Hub {
                room: Mutex::new(room),
                changes,
            }),
        );
    }
    let app = Arc::new(App {
        rooms: RwLock::new(rooms),
        cards: catalog(),
        directory,
        database,
    });
    let clock = app.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(250));
        loop {
            interval.tick().await;
            let hubs: Vec<_> = clock.rooms.read().await.values().cloned().collect();
            for hub in hubs {
                let mut guard = hub.room.lock().await;
                let mut candidate = guard.clone();
                let time = now();
                let timed_out = candidate.tick(time);
                let bot_acted = candidate.tick_bot(&clock.cards, time);
                if (timed_out || bot_acted) && clock.persist(&candidate).await.is_ok() {
                    *guard = candidate;
                    hub.changes.send_replace(guard.clone());
                }
            }
        }
    });
    let origins: Vec<axum::http::HeaderValue> = allowed_origins()
        .iter()
        .map(|s| s.parse())
        .collect::<Result<_, _>>()?;
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);
    let router = Router::new()
        .route("/api/health", get(health))
        .route("/api/catalog", get(get_catalog))
        .route("/api/rooms", post(create_room))
        .route("/api/rooms/{code}/join", post(join_room))
        .route("/api/rooms/{code}", get(get_room))
        .route("/api/rooms/{code}/commands", post(command))
        .route("/api/rooms/{code}/ws", get(upgrade))
        .layer(axum::extract::DefaultBodyLimit::max(16 * 1024))
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(app);
    let address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!("Here to Slay Rust server listening on http://{address}");
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
