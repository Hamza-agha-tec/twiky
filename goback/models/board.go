package models

import "time"

// ─── Tags ────────────────────────────────────────────────────────────────────

type BoardTag struct {
	ID        string    `json:"id"`
	GroupID   string    `json:"group_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateBoardTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// ─── Posts ───────────────────────────────────────────────────────────────────

type BoardAuthor struct {
	ID         string  `json:"id"`
	Username   string  `json:"username"`
	AvatarURL  *string `json:"avatar_url"`
	IsVerified *bool   `json:"is_verified"`
	SubPlan    *string `json:"sub_plan"`
}

type BoardPost struct {
	ID             string      `json:"id"`
	GroupID        string      `json:"group_id"`
	AuthorID       string      `json:"author_id"`
	Title          string      `json:"title"`
	Content        *string     `json:"content"`
	MediaURLs      []string    `json:"media_urls"`
	IsPinned       bool        `json:"is_pinned"`
	IsLocked       bool        `json:"is_locked"`
	LastActivityAt time.Time   `json:"last_activity_at"`
	CreatedAt      time.Time   `json:"created_at"`
	Author         BoardAuthor `json:"author"`
	Tags           []BoardTag  `json:"tags"`
	LikeCount      int         `json:"like_count"`
	CommentCount   int         `json:"comment_count"`
	IsLiked        bool        `json:"is_liked"`
}

type CreateBoardPostRequest struct {
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	MediaURLs []string `json:"media_urls"`
	TagIDs    []string `json:"tag_ids"`
}

type UpdateBoardPostRequest struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	IsPinned *bool  `json:"is_pinned"`
	IsLocked *bool  `json:"is_locked"`
}

// ─── Comments ────────────────────────────────────────────────────────────────

type BoardComment struct {
	ID              string        `json:"id"`
	PostID          string        `json:"post_id"`
	AuthorID        string        `json:"author_id"`
	Content         string        `json:"content"`
	MediaURLs       []string      `json:"media_urls"`
	ParentCommentID *string       `json:"parent_comment_id"`
	CreatedAt       time.Time     `json:"created_at"`
	Author          BoardAuthor   `json:"author"`
	Replies         []BoardComment `json:"replies"`
}

type CreateBoardCommentRequest struct {
	Content         string  `json:"content"`
	MediaURLs       []string `json:"media_urls"`
	ParentCommentID *string `json:"parent_comment_id"`
}

type UpdateBoardCommentRequest struct {
	Content string `json:"content"`
}
