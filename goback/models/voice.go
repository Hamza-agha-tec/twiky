package models

import (
	"time"
)

type VoiceRoom struct {
	ID          string    `json:"id" db:"id"`
	ChannelID   string    `json:"channel_id" db:"channel_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	AccessType  string    `json:"access_type" db:"access_type"` // PUBLIC, PRIVATE
	OwnerID     string    `json:"owner_id" db:"owner_id"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type VoiceRoomMember struct {
	ID           string    `json:"id" db:"id"`
	RoomID       string    `json:"room_id" db:"room_id"`
	UserID       string    `json:"user_id" db:"user_id"`
	IsMuted      bool      `json:"is_muted" db:"is_muted"`
	IsDeafened   bool      `json:"is_deafened" db:"is_deafened"`
	IsSpeaking   bool      `json:"is_speaking" db:"is_speaking"`
	JoinedAt     time.Time `json:"joined_at" db:"joined_at"`
}
