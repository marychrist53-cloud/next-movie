import {
	fetchDiscover,
	fetchGenres,
	fetchMediaList,
	fetchSearchMulti,
	fetchSimilar,
} from "@/lib/tmdb";
import { generateGeminiResponse } from "@/lib/gemini";
import { generateOpenAIResponse, getChatLlm } from "@/lib/llm";
import type { MediaType, MovieType } from "@/types/global";

export type ChatMessage = {
	role: "user" | "assistant";
	content: string;
	results?: ChatResultItem[];
};

export type ChatResultItem = {
	id: number;
	media_type: MediaType;
	title: string;
	poster_path: string | null;
	release_date: string | null;
	vote_average: number;
	overview?: string;
};

export type ChatResponse = {
	reply: string;
	results?: ChatResultItem[];
	mode: "ai" | "local";
};

function toResultItem(item: MovieType): ChatResultItem {
	const overview = item.overview?.replace(/\s+/g, " ").trim();
	return {
		id: item.id,
		media_type: item.media_type ?? "movie",
		title: item.title,
		poster_path: item.poster_path,
		release_date: item.release_date,
		vote_average: item.vote_average,
		overview: overview ? overview.slice(0, 280) : undefined,
	};
}

function yearLabel(date: string | null | undefined): string {
	const year = (date ?? "").slice(0, 4);
	return /^\d{4}$/.test(year) ? year : "";
}

function describeTitle(item: ChatResultItem): string {
	const year = yearLabel(item.release_date);
	const rating =
		item.vote_average > 0 ? ` · ★ ${item.vote_average.toFixed(1)}` : "";
	const overview = item.overview?.trim();
	return `${item.title}${year ? ` (${year})` : ""}${rating}.${overview ? ` ${overview}` : ""}`;
}

/* ----------------------------- local assistant ---------------------------- */

const STOPWORDS = new Set(
	"a an the and or but if then else of for to in on at by with about into over after is are was were be been being it its this that these those i you he she they we me my your his her their our us them there here what which who whom whose when where why how can could should would will shall may might must do does did done have has had having not no nor so too very just also movie film movies films show shows series watch find looking something like where plot story about".split(
		" ",
	),
);

const PLOT_STOPWORDS = new Set([
	...STOPWORDS,
	"people",
	"people's",
	"person",
	"persons",
	"enter",
	"enters",
	"entered",
	"entering",
	"goes",
	"going",
	"gets",
	"make",
	"makes",
	"made",
]);

