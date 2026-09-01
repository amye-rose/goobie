export interface User {
    user_id: number
    username: string
    avatar_url: string
    date_added: string
}

export interface Review {
    review_id: number
    user_id: number
    username: string | null
    book_id: number
    title: string | null
    author: string | null
    image_url: string | null
    shelves: string
    rating: number
    review: string | null
    date_added: string
}

export interface Update {
    update_id: string
    user_id: number
    review_id: number
    date_added: string
    date_notified: string | null
}

// custom fields in https://www.goodreads.com/review/list_rss/{user_id}
export interface ReviewItem {
    user_name?: string
    book_id?: string
    author_name?: string
    book_large_image_url?: string
    user_shelves?: string
    user_rating?: string
    user_review?: string
    user_date_added?: string
}