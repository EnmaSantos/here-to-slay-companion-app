FROM rust:1.96-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY data ./data
COPY migrations ./migrations
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --create-home slay
COPY --from=build /app/target/release/slay-server /usr/local/bin/slay-server
USER slay
WORKDIR /home/slay
ENV BIND_ADDRESS=0.0.0.0:8080
ENV SLAY_DATA_DIR=/home/slay/data
EXPOSE 8080
CMD ["slay-server"]