function extractKeywords(text: string, extraStopwords = STOPWORDS): string[] {
	return [
		...new Set(
			text
				.toLowerCase()
				.replace(/[^a-z0-9\s']/g, " ")
				.split(/\s+/)
				.filter(w => w.length > 2 && !extraStopwords.has(w)),
		),
	];
}

export function looksLikePlotQuery(text: string): boolean {
	const lower = text.toLowerCase();
	const wordCount = text.split(/\s+/).filter(Boolean).length;
	if (looksLikeSmalltalk(text) || looksLikeFollowUp(text)) return false;
	if (/^(find|identify|name) a (movie|film|show|series)/.test(lower)) return true;
	if (/\b(plot|synopsis|describe|described)\b/.test(lower)) return true;
	if (/\bwho\b.+\b(enter|steal|dream|kill|save|find|lost|travel|wake|infiltrat)\w*/.test(lower)) {
		return true;
	}
	if (wordCount >= 8 && /\b(who|where|about a|about an)\b/.test(lower)) return true;
	return wordCount >= 10;
}

const SMALLTALK =
	/^(hi|hello|hey|hey there|hiya|yo|sup|thanks|thank you|thx|ty|ok|okay|cool|great|nice|awesome|bye|goodbye|see ya|how are you|what'?s up|good morning|good evening|good night)[\s!.?]*$/i;

const FOLLOW_UP =
	/\b(more|another|else|instead|that one|this one|those|these|the first|the second|the third|similar|same vibe|same|darker|funnier|scarier|lighter|newer|older|shorter|longer|tell me more|what about|how about|which (one|of)|pick one|the other|too|watch next|if i (loved|liked)|loved (that|the|it))\b/i;

const CATALOG_INTENT =
	/\b(movie|movies|film|films|show|shows|series|anime|watch|recommend|recommendation|horror|comedy|thriller|romance|drama|action|sci-?fi|theater|theatre|cinema|upcoming|plot|trailer)\b/i;

const GENRES: Record<string, string> = {
	action: "Action",
	comedy: "Comedy",
	horror: "Horror",
	romance: "Romance",
	"sci-fi": "Science Fiction",
	"science fiction": "Science Fiction",
	thriller: "Thriller",
	drama: "Drama",
	animation: "Animation",
	animated: "Animation",
	fantasy: "Fantasy",
	crime: "Crime",
	documentary: "Documentary",
	family: "Family",
	mystery: "Mystery",
	war: "War",
	western: "Western",
	history: "History",
	historical: "History",
	music: "Music",
	adventure: "Adventure",
};

export function looksLikeSmalltalk(text: string): boolean {
	return SMALLTALK.test(text.trim());
}

export function looksLikeFollowUp(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	const lower = trimmed.toLowerCase();
	if (FOLLOW_UP.test(lower)) return true;
	const words = trimmed.split(/\s+/).filter(Boolean);
	if (words.length > 5 || CATALOG_INTENT.test(lower)) return false;
	return /\b(that|those|these|it|them|one)\b/i.test(lower);
}

function findGenreKey(text: string): string | undefined {
	const lower = text.toLowerCase();
	return Object.keys(GENRES).find(genre => lower.includes(genre));
}

function lastAssistantResults(messages: ChatMessage[]): ChatResultItem[] {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "assistant" && message.results?.length) {
			return message.results.slice(0, 8);
		}
	}
	return [];
}

function pickReferencedResult(
	text: string,
	results: ChatResultItem[],
): ChatResultItem | null {
	if (!results.length) return null;
	const lower = text.toLowerCase();
	const byTitle = results.find(item =>
		lower.includes(item.title.toLowerCase()),
	);
	if (byTitle) return byTitle;
	if (/\b(last|final)\b/.test(lower)) return results[results.length - 1] ?? null;
	if (/\b(third|3rd)\b/.test(lower)) return results[2] ?? results[0] ?? null;
	if (/\b(second|2nd)\b/.test(lower)) return results[1] ?? results[0] ?? null;
	if (/\b(first|1st|that one|this one|the movie|the show|it)\b/.test(lower)) {
		return results[0] ?? null;
	}
	return null;
}

type ConversationContext = {
	lastUser: string;
	lower: string;
	wordCount: number;
	lastResults: ChatResultItem[];
	rememberedGenre?: string;
	rememberedSimilar?: string;
	isSmalltalk: boolean;
	isFollowUp: boolean;
};

function conversationContext(messages: ChatMessage[]): ConversationContext {
	const lastUser = [...messages].reverse().find(message => message.role === "user");
	const text = (lastUser?.content ?? "").trim();
	const lower = text.toLowerCase();
	const lastResults = lastAssistantResults(messages.slice(0, -1));
	const earlier = messages
		.filter(message => message.content !== text)
		.map(message => message.content)
		.join(" ");
	const similarMatch = earlier.match(
		/(?:similar to|like)\s+([A-Za-z0-9:'! .,&-]{2,80})/i,
	);

	return {
		lastUser: text,
		lower,
		wordCount: text.split(/\s+/).filter(Boolean).length,
		lastResults,
		rememberedGenre: findGenreKey(text) ?? findGenreKey(earlier),
		rememberedSimilar: similarMatch?.[1]?.replace(/[?.!]+$/, "").trim(),
		isSmalltalk: looksLikeSmalltalk(text) && !CATALOG_INTENT.test(lower),
		isFollowUp: Boolean(lastResults.length) && looksLikeFollowUp(text),
	};
}

function keywordMatches(haystack: string, keyword: string): boolean {
	if (haystack.includes(keyword)) return true;
	if (keyword.endsWith("s") && haystack.includes(keyword.slice(0, -1))) return true;
	return false;
}

async function searchBySynopsis(synopsis: string): Promise<MovieType[]> {
	const keywords = extractKeywords(synopsis, PLOT_STOPWORDS);
	if (!keywords.length) return [];

	const cleaned = synopsis.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
	const queries = [cleaned, keywords.join(" "), ...keywords.slice(0, 3)].filter(
		(query, index, list) => query.length > 2 && list.indexOf(query) === index,
	);
	const candidateLists = await Promise.allSettled(
		queries.map(q => fetchSearchMulti(q, 1)),
	);

	const seen = new Set<string>();
	const candidates: MovieType[] = [];
	for (const list of candidateLists) {
		if (list.status !== "fulfilled") continue;
		for (const item of list.value.results) {
			const key = `${item.media_type}-${item.id}`;
			if (seen.has(key) || !item.poster_path) continue;
			seen.add(key);
			candidates.push(item);
		}
	}

	const scored = candidates
		.map(item => {
			const overview = item.overview?.toLowerCase() ?? "";
			const title = item.title.toLowerCase();
			let overviewHits = 0;
			let score = 0;
			for (const kw of keywords) {
				if (keywordMatches(overview, kw)) {
					overviewHits += 1;
					score += 2;
				} else if (keywordMatches(title, kw)) {
					score += 0.5;
				}
			}
			score += (item.vote_average ?? 0) / 10;
			score += (item.popularity ?? 0) / 100;
			return { item, score, overviewHits };
		})
		.filter(entry => entry.overviewHits >= Math.min(2, keywords.length))
		.sort((a, b) => b.score - a.score)
		.slice(0, 8);

	return scored.map(entry => entry.item);
}

async function genreIdFromName(name: string): Promise<number | null> {
	const genres = await fetchGenres();
	const lower = name.toLowerCase();
	const match = genres.find(
		g => g.name.toLowerCase() === lower || g.name.toLowerCase().includes(lower),
	);
	return match?.id ?? null;
}

async function similarToItem(
	item: ChatResultItem,
	prefix: string,
): Promise<ChatResponse | null> {
	const similar = await fetchSimilar(item.media_type, String(item.id));
	if (!similar.length) return null;
	return {
		reply: prefix,
		results: similar.slice(0, 8).map(toResultItem),
		mode: "local",
	};
}

async function localAgent(messages: ChatMessage[]): Promise<ChatResponse> {
	const ctx = conversationContext(messages);
	const text = ctx.lastUser;
	const lower = ctx.lower;

	if (!text) {
		return {
			reply:
				"Hi! I can find movies, recommend titles, or identify a film from a plot. What are you in the mood for?",
			mode: "local",
		};
	}

	if (ctx.isSmalltalk) {
		if (/thanks|thank you|thx|ty/i.test(text)) {
			return {
				reply: "Anytime. Want another recommendation, a similar title, or a different genre?",
				mode: "local",
			};
		}
		if (/bye|goodbye|see ya|good night/i.test(text)) {
			return {
				reply: "See you. Come back when you want something to watch.",
				mode: "local",
			};
		}
		return {
			reply:
				"Hey! Tell me a mood, a genre, a title you liked, or a plot you remember and I'll find something.",
			mode: "local",
		};
	}

	try {
		if (ctx.isFollowUp && ctx.lastResults.length) {
			const referenced = pickReferencedResult(text, ctx.lastResults);
			if (
				referenced &&
				/\b(first|1st|second|2nd|third|3rd|last|that one|this one|tell me more|about it|is it good|should i watch|the movie|the show)\b/i.test(
					text,
				)
			) {
				return {
					reply: describeTitle(referenced),
					results: [referenced],
					mode: "local",
				};
			}

			if (/\b(which|pick|best of|recommend one)\b/i.test(lower)) {
				const ranked = [...ctx.lastResults].sort(
					(a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
				);
				const pick = ranked[0];
				return {
					reply: pick
						? `I'd start with ${describeTitle(pick)}`
						: "Which of those did you want to know more about?",
					results: ctx.lastResults,
					mode: "local",
				};
			}

			if (
				/\b(more like|similar|another like|same vibe|more of (that|those|them)|watch next|if i (loved|liked))\b/i.test(
					lower,
				)
			) {
				const seed = referenced ?? ctx.lastResults[0];
				const similar = await similarToItem(
					seed,
					`If you liked ${seed.title}, try these:`,
				);
				if (similar) return similar;
			}

			if (
				/\b(more|another|else|something else)\b/i.test(lower) &&
				!findGenreKey(text)
			) {
				const seed = ctx.lastResults[0];
				const similar = await similarToItem(
					seed,
					`Here are more in the same vein as ${seed.title}:`,
				);
				if (similar) return similar;
			}
		}

		if (ctx.wordCount <= 3 && /recommend|search|find/.test(lower)) {
			const data = await fetchMediaList("movie", "popular", 1);
			if (data.results.length) {
				return {
					reply: "Here are some popular movies you might like:",
					results: data.results.slice(0, 8).map(toResultItem),
					mode: "local",
				};
			}
		}

		if (/in (theaters|cinemas)|now playing|currently playing/.test(lower)) {
			const data = await fetchMediaList("movie", "now-playing", 1);
			return {
				reply: "Here is what is in theaters right now:",
				results: data.results.slice(0, 8).map(toResultItem),
				mode: "local",
			};
		}

		if (/upcoming|coming soon|not yet released/.test(lower)) {
			const data = await fetchMediaList("movie", "upcoming", 1);
			return {
				reply: "Upcoming releases:",
				results: data.results.slice(0, 8).map(toResultItem),
				mode: "local",
			};
		}

		const similarMatch = text.match(
			/(?:movies?|films?|shows?|series)?\s*(?:similar to|like)\s+(.+)/i,
		);
		const similarTitle = similarMatch?.[1]?.trim() ?? ctx.rememberedSimilar;
		if (similarTitle && (similarMatch || /\bsimilar\b/i.test(lower))) {
			const search = await fetchSearchMulti(similarTitle, 1);
			const best = search.results[0];
			if (best) {
				const similar = await fetchSimilar(best.media_type ?? "movie", String(best.id));
				return {
					reply: `If you liked ${best.title}, try these:`,
					results: similar.slice(0, 8).map(toResultItem),
					mode: "local",
				};
			}
		}

		if (
			looksLikePlotQuery(text) &&
			(messages.length <= 1 ||
				/\b(plot|synopsis|identify|name (the|a) (movie|film|show))\b/i.test(lower))
		) {
			const results = await searchBySynopsis(text);
			if (results.length) {
				return {
					reply: "These look closest to the plot you described:",
					results: results.map(toResultItem),
					mode: "local",
				};
			}
			return {
				reply:
					"I could not match that plot from catalog titles alone. Add an AI or Gemini API key for plot identification, or try the film title if you remember it.",
				mode: "local",
			};
		}

		const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
		const decadeMatch = lower.match(/\b(?:19|20)?(\d)0s\b/);
		const genreKey =
			findGenreKey(text) ??
			(yearMatch || decadeMatch || ctx.isFollowUp
				? ctx.rememberedGenre
				: undefined);
		const wantsBest = /best|top|highly rated|greatest/.test(lower);

		if (genreKey || yearMatch || decadeMatch) {
			let dateFrom: string | undefined;
			let dateTo: string | undefined;
			if (decadeMatch) {
				const prefix = Number(decadeMatch[1]);
				const start = prefix >= 3 ? 1900 + prefix * 10 : 2000 + prefix * 10;
				dateFrom = String(start);
				dateTo = String(start + 9);
			} else if (yearMatch) {
				dateFrom = yearMatch[0];
				dateTo = yearMatch[0];
			}

			const genreId = genreKey ? await genreIdFromName(GENRES[genreKey]) : null;
			const data = await fetchDiscover({
				genres: genreId ? [String(genreId)] : undefined,
				sortBy: wantsBest ? "vote_average.desc" : "popularity.desc",
				dateFrom,
				dateTo,
				minVote: wantsBest ? "7.5" : undefined,
			});
			if (data.results.length) {
				return {
					reply: `Here are ${wantsBest ? "highly rated" : "popular"} picks${genreKey ? ` in ${GENRES[genreKey]}` : ""}${decadeMatch ? ` from the ${decadeMatch[0]}` : ""}:`,
					results: data.results.slice(0, 8).map(toResultItem),
					mode: "local",
				};
			}
		}

		if (ctx.isFollowUp && ctx.lastResults.length) {
			return {
				reply: "Want a similar title, a different genre, or more about one of these?",
				results: ctx.lastResults,
				mode: "local",
			};
		}

		const search = await fetchSearchMulti(text, 1);
		if (search.results.length) {
			const best = search.results[0];
			return {
				reply: `Top match: ${best.title}${best.release_date ? ` (${best.release_date.slice(0, 4)})` : ""}. ${best.overview?.slice(0, 180) ?? ""}`,
				results: search.results.slice(0, 8).map(toResultItem),
				mode: "local",
			};
		}

		return {
			reply: "I could not find anything for that. Try a title, a genre (e.g. \"90s horror\"), or describe a plot.",
			mode: "local",
		};
	} catch {
		return {
			reply: "Something went wrong while searching — please try again.",
			mode: "local",
		};
	}
}

/* --------------------------------- entry ----------------------------------- */

async function resolveOfficialTitles(
	titles: string[],
	previous: ChatResultItem[],
): Promise<ChatResultItem[]> {
	const seen = new Set<string>();
	const results: ChatResultItem[] = [];

	for (const raw of titles) {
		const title = raw.trim();
		if (title.length < 2) continue;
		const fromPrevious = previous.find(
			item => item.title.toLowerCase() === title.toLowerCase(),
		);
		const item = fromPrevious ?? (await searchOfficialTitle(title));
		if (!item) continue;
		const key = `${item.media_type}-${item.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		results.push(item);
		if (results.length >= 8) break;
	}

	return results;
}

async function searchOfficialTitle(title: string): Promise<ChatResultItem | null> {
	const search = await fetchSearchMulti(title, 1);
	const lower = title.toLowerCase();
	const best =
		search.results.find(item => item.title.toLowerCase() === lower) ??
		search.results.find(
			item =>
				item.title.toLowerCase().includes(lower) ||
				lower.includes(item.title.toLowerCase()),
		) ??
		search.results[0];
	return best ? toResultItem(best) : null;
}

async function liveCatalogHint(text: string): Promise<ChatResultItem[]> {
	const lower = text.toLowerCase();
	try {
		if (/in (theaters|cinemas)|now playing|currently playing/.test(lower)) {
			const data = await fetchMediaList("movie", "now-playing", 1);
			return data.results.slice(0, 8).map(toResultItem);
		}
		if (/upcoming|coming soon/.test(lower)) {
			const data = await fetchMediaList("movie", "upcoming", 1);
			return data.results.slice(0, 8).map(toResultItem);
		}
		if (/trending/.test(lower)) {
			const data = await fetchMediaList("movie", "trending", 1);
			return data.results.slice(0, 8).map(toResultItem);
		}
	} catch (error) {
		console.error("[chat] live catalog hint failed", error);
	}
	return [];
}

export async function answerChat(messages: ChatMessage[]): Promise<ChatResponse> {
	const trimmed = messages.slice(-12);
	const lastUser = [...trimmed].reverse().find(message => message.role === "user");
	const previous = lastAssistantResults(trimmed.slice(0, -1));
	const llm = getChatLlm();

	if (llm && lastUser) {
		try {
			const live = await liveCatalogHint(lastUser.content);
			const draft =
				llm.kind === "openai"
					? await generateOpenAIResponse({
							apiKey: llm.apiKey,
							baseUrl: llm.baseUrl,
							model: llm.model,
							messages: trimmed,
							previous,
							live,
						})
					: await generateGeminiDraft({
							apiKey: llm.apiKey,
							model: llm.model,
							fallbackModel: llm.fallbackModel,
							messages: trimmed,
							previous,
							live,
						});
			const results = await resolveOfficialTitles(draft.titles, [
				...previous,
				...live,
			]);
			return {
				reply: draft.reply,
				results: results.length ? results : undefined,
				mode: "ai",
			};
		} catch (error) {
			console.error("[chat] AI movie expert failed, using local assistant", error);
		}
	}

	return localAgent(trimmed);
}

async function generateGeminiDraft({
	apiKey,
	model,
	fallbackModel,
	messages,
	previous,
	live,
}: {
	apiKey: string;
	model: string;
	fallbackModel: string;
	messages: ChatMessage[];
	previous: ChatResultItem[];
	live: ChatResultItem[];
}) {
	try {
		return await generateGeminiResponse({
			apiKey,
			model,
			fallbackModel,
			messages,
			previous,
			live,
		});
	} catch (error) {
		console.error(
			"[chat] Gemini Interactions API failed, trying OpenAI-compatible Gemini",
			error,
		);
		try {
			return await generateOpenAIResponse({
				apiKey,
				baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
				model,
				messages,
				previous,
				live,
			});
		} catch {
			return generateOpenAIResponse({
				apiKey,
				baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
				model: fallbackModel,
				messages,
				previous,
				live,
			});
		}
	}
}