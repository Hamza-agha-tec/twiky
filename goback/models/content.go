package models

import (
	"time"
)

type Post struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Caption   string    `json:"caption,omitempty" db:"caption"`
	MediaURLs []string  `json:"media_urls,omitempty" db:"media_urls"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Story struct {
	ID              string    `json:"id" db:"id"`
	UserID          string    `json:"user_id" db:"user_id"`
	MediaURL        string    `json:"media_url" db:"media_url"`
	Type            string    `json:"type" db:"type"` // image, video
	Caption         string    `json:"caption,omitempty" db:"caption"`
	MusicPreviewURL string    `json:"music_preview_url,omitempty" db:"music_preview_url"`
	MusicTitle      string    `json:"music_title,omitempty" db:"music_title"`
	MusicArtist     string    `json:"music_artist,omitempty" db:"music_artist"`
	MusicCoverURL   string    `json:"music_cover_url,omitempty" db:"music_cover_url"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	ExpiresAt       time.Time `json:"expires_at" db:"expires_at"`
}

type StoryView struct {
	ID        string    `json:"id" db:"id"`
	StoryID   string    `json:"story_id" db:"story_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type StoryReaction struct {
	ID        string    `json:"id" db:"id"`
	StoryID   string    `json:"story_id" db:"story_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Reaction  string    `json:"reaction" db:"reaction"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type ReactStoryRequest struct {
	Reaction string `json:"reaction"`
}

type StoryViewResult struct {
	StoryID    string `json:"story_id"`
	ViewsCount int    `json:"views_count"`
	OwnerID    string `json:"ownerId,omitempty"`
}

type StoryReactionResult struct {
	StoryID        string `json:"story_id"`
	ReactionsCount int    `json:"reactionsCount"`
	OwnerID        string `json:"ownerId,omitempty"`
}

type PostWithUser struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Caption   string    `json:"caption,omitempty" db:"caption"`
	MediaURLs []string  `json:"media_urls,omitempty" db:"media_urls"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Users     PostUser  `json:"users"`
}

type PostUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

type UserPost struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Caption   string    `json:"caption,omitempty" db:"caption"`
	MediaURLs []string  `json:"media_urls,omitempty" db:"media_urls"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateCommentRequest struct {
	Content string `json:"content"`
}

type PostComment struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	PostID    string    `json:"post_id" db:"post_id"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type PostLike struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	PostID    string    `json:"post_id" db:"post_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- MESSAGING MODELS ---

type DirectConversation struct {
	ID        string    `json:"id"`
	UserOneID string    `json:"user_one_id"`
	UserTwoID string    `json:"user_two_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DirectMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type GroupMessage struct {
	ID        string    `json:"id"`
	GroupID   string    `json:"group_id"`
	SenderID  string    `json:"sender_id"`
	Content   string    `json:"content"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type MessageReaction struct {
	ID        string    `json:"id"`
	MessageID string    `json:"message_id"`
	UserID    string    `json:"user_id"`
	Emoji     string    `json:"emoji"`
	CreatedAt time.Time `json:"created_at"`
}

type StartDirectConversationDto struct {
	UserID string `json:"userId"`
}

type SendDirectMessageDto struct {
	Content string `json:"content"`
}

type SendGroupMessageDto struct {
	Content string `json:"content"`
}

type ToggleReactionDto struct {
	Emoji string `json:"emoji"`
}
