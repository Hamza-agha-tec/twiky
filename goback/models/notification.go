package models

import (
	"time"
)

type Notification struct {
	ID          string                 `json:"id" db:"id"`
	RecipientID string                 `json:"recipient_id" db:"recipient_id"`
	ActorID     string                 `json:"actor_id" db:"actor_id"`
	Type        string                 `json:"type" db:"type"`
	EntityID    string                 `json:"entity_id" db:"entity_id"`
	EntityType  string                 `json:"entity_type" db:"entity_type"`
	IsRead      bool                   `json:"is_read" db:"is_read"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	Actor       *NotificationActor     `json:"actor,omitempty"`
	Title       string                 `json:"title"`   // Computed field
	Message     string                 `json:"message"` // Computed field
}

type NotificationActor struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

type NotificationCreateDto struct {
	RecipientID string                 `json:"recipient_id" binding:"required"`
	ActorID    string                 `json:"actor_id" binding:"required"`
	Type       string                 `json:"type" binding:"required"`
	EntityID   string                 `json:"entity_id"`
	EntityType string                 `json:"entity_type"`
	Metadata   map[string]interface{} `json:"metadata"`
}

type NotificationUpdateDto struct {
	IsRead bool `json:"is_read"`
}
