import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { GAMES, getGame } from "@/lib/games";

// Same reasoning as the detail route: prerendering the fixed catalogue and
// closing the segment makes an unknown id a routing-level 404, so the themed
// not-found page is served as full HTML.
export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ id: game.id }));
}

export async function generateMetadata(
  props: PageProps<"/jugar/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const game = getGame(id);
  return { title: game ? `Jugando · ${game.title}` : undefined };
}

export default async function PlayerPage(props: PageProps<"/jugar/[id]">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
