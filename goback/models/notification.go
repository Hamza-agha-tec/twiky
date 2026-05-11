package models

import (
	"time"
)

type Notification struct {
	ID         string                 `json:"id" db:"id"`
	RecipientID string                `json:"recipient_id" db:"recipient_id"`
	ActorID    string                 `json:"actor_id" db:"actor_id"`
	Type       string                 `json:"type" db:"type"` // "follow", "like", "comment", "mention", etc.
	EntityID   string                 `json:"entity_id" db:"entity_id"`
	EntityType string                 `json:"entity_type" db:"entity_type"` // "post", "comment", "user", etc.
	IsRead     bool                   `json:"is_read" db:"is_read"`
	Metadata   map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt  time.Time              `json:"created_at" db:"created_at"`
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
