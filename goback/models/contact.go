package models

import (
	"time"
)

type Contact struct {
	ID          string    `json:"id" db:"id"`
	UserID      string    `json:"user_id" db:"user_id"`
	ContactID   string    `json:"contact_id" db:"contact_id"`
	IsBlocked   bool      `json:"is_blocked" db:"is_blocked"`
	IsArchived  bool      `json:"is_archived" db:"is_archived"`
	IsFavorite  bool      `json:"is_favorite" db:"is_favorite"`
	IsPinned    bool      `json:"is_pinned" db:"is_pinned"`
	IsMuted     bool      `json:"is_muted" db:"is_muted"`
	Notes       string    `json:"notes" db:"notes"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type ContactWithUserInfo struct {
	Contact
	ContactUser User `json:"contact_user"`
}
