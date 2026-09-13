"use client";

import { useActionState, useState } from "react";
import { CornerDownRight, Heart, MessageSquare } from "lucide-react";

import {
	addCommentAction,
	toggleCommentLikeAction,
	type ActionState,
} from "@/app/actions/library";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/components/library-provider";
import type { MediaType } from "@/types/global";
import { cn } from "@/lib/utils";

export function CommentForm({
	mediaType,
	mediaId,
	parentId = null,
	compact = false,
	onDone,
}: {
	mediaType: MediaType;
	mediaId: number;
	parentId?: number | null;
	compact?: boolean;
	onDone?: () => void;
}) {
	const { user } = useLibrary();
	const [state, formAction, pending] = useActionState<ActionState, FormData>(
		async (_prev, formData) => {
			const body = String(formData.get("body") ?? "");
			const result = await addCommentAction(mediaType, mediaId, body, parentId);
			if (result.ok) onDone?.();
			return result;
		},
		{},
	);

	if (!user) {
		return (
			<p className="text-sm text-muted-foreground">
				<a href="/login" className="font-medium text-primary hover:underline">
					Log in
				</a>{" "}
				to join the discussion.
			</p>
		);
	}

	return (
		<form
			action={formAction}
			className={cn("space-y-2", compact ? "mt-2" : "mt-4")}>
			<textarea
				name="body"
				required
				minLength={2}
				maxLength={2000}
				rows={compact ? 2 : 3}
				placeholder={
					compact ? "Write a reply..." : "Share your thoughts..."
				}
				className="w-full resize-y rounded-xl border border-border bg-input/50 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
			/>
			{state.error && (
				<p className="text-sm text-destructive">{state.error}</p>
			)}
			<div className="flex justify-end">
				<Button type="submit" size="sm" disabled={pending}>
					<MessageSquare className="size-3.5" />
					{pending ? "Posting..." : parentId ? "Reply" : "Post comment"}
				</Button>
			</div>
		</form>
	);
}

export function LikeButton({
	commentId,
	count,
	liked,
}: {
	commentId: number;
	count: number;
	liked: boolean;
}) {
	const { user } = useLibrary();
	const [optimistic, setOptimistic] = useState({ count, liked });
	const [pending, setPending] = useState(false);

	if (!user) {
		return (
			<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
				<Heart className="size-3.5" />
				{optimistic.count}
			</span>
		);
	}

	return (
		<button
			type="button"
			aria-pressed={optimistic.liked}
			aria-label={optimistic.liked ? "Unlike comment" : "Like comment"}
			disabled={pending}
			onClick={async () => {
				const previous = optimistic;
				setPending(true);
				setOptimistic(prev => ({
					count: prev.liked ? prev.count - 1 : prev.count + 1,
					liked: !prev.liked,
				}));
				try {
					const result = await toggleCommentLikeAction(commentId);
					if (result.error) setOptimistic(previous);
				} catch (error) {
					console.error("[comments] like update failed", error);
					setOptimistic(previous);
				} finally {
					setPending(false);
				}
			}}
			className={cn(
				"inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-60",
				optimistic.liked
					? "text-rose-400"
					: "text-muted-foreground hover:text-foreground",
			)}>
			<Heart className={cn("size-3.5", optimistic.liked && "fill-current")} />
			{optimistic.count}
		</button>
	);
}

export function ReplyToggle({
	open,
	onToggle,
	count,
}: {
	open: boolean;
	onToggle: () => void;
	count: number;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
			<CornerDownRight className="size-3.5" />
			{open ? "Hide replies" : count > 0 ? `Replies (${count})` : "Reply"}
		</button>
	);
}
