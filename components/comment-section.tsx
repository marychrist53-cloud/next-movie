import { Trash2 } from "lucide-react";

import { deleteCommentFormAction } from "@/app/actions/library";
import {
	CommentForm,
	LikeButton,
} from "@/components/comment-form";
import ReplyToggleClient from "@/components/reply-toggle";
import { getCurrentUser } from "@/lib/auth";
import {
	getCommentLikes,
	getComments,
	getReplies,
} from "@/lib/db";
import { formatDateShort } from "@/lib/format";
import type { MediaType } from "@/types/global";

export default async function CommentSection({
	mediaType,
	mediaId,
}: {
	mediaType: MediaType;
	mediaId: number;
}) {
	const [comments, user] = await Promise.all([
		getComments(mediaType, mediaId),
		getCurrentUser(),
	]);

	const likeData = getCommentLikes(
		comments.map(c => c.id),
		user?.id ?? null,
	);
	const replies = getReplies(comments.map(c => c.id));
	const total =
		comments.length +
		[...replies.values()].reduce((sum, list) => sum + list.length, 0);

	return (
		<section>
			<h2 className="text-xl font-bold tracking-tight">
				Comments
				<span className="ml-2 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
					{total}
				</span>
			</h2>

			<CommentForm mediaType={mediaType} mediaId={mediaId} />

			{comments.length === 0 ? (
				<p className="mt-4 text-sm text-muted-foreground">
					No comments yet — be the first!
				</p>
			) : (
				<div className="mt-6 space-y-4">
					{comments.map(comment => (
						<article
							key={comment.id}
							className="rounded-2xl border border-border/60 p-4">
							<div className="flex items-center gap-3">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
									{comment.author.charAt(0).toUpperCase()}
								</span>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">
										{comment.author}
									</p>
									<p className="text-xs text-muted-foreground">
										{formatDateShort(comment.created_at)}
									</p>
								</div>
								{user?.id === comment.user_id && (
									<form action={deleteCommentFormAction} className="ml-auto">
										<input type="hidden" name="commentId" value={comment.id} />
										<input type="hidden" name="mediaType" value={mediaType} />
										<input type="hidden" name="mediaId" value={mediaId} />
										<button
											type="submit"
											aria-label="Delete comment"
											className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
											<Trash2 className="size-4" />
										</button>
									</form>
								)}
							</div>
							<p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
								{comment.body}
							</p>

							<div className="mt-3 flex items-center gap-4">
								<LikeButton
									commentId={comment.id}
									count={likeData.counts[comment.id] ?? 0}
									liked={likeData.likedByMe.has(comment.id)}
								/>
								<ReplyToggleClient
									mediaType={mediaType}
									mediaId={mediaId}
									parentId={comment.id}
									replyCount={replies.get(comment.id)?.length ?? 0}
								/>
							</div>

							{(replies.get(comment.id)?.length ?? 0) > 0 && (
								<div className="mt-4 space-y-3 border-l-2 border-border/60 pl-4">
									{(replies.get(comment.id) ?? []).map(reply => (
										<div key={reply.id} className="flex items-start gap-2.5">
											<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
												{reply.author.charAt(0).toUpperCase()}
											</span>
											<div className="min-w-0 flex-1">
												<p className="text-xs">
													<span className="font-semibold">{reply.author}</span>
													<span className="ml-2 text-muted-foreground">
														{formatDateShort(reply.created_at)}
													</span>
												</p>
												<p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
													{reply.body}
												</p>
											</div>
										</div>
									))}
								</div>
							)}
						</article>
					))}
				</div>
			)}
		</section>
	);
}
