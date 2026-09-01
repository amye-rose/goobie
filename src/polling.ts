import {
    Client,
    ContainerBuilder,
    MessageFlags
} from "discord.js"
import type {
    Review,
    Update,
    ReviewItem
} from "./types.ts"
import { addUpdates, allUpdates, allUsers, getReview, loadReviews, setNotified } from "./db.ts"
import Parser from "rss-parser"
import { client } from "./discord.ts"
import { createContainer, reviewID } from "./utils.ts"

async function parseUpdates(user_id: number) {
    const parser = new Parser()

    const url = `https://www.goodreads.com/user/updates_rss/${user_id}`
    const feed = await parser.parseURL(url)
    const updates: Update[] = []

    feed.items.forEach(item => {
        if (!item.guid || !item.link) return

        const review_id = reviewID(item.link)
        if (!review_id) return // only add updates that have review IDs

        updates.push({
            update_id: item.guid,
            review_id: review_id,
            user_id: user_id,
            date_added: item.isoDate ?? new Date().toISOString(),
            date_notified: null
        })
    })

    return updates
}

async function parseReviews(user_id: number) {
    const parser = new Parser<object, ReviewItem>({
        customFields: {
            item: [
                "user_name",
                "book_id",
                "author_name",
                "book_large_image_url",
                "user_shelves",
                "user_rating",
                "user_review",
                "user_date_added",
            ]
        }
    })

    const url = `https://www.goodreads.com/review/list_rss/${user_id}`
    const feed = await parser.parseURL(url)
    const reviews: Review[] = []

    feed.items.forEach(item => {
        if (!item.guid || !item.link) return

        const review_id = reviewID(item.guid ?? item.link)
        if (!review_id) return

        reviews.push({
            review_id: review_id,
            user_id: user_id,
            username: item.user_name ?? null,
            book_id: Number(item.book_id),
            title: item.title ?? null,
            author: item.author_name ?? null,
            image_url: item.book_large_image_url ?? null,
            shelves: item.user_shelves ?? "read",
            rating: Number(item.user_rating ?? 0),
            review: item.user_review ?? null,
            date_added: item.user_date_added ?? new Date().toISOString()
        })
    })

    return reviews
}

export async function pollUsers() {
    const users = allUsers()

    for (const user of users) {
        try {
            loadReviews(await pollReviews(user.user_id))
            addUpdates(await pollUpdates(user.user_id))
        } catch (error) {
            console.error(`Failed to poll user ${user.user_id}:`, error)
        }
    }

    for (const update of allUpdates(undefined, false)) {
        const newReview = getReview(update.review_id)
        if (!newReview) continue

        try {
            await notify(createContainer(newReview), client)
            setNotified(update.update_id) // only on success, so a failure retries next tick
        } catch (error) {
            console.error(`Failed to notify for update ${update.update_id}:`, error)
        }
    }
}

export async function pollUpdates(user_id: number): Promise<Update[]> {
    const updates = parseUpdates(user_id)
    return updates
}

export async function pollReviews(user_id: number): Promise<Review[]> {
    const reviews = parseReviews(user_id)
    return reviews
}

export async function notify(container: ContainerBuilder, client: Client) {
    const channelID = process.env.CHANNEL_ID
    if (!channelID) throw new Error("CHANNEL_ID is not set")

    const channel = await client.channels.fetch(channelID)
    if (!channel?.isSendable()) throw new Error(`Channel ${channelID} is missing or not sendable`)

    await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
    })
}
