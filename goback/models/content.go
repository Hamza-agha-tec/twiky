package models

import (
	"time"
)

type Post struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Caption   string    `json:"caption" db:"caption"`
	MediaURLs []string  `json:"media_urls" db:"media_urls"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type UserPost struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Caption   *string   `json:"caption,omitempty" db:"caption"`
	MediaURLs []string  `json:"media_urls,omitempty" db:"media_urls"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
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
	StoryID  string    `json:"story_id" db:"story_id"`
	UserID   string    `json:"user_id" db:"user_id"`
	ViewedAt time.Time `json:"viewed_at" db:"viewed_at"`
}

type StoryReaction struct {
	ID        string    `json:"id" db:"id"`
	StoryID   string    `json:"story_id" db:"story_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Reaction  string    `json:"reaction" db:"reaction"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type FeedGroup struct {
	User    StoryUser `json:"user"`
	Stories []Story   `json:"stories"`
}

type StoryUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url,omitempty"`
	SubPlan   string `json:"sub_plan,omitempty"`
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

type CreateCommentRequest struct {
	Content string `json:"content"`
}

type PostComment struct {
	ID              string    `json:"id" db:"id"`
	PostID          string    `json:"post_id" db:"post_id"`
	UserID          string    `json:"user_id" db:"user_id"`
	ParentCommentID *string   `json:"parent_comment_id" db:"parent_comment_id"`
	Content         string    `json:"content" db:"content"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type PostLike struct {
	PostID    string    `json:"post_id" db:"post_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- MESSAGING MODELS ---

type DirectConversation struct {
	ID        string    `json:"id"`
	UserOneID string    `json:"user_one_id"`
	UserTwoID string    `json:"user_two_id"`
	CreatedAt time.Time `json:"created_at"`

	UserOne UserPublic `json:"user_one"`
	UserTwo UserPublic `json:"user_two"`

	LastMessage []DirectMessage `json:"last_message"`
	UnreadCount int             `json:"unread_count"`
}

type UserPublic struct {
	ID         string     `json:"id"`
	Username   string     `json:"username"`
	AvatarURL  string     `json:"avatar_url"`
	Banner     string     `json:"banner"`
	SubPlan    string     `json:"sub_plan"`
	IsVerified bool       `json:"is_verified"`
	LastSeenAt *time.Time `json:"last_seen_at"`
}

type DirectMessage struct {
	ID             string                   `json:"id"`
	ConversationID string                   `json:"conversation_id"`
	SenderID       string                   `json:"sender_id"`
	Content        *string                  `json:"content"`
	FileURL        *string                  `json:"file_url"`
	ReplyToID      *string                  `json:"reply_to_id"`
	CreatedAt      time.Time                `json:"created_at"`
	Status         string                   `json:"status"`
	IsEdited       bool                     `json:"is_edited"`
	EntityMentions []map[string]interface{} `json:"entity_mentions"`
	Reactions      []map[string]interface{} `json:"reactions"`
	FileURLs       []string                 `json:"file_urls"`
	Type           *string                  `json:"type"`
	Mime           *string                  `json:"mime"`
	Duration       *int                     `json:"duration"`
	Size           *int                     `json:"size"`
	IsPinned       bool                     `json:"is_pinned"`
	IsForwarded    bool                     `json:"is_forwarded"`
}

type DirectMessageSender struct {
	ID         string  `json:"id"`
	Username   *string `json:"username"`
	Fullname   *string `json:"fullname"`
	FullName   *string `json:"full_name"`
	AvatarURL  *string `json:"avatar_url"`
	IsVerified *bool   `json:"is_verified"`
	SubPlan    string  `json:"sub_plan"`
}

type DirectMessageResponse struct {
	ID             string                   `json:"id"`
	ConversationID string                   `json:"conversation_id"`
	SenderID       string                   `json:"sender_id"`
	Content        *string                  `json:"content"`
	Type           *string                  `json:"type"`
	FileURL        *string                  `json:"file_url"`
	Mime           *string                  `json:"mime"`
	Duration       *int                     `json:"duration"`
	Size           *int                     `json:"size"`
	FileURLs       []string                 `json:"file_urls"`
	ReplyToID      *string                  `json:"reply_to_id"`
	IsForwarded    bool                     `json:"is_forwarded"`
	IsPinned       bool                     `json:"is_pinned"`
	Status         string                   `json:"status"`
	Reactions      []map[string]interface{} `json:"reactions"`
	CreatedAt      time.Time                `json:"created_at"`
	Sender         *DirectMessageSender     `json:"sender"`
}

type GroupMessage struct {
	ID             string                   `json:"id"`
	GroupID        string                   `json:"group_id"`
	SenderID       *string                  `json:"sender_id"`
	Content        string                   `json:"content"`
	FileURL        *string                  `json:"file_url"`
	ReplyToID      *string                  `json:"reply_to_id"`
	CreatedAt      time.Time                `json:"created_at"`
	Status         string                   `json:"status"`
	IsEdited       bool                     `json:"is_edited"`
	EntityMentions []map[string]interface{} `json:"entity_mentions"`
	Reactions      []map[string]interface{} `json:"reactions"`
	IsPinned       bool                     `json:"is_pinned"`
	FileURLs       []string                 `json:"file_urls"`
	Type           *string                  `json:"type"`
	Mime           *string                  `json:"mime"`
	Duration       *int                     `json:"duration"`
	Size           *int64                   `json:"size"`
}

type GroupMessageSender struct {
	ID         string  `json:"id"`
	Fullname   *string `json:"fullname"`
	SubPlan    string  `json:"sub_plan"`
	Username   *string `json:"username"`
	AvatarURL  *string `json:"avatar_url"`
	IsVerified *bool   `json:"is_verified"`
}

type GroupMessageResponse struct {
	ID             string                   `json:"id"`
	GroupID        string                   `json:"group_id"`
	SenderID       *string                  `json:"sender_id"`
	Content        string                   `json:"content"`
	FileURL        *string                  `json:"file_url"`
	ReplyToID      *string                  `json:"reply_to_id"`
	CreatedAt      time.Time                `json:"created_at"`
	Status         string                   `json:"status"`
	IsEdited       bool                     `json:"is_edited"`
	EntityMentions []map[string]interface{} `json:"entity_mentions"`
	Reactions      []map[string]interface{} `json:"reactions"`
	IsPinned       bool                     `json:"is_pinned"`
	FileURLs       []string                 `json:"file_urls"`
	Type           *string                  `json:"type"`
	Mime           *string                  `json:"mime"`
	Duration       *int                     `json:"duration"`
	Size           *int                     `json:"size"`
	Sender         *GroupMessageSender      `json:"sender"`
}

type MessageReaction struct {
	ID        string    `json:"id"`
	MessageID string    `json:"message_id"`
	UserID    string    `json:"user_id"`
	Emoji     string    `json:"emoji"`
	CreatedAt time.Time `json:"created_at"`
}

type SendDirectMessageDto struct {
	Content     string   `json:"content"`
	Type        string   `json:"type"`
	FileUrl     string   `json:"fileUrl"`
	ReplyToId   string   `json:"replyToId"`
	FileUrls    []string `json:"fileUrls"`
	Mime        string   `json:"mime"`
	Duration    int      `json:"duration"`
	Size        int      `json:"size"`
	IsForwarded bool     `json:"isForwarded"`
}

type SendGroupMessageDto struct {
	Content        string          `json:"content"`
	Type           string          `json:"type"`
	FileUrl        string          `json:"fileUrl"`
	ReplyToId      string          `json:"replyToId"`
	FileUrls       []string        `json:"fileUrls"`
	Mime           string          `json:"mime"`
	Duration       int             `json:"duration"`
	Size           int             `json:"size"`
	IsForwarded    bool            `json:"isForwarded"`
	EntityMentions []EntityMention `json:"entityMentions"`
}

type ToggleReactionDto struct {
	Emoji string `json:"emoji"`
}
