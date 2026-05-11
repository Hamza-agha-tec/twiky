package models

import (
	"time"
)

type Invitation struct {
	ID         string    `json:"id" db:"id"`
	InviterID  string    `json:"inviter_id" db:"inviter_id"`
	InviteeID  string    `json:"invitee_id" db:"invitee_id"`
	EntityType string    `json:"entity_type" db:"entity_type"` // CHANNEL, GROUP, FOLLOW, CHANNEL_JOIN_REQUEST
	EntityID   string    `json:"entity_id" db:"entity_id"`
	Status     string    `json:"status" db:"status"` // PENDING, ACCEPTED, REJECTED
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type SpotifyToken struct {
	ID           string    `json:"id" db:"id"`
	UserID       string    `json:"user_id" db:"user_id"`
	AccessToken  string    `json:"access_token" db:"access_token"`
	RefreshToken string    `json:"refresh_token" db:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
