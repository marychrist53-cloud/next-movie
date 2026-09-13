"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, SendHorizonal, Loader2, RotateCcw } from "lucide-react";

import { useInert } from "@/components/use-inert";
import { imageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

type ResultItem = {
	id: number;
	media_type: string;
	title: string;
	poster_path: string | null;
	release_date: string | null;
	vote_average: number;
	overview?: string;
};

type Message = {
	role: "user" | "assistant";
	content: string;
	results?: ResultItem[];
	failed?: boolean;
};

const STORAGE_KEY = "nextmovie-chat-v1";
const WELCOME =
	"Hi — I'm your movie chatbot. Ask me about any film or show: plots, cast, what to watch next, or a vibe you're in.";

const SUGGESTIONS = [
	"Who directed Inception?",
	"Something like Heat but more modern",
	"A thief who enters people's dreams",
	"What's worth watching this week?",
];

function year(date: string | null | undefined): string {
	const y = (date ?? "").slice(0, 4);
	return /^\d{4}$/.test(y) ? y : "TBA";
}

function payloadMessages(messages: Message[]) {
	return messages
		.filter(message => !message.failed)
		.slice(-12)
		.map(message => ({
			role: message.role,
			content: message.content,
			results: message.results,
		}));
}

export default function AiChat() {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([
		{ role: "assistant", content: WELCOME },
	]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const [hydrated, setHydrated] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const messagesRef = useRef(messages);
	messagesRef.current = messages;
	useInert(open);

	useEffect(() => {
		try {
			const saved = sessionStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as Message[];
				if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
			}
		} catch {
			sessionStorage.removeItem(STORAGE_KEY);
		}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
	}, [hydrated, messages]);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, [messages, pending, open]);

	useEffect(() => {
		if (!open) return;

		const trigger = triggerRef.current;
		inputRef.current?.focus();
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
				return;
			}
			if (event.key !== "Tab" || !dialogRef.current) return;

			const focusable = Array.from(
				dialogRef.current.querySelectorAll<HTMLElement>(
					'button:not([disabled]), a[href], textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				),
			);
			if (!focusable.length) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			requestAnimationFrame(() => trigger?.focus());
		};
	}, [open]);

	function resetConversation() {
		const next = [{ role: "assistant" as const, content: WELCOME }];
		setMessages(next);
		setInput("");
		sessionStorage.removeItem(STORAGE_KEY);
		inputRef.current?.focus();
	}

	async function requestReply(
		history: Message[],
		onToken: (text: string) => void,
	) {
		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: payloadMessages(history) }),
		});

		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(data.error ?? "I couldn't reply just now. Try again?");
		}

		const reader = res.body?.getReader();
		if (!reader) {
			throw new Error("I couldn't reply just now. Try again?");
		}

		const decoder = new TextDecoder();
		let buffer = "";
		let reply = "";
		let results: ResultItem[] | undefined;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split("\n\n");
			buffer = parts.pop() ?? "";
			for (const part of parts) {
				const line = part
					.split("\n")
					.find(entry => entry.startsWith("data: "));
				if (!line) continue;
				const event = JSON.parse(line.slice(6)) as {
					type?: string;
					text?: string;
					reply?: string;
					results?: ResultItem[];
				};
				if (event.type === "token" && typeof event.text === "string") {
					reply += event.text;
					onToken(event.text);
				}
				if (event.type === "done") {
					if (typeof event.reply === "string") reply = event.reply;
					results = event.results;
				}
			}
		}

		return { reply, results };
	}

	async function send(text: string, existingHistory?: Message[]) {
		const content = text.trim();
		if (!content || pending) return;

		const history = existingHistory ?? [
			...messagesRef.current.filter(message => !message.failed),
			{ role: "user" as const, content },
		];
		setMessages(history);
		setInput("");
		setPending(true);
		if (inputRef.current) inputRef.current.style.height = "40px";

		try {
			let started = false;
			const data = await requestReply(history, text => {
				if (!started) {
					started = true;
					setPending(false);
					setMessages(prev => [
						...prev.filter(message => !message.failed),
						{ role: "assistant", content: text },
					]);
					return;
				}
				setMessages(prev => {
					const next = [...prev];
					const last = next[next.length - 1];
					if (last?.role === "assistant") {
						next[next.length - 1] = {
							...last,
							content: last.content + text,
						};
					}
					return next;
				});
			});
			setMessages(prev => {
				const next = prev.filter(message => !message.failed);
				const last = next[next.length - 1];
				if (last?.role === "assistant") {
					next[next.length - 1] = {
						...last,
						content: data.reply || last.content,
						results: data.results,
					};
					return next;
				}
				return [
					...next,
					{
						role: "assistant",
						content: data.reply,
						results: data.results,
					},
				];
			});
		} catch (err) {
			setMessages(prev => [
				...prev.filter(message => !message.failed),
				{
					role: "assistant",
					content:
						err instanceof Error
							? err.message
							: "I couldn't reply just now. Try again?",
					failed: true,
				},
			]);
		} finally {
			setPending(false);
			inputRef.current?.focus();
		}
	}

	function retryLast() {
		const lastUser = [...messagesRef.current]
			.reverse()
			.find(message => message.role === "user");
		if (!lastUser) return;
		const history = messagesRef.current.filter(
			message => !message.failed && message !== lastUser,
		);
		void send(lastUser.content, [...history, lastUser]);
	}

	const started = messages.some(message => message.role === "user");

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen(true)}
				aria-label="Open AI assistant"
				aria-expanded={open}
				aria-controls="ai-assistant-dialog"
				className={cn(
					"fixed bottom-5 right-5 z-[90] flex size-13 items-center justify-center rounded-full shadow-xl shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					open
						? "pointer-events-none opacity-0"
						: "bg-primary text-primary-foreground",
				)}>
				<Sparkles className="size-5" />
			</button>

			{open && (
				<div
					ref={dialogRef}
					id="ai-assistant-dialog"
					role="dialog"
					aria-modal="true"
					aria-labelledby="ai-assistant-title"
					className="fixed bottom-22 right-4 z-[90] flex h-[min(560px,72vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/50 sm:right-6">
					<div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
						<span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
							<Sparkles className="size-4" />
						</span>
						<div>
							<p id="ai-assistant-title" className="text-sm font-bold">
								Movie Assistant
							</p>
							<p className="text-[11px] text-muted-foreground">
								AI movie expert
							</p>
						</div>
						{started && (
							<button
								type="button"
								onClick={resetConversation}
								aria-label="Start a new chat"
								className="ml-auto flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<RotateCcw className="size-4" />
							</button>
						)}
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close AI assistant"
							className={cn(
								"flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								started ? "" : "ml-auto",
							)}>
							<X className="size-4" />
						</button>
					</div>

					<div
						ref={scrollRef}
						aria-live="polite"
						aria-relevant="additions text"
						className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
						{messages.map((message, index) => (
							<div key={`${message.role}-${index}`}>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
										message.role === "user"
											? "ml-auto bg-primary text-primary-foreground"
											: message.failed
												? "border border-destructive/40 bg-destructive/10 text-destructive"
												: "bg-muted text-foreground",
									)}>
									{message.content}
								</div>

								{message.failed && (
									<button
										type="button"
										onClick={retryLast}
										className="mt-1.5 text-xs font-medium text-primary hover:underline">
										Try again
									</button>
								)}

								{message.results && message.results.length > 0 && (
									<div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
										{message.results.map(item => (
											<Link
												key={`${item.media_type}-${item.id}`}
												href={
													item.media_type === "tv"
														? `/tv/${item.id}`
														: `/detail/${item.id}`
												}
												onClick={() => setOpen(false)}
												className="group w-24 shrink-0 focus-visible:outline-none">
												<div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-white/10 transition-transform group-hover:scale-105">
													{item.poster_path && (
														<Image
															src={imageUrl(item.poster_path, "w185")!}
															alt={item.title}
															fill
															sizes="96px"
															className="object-cover"
														/>
													)}
												</div>
												<p className="mt-1 truncate text-[11px] font-medium">
													{item.title}
												</p>
												<p className="text-[10px] text-muted-foreground">
													{year(item.release_date)}
													{item.vote_average > 0 &&
														` · ★ ${item.vote_average.toFixed(1)}`}
												</p>
											</Link>
										))}
									</div>
								)}
							</div>
						))}

						{pending && (
							<div className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
								<span className="inline-flex items-center gap-2">
									<Loader2 className="size-4 animate-spin" />
									Thinking
								</span>
							</div>
						)}

						{!started && !pending && (
							<div className="flex flex-wrap gap-1.5 pt-1">
								{SUGGESTIONS.map(suggestion => (
									<button
										key={suggestion}
										type="button"
										onClick={() => void send(suggestion)}
										className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
										{suggestion}
									</button>
								))}
							</div>
						)}
					</div>

					<form
						onSubmit={e => {
							e.preventDefault();
							void send(input);
						}}
						className="flex items-end gap-2 border-t border-border/60 p-3">
						<textarea
							ref={inputRef}
							value={input}
							rows={1}
							onChange={e => {
								setInput(e.target.value);
								e.target.style.height = "40px";
								e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
							}}
							onKeyDown={e => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									void send(input);
								}
							}}
							placeholder={
								started ? "Ask a follow-up..." : "Ask about movies..."
							}
							aria-label="Message the movie assistant"
							maxLength={1000}
							className="max-h-30 min-h-10 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-input/50 px-4 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
						/>
						<button
							type="submit"
							disabled={pending || !input.trim()}
							aria-label="Send message"
							className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/80 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
							<SendHorizonal className="size-4" />
						</button>
					</form>
				</div>
			)}
		</>
	);
}
