package models

import (
	"time"
)

type Conversation struct {
	ID          string    `json:"id" db:"id"`
	IsGroup     bool      `json:"is_group" db:"is_group"`
	Name        string    `json:"name,omitempty" db:"name"`
	Description string    `json:"description,omitempty" db:"description"`
	AvatarURL   string    `json:"avatar_url,omitempty" db:"avatar_url"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type ConversationMember struct {
	ID             string    `json:"id" db:"id"`
	ConversationID string    `json:"conversation_id" db:"conversation_id"`
	UserID         string    `json:"user_id" db:"user_id"`
	JoinedAt       time.Time `json:"joined_at" db:"joined_at"`
}

type Message struct {
	ID             string                 `json:"id" db:"id"`
	ConversationID string                 `json:"conversation_id,omitempty" db:"conversation_id"`
	GroupID        string                 `json:"group_id,omitempty" db:"group_id"` // For group channel messages
	SenderID       string                 `json:"sender_id" db:"sender_id"`
	Content        string                 `json:"content,omitempty" db:"content"`
	Type           string                 `json:"type" db:"type"` // text, image, file, voice
	FileURL        string                 `json:"file_url,omitempty" db:"file_url"`
	Mime           string                 `json:"mime,omitempty" db:"mime"`
	Duration       int                    `json:"duration,omitempty" db:"duration"`
	Size           int                    `json:"size,omitempty" db:"size"`
	FileURLs       []string               `json:"file_urls,omitempty" db:"file_urls"`
	ReplyToID      string                 `json:"reply_to_id,omitempty" db:"reply_to_id"`
	EntityMentions []map[string]interface{} `json:"entity_mentions,omitempty" db:"entity_mentions"`
	IsForwarded    bool                   `json:"is_forwarded" db:"is_forwarded"`
	CreatedAt      time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at" db:"updated_at"`
}

type EntityMention struct {
	Type     string `json:"type"`
	EntityID string `json:"entityId"`
}
