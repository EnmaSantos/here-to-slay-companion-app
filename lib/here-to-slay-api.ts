export const HERE_TO_SLAY_API =
  "https://bslsfzvnanjzjrgyvrdj.supabase.co/functions/v1/cards-api";

export type CardQuery = {
  type?: string;
  class?: string;
  set?: string;
  search?: string;
  sort?: "name" | "-name" | "updatedAt" | "-updatedAt";
  limit?: number;
  offset?: number;
};

export type Pagination = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type CardRelease = {
  date: string;
  set: string;
  setName: string;
  quantity: number;
};

export type Card = {
  id: number;
  slug: string;
  name: string;
  type: string;
  set: string;
  sets: string[];
  expansion: string | null;
  kickstarterExclusive: boolean;
  classes: string[];
  effect: string | null;
  imageUrl: string | null;
  wikiUrl: string | null;
  dataCompleteness: "complete" | "partial";
  rollRequirement?: string | null;
  itemType?: "regular" | "cursed";
  heroRequirement?: string | null;
  slayRollRequirement?: string | null;
  failureRollRequirement?: string | null;
  failurePenalty?: string | null;
  passiveAbility?: string | null;
  claimRequirement?: string | null;
  requirements?: string | null;
  rules?: string[];
  releases?: CardRelease[];
};

export type CardMetadata = {
  generatedAt: string;
  totalCards: number;
  countsByType: Record<string, number>;
  filters: {
    types: string[];
    classes: string[];
    sets: string[];
  };
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${HERE_TO_SLAY_API}${path}`, {
    headers: { Accept: "application/json" },
  });
  const body = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const apiError = body as ApiError;
    throw new Error(
      apiError.error?.message ?? `Card API request failed (${response.status})`,
    );
  }

  return body as T;
}

export async function getCards(query: CardQuery = {}) {
  const parameters = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      parameters.set(key, String(value));
    }
  }

  const queryString = parameters.toString();
  return apiGet<{ data: Card[]; pagination: Pagination }>(
    `/api/v1/cards${queryString ? `?${queryString}` : ""}`,
  );
}

export async function getCard(slug: string) {
  return apiGet<{ data: Card }>(
    `/api/v1/cards/${encodeURIComponent(slug)}`,
  );
}

export async function getMetadata() {
  return apiGet<{ data: CardMetadata }>("/api/v1/meta");
}
