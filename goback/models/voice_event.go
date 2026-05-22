package models

import (
	"time"
)

type VoiceEvent struct {
	ID             string     `json:"id" db:"id"`
	GroupID        string     `json:"group_id" db:"group_id"`
	ChannelID      string     `json:"channel_id" db:"channel_id"`
	GroupName      *string    `json:"group_name,omitempty" db:"-"`
	Title          string     `json:"title" db:"title"`
	Description    *string    `json:"description" db:"description"`
	ScheduledStart time.Time  `json:"scheduled_start" db:"scheduled_start"`
	ScheduledEnd   *time.Time `json:"scheduled_end" db:"scheduled_end"`
	StartedAt      *time.Time `json:"started_at" db:"started_at"`
	StartedBy      *string    `json:"started_by" db:"started_by"`
	CreatorID      string     `json:"creator_id" db:"creator_id"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	ShareLink      string     `json:"share_link,omitempty" db:"-"`
}

type CreateVoiceEventDto struct {
	Title          string     `json:"title" validate:"required"`
	Description    string     `json:"description"`
	ScheduledStart time.Time  `json:"scheduled_start" validate:"required"`
	ScheduledEnd   *time.Time `json:"scheduled_end"`
}

type CreateChannelEventDto struct {
	GroupID        string     `json:"group_id" validate:"required"`
	Title          string     `json:"title" validate:"required"`
	Description    string     `json:"description"`
	ScheduledStart time.Time  `json:"scheduled_start" validate:"required"`
	ScheduledEnd   *time.Time `json:"scheduled_end"`
}
