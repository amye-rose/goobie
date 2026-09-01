import Database from "better-sqlite3";
import fs from "node:fs"
import path from "node:path"
import type {
    User,
    Review,
    Update
} from "./types.ts"

// resolve against the repo, not the cwd, so the service does not silently
// create a second database if WorkingDirectory is wrong
const dbDir = path.join(import.meta.dirname, "..", "db")

const db = new Database(process.env.DB_PATH ?? path.join(dbDir, "goobie.db"))
db.exec(fs.readFileSync(path.join(dbDir, "schema.sql"), "utf-8")) // initalize database

export function closeDatabase() {
    db.close()
}

// user functions
export function addUser(user: User) {
    return db.prepare<User>(`
    INSERT INTO users (
        user_id,
        username,
        avatar_url,
        date_added
    )
    VALUES (
        @user_id,
        @username,
        @avatar_url,
        @date_added
    )
    ON CONFLICT (user_id) DO UPDATE SET
        username = excluded.username,
        avatar_url = excluded.avatar_url
    `).run(user)
}

const deleteUserRows = db.transaction((user_id: number) => {
    db.prepare("DELETE FROM updates WHERE user_id = ?").run(user_id)
    db.prepare("DELETE FROM reviews WHERE user_id = ?").run(user_id)
    return db.prepare("DELETE FROM users WHERE user_id = ?").run(user_id)
})

export function removeUser(user_id?: number, username?: string) {
    const id = username ? getUser(undefined, username)?.user_id : user_id
    if (id === undefined) return

    return deleteUserRows(id)
}

export function getUser(user_id?: number, username?: string): User | undefined {
    if (username) {
        return db.prepare<[string], User>("SELECT * FROM users WHERE username = ?").get(username)
    }

    if (user_id === undefined) return undefined

    return db.prepare<[number], User>("SELECT * FROM users WHERE user_id = ?").get(user_id)
}

export function allUsers(): User[] {
    return db.prepare<[], User>("SELECT * FROM users").all()
}

// update functions
export function addUpdate(update: Update) {
    return db.prepare<Update>(`
    INSERT INTO updates (
        update_id,
        user_id,
        review_id,
        date_added,
        date_notified
    )
    VALUES (
        @update_id,
        @user_id,
        @review_id,
        @date_added,
        @date_notified
    )
    ON CONFLICT (update_id) DO NOTHING
    `).run(update)
}

export function removeUpdate(update_id: string) {
    return db.prepare("DELETE FROM updates WHERE update_id = ?").run(update_id)
}

export function getUpdate(update_id: string): Update | unknown {
    return db.prepare("SELECT * FROM updates WHERE update_id = ?").get(update_id)
}

export function allUpdates(user_id?: number, notified?: boolean): Update[] {
    if (user_id && !notified) {
        return db.prepare<[number], Update>(`
        SELECT * FROM updates
        WHERE user_id = ?
        AND date_notified IS NULL
        `).all(user_id)
    }

    if (user_id && notified) {
        return db.prepare<[number], Update>(`
        SELECT * FROM updates
        WHERE user_id = ?
        `).all(user_id)
    }

    if (!user_id && !notified) {
        return db.prepare<[], Update>(`
        SELECT * FROM updates
        WHERE date_notified IS NULL
        `).all()
    }

    return db.prepare<[], Update>("SELECT * FROM updates").all()
}

export function setNotified(update_id: string) {
    db.prepare<[string, string]>(`
    UPDATE updates SET date_notified = ?
    WHERE update_id = ?
    `).run(
        new Date().toISOString(),
        update_id
    )
}

function storeUpdates(updates: Update[], markNotified: boolean) {
    for (const update of updates) {
        // updates.review_id is a FK into reviews, so skip any update whose
        // review isn't stored yet (load reviews first)
        if (!getReview(update.review_id)) continue
        addUpdate(update)
        if (markNotified) setNotified(update.update_id)
    }
}

/** Poll path: new updates stay pending so the notify cycle announces them. */
export function addUpdates(updates: Update[]) {
    storeUpdates(updates, false)
}

/**
 * /add path: seed a newly added user's backlog already marked as notified, so
 * adding them doesn't spam the channel with their whole history.
 */
export function loadUpdates(updates: Update[]) {
    storeUpdates(updates, true)
}

export function latestUpdate(user_id?: number, username?: string): Update | undefined {
    if (username) {
        return db.prepare<[string], Update>(`
        SELECT updates.* FROM updates
        JOIN users ON users.user_id = updates.user_id
        WHERE users.username = ?
        ORDER BY updates.date_added DESC
        LIMIT 1
        `).get(username)
    }

    if (user_id) {
        return db.prepare<[number], Update>(`
        SELECT * FROM updates
        WHERE user_id = ?
        ORDER BY date_added DESC
        LIMIT 1
        `).get(user_id)
    }

    return db.prepare<[], Update>(`
    SELECT * FROM updates
    ORDER BY date_added DESC
    LIMIT 1
    `).get()
}

// review functions
export function addReview(review: Review) {
    return db.prepare<Review>(`
    INSERT INTO reviews (
        review_id,
        user_id,
        username,
        book_id,
        title,
        author,
        image_url,
        shelves,
        rating,
        review,
        date_added
    )
    VALUES (
        @review_id,
        @user_id,
        @username,
        @book_id,
        @title,
        @author,
        @image_url,
        @shelves,
        @rating,
        @review,
        @date_added
    )
    ON CONFLICT (review_id) DO UPDATE SET
        title = excluded.title,
        author = excluded.author,
        image_url = excluded.image_url,
        shelves = excluded.shelves,
        rating = excluded.rating,
        review = excluded.review,
        date_added = excluded.date_added
    `).run(review)
}

export function removeReview(review_id: number) {
    db.prepare("DELETE FROM updates WHERE review_id = ?").run(review_id)
    return db.prepare("DELETE FROM reviews WHERE review_id = ?").run(review_id)
}

export function getReview(review_id: number): Review | undefined {
    return db.prepare<[number], Review>("SELECT * FROM reviews WHERE review_id = ?").get(review_id)
}

export function allReviews(user_id?: number): Review[] {
    if (user_id) {
        return db.prepare<[number], Review>(`
        SELECT * FROM reviews
        WHERE user_id = ?
        `).all(user_id)
    }

    return db.prepare<[], Review>("SELECT * FROM reviews").all()
}

export function loadReviews(reviews: Review[]) {
    for (const review of reviews) { 
        addReview(review) 
    }
}
