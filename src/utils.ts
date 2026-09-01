import { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { Review } from "./types.ts";

export function userID(url: string): number | null {
    const userID = url.match(/\/user\/show\/(\d+)(?:-([^\/?#]+))?/)
    return userID ? Number(userID[1]) : null
}

export function reviewID(url: string): number | null {
    const review_id = url.match(/\/review\/show\/(\d+)/)
    return review_id ? Number(review_id[1]) : null;
}

export function createContainer(review: Review): ContainerBuilder {
    let message = `[${review.username}](https://www.goodreads.com/user/show/${review.user_id}) added to ${review.shelves}`

    if (review.rating != 0) {
        message = `[${review.username}](https://www.goodreads.com/user/show/${review.user_id}) rated ${"⭐".repeat(review.rating)}`
    }

    const added = new Date(review.date_added)
    const timestamp = Number.isNaN(added.getTime()) ? null : Math.floor(added.getTime() / 1000)

    const container = new ContainerBuilder()
    .setAccentColor(0x616f55)
    .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${message}\n` +
            `## [${review.title}](https://www.goodreads.com/book/show/${review.book_id})\n` +
            `by **${review.author}**`
        )
    )
    .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(review.image_url ?? "")
        )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            (timestamp ? `-# Date Added <t:${timestamp}:f>\n` : "") +
            `-# [View](https://www.goodreads.com/review/show/${review.review_id})`
        )
    );
    return container
}