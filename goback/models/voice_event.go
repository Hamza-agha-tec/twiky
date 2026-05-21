package models

import (
	"time"
)

type VoiceEvent struct {
	ID             string     `json:"id" db:"id"`
	GroupID        string     `json:"group_id" db:"group_id"`
	Title          string     `json:"title" db:"title"`
	Description    *string    `json:"description" db:"description"`
	ScheduledStart time.Time  `json:"scheduled_start" db:"scheduled_start"`
	ScheduledEnd   *time.Time `json:"scheduled_end" db:"scheduled_end"`
	CreatorID      string     `json:"creator_id" db:"creator_id"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type CreateVoiceEventDto struct {
	Title          string     `json:"title" validate:"required"`
	Description    string     `json:"description"`
	ScheduledStart time.Time  `json:"scheduled_start" validate:"required"`
	ScheduledEnd   *time.Time `json:"scheduled_end"`
}
