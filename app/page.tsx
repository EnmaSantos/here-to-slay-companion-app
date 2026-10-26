import type { Metadata } from "next";
import { GameApp } from "@/components/game-ui";

export const metadata: Metadata = {
  title: "Here to Slay — Your next game night",
  description:
    "Gather your party, roll for your leader, and bring a little delightful chaos to game night. Private tables for 2–6 friends.",
};

export default function Home() {
  return <GameApp />;
}
