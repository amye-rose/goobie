CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER NOT NULL PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_url TEXT,
    date_added TEXT
);

-- https://www.goodreads.com/review/list_rss/{user_id}
CREATE TABLE IF NOT EXISTS reviews (
    review_id INTEGER NOT NULL PRIMARY KEY, -- https://www.goodreads.com/review/show/{review_id}
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    username TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    title TEXT,
    author TEXT,
    image_url TEXT,
    shelves TEXT,
    rating INTEGER,
    review TEXT,
    date_added TEXT
);

-- https://www.goodreads.com/user/updates_rss/{user_id}
CREATE TABLE IF NOT EXISTS updates (
    update_id TEXT NOT NULL UNIQUE PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    review_id INTEGER NOT NULL REFERENCES reviews(review_id),
    date_added TEXT,
    date_notified TEXT
);

CREATE INDEX IF NOT EXISTS idx_updates_pending ON updates(date_notified) WHERE date_notified IS NULL;