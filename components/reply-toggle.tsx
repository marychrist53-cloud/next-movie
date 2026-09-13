"use client";

import { useState } from "react";

import { CommentForm, ReplyToggle } from "@/components/comment-form";
import type { MediaType } from "@/types/global";

export default function ReplyToggleClient({
	mediaType,
	mediaId,
	parentId,
	replyCount,
}: {
	mediaType: MediaType;
	mediaId: number;
	parentId: number;
	replyCount: number;
}) {
	const [open, setOpen] = useState(false);

	return (
		<div className="w-full">
			<ReplyToggle
				open={open}
				onToggle={() => setOpen(prev => !prev)}
				count={replyCount}
			/>
			{open && (
				<CommentForm
					mediaType={mediaType}
					mediaId={mediaId}
					parentId={parentId}
					compact
				/>
			)}
		</div>
	);
}
