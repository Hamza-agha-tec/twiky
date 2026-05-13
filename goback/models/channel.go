package models

import (
	"time"
)

type Channel struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	AvatarURL   string    `json:"avatar_url" db:"avatar_url"`
	OwnerID     string    `json:"owner_id" db:"owner_id"`
	AccessType  string    `json:"access_type" db:"access_type"` // PUBLIC, PRIVATE
	IsArchived  bool      `json:"is_archived" db:"is_archived"`
	MemberCount int       `json:"member_count" db:"member_count"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type ChannelMember struct {
	ID        string    `json:"id" db:"id"`
	ChannelID string    `json:"channel_id" db:"channel_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"` // ADMIN, MODERATOR, MEMBER
	JoinedAt  time.Time `json:"joined_at" db:"joined_at"`
}

type ChannelMemberUser struct {
	ID         string  `json:"id"`
	Bio        *string `json:"bio"`
	Banner     *string `json:"banner"`
	SubPlan    string  `json:"sub_plan"`
	Username   *string `json:"username"`
	AvatarURL  *string `json:"avatar_url"`
	IsVerified *bool   `json:"is_verified"`
}

type ChannelMemberResponse struct {
	Role     string            `json:"role"`
	JoinedAt time.Time         `json:"joined_at"`
	User     ChannelMemberUser `json:"user"`
}

type ChannelJoinRequest struct {
	ID        string    `json:"id" db:"id"`
	ChannelID string    `json:"channel_id" db:"channel_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Status    string    `json:"status" db:"status"` // PENDING, ACCEPTED, REJECTED
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Group struct {
	ID          string    `json:"id" db:"id"`
	ChannelID   string    `json:"channel_id" db:"channel_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	GroupType   string    `json:"group_type" db:"group_type"`   // TEXT, VOICE
	AccessType  string    `json:"access_type" db:"access_type"` // PUBLIC, PRIVATE
	OwnerID     string    `json:"owner_id" db:"owner_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type GroupMember struct {
	ID       string    `json:"id" db:"id"`
	GroupID  string    `json:"group_id" db:"group_id"`
	UserID   string    `json:"user_id" db:"user_id"`
	Role     string    `json:"role" db:"role"` // ADMIN, MODERATOR, MEMBER
	JoinedAt time.Time `json:"joined_at" db:"joined_at"`
}

type GroupJoinRequest struct {
	ID        string    `json:"id" db:"id"`
	GroupID   string    `json:"group_id" db:"group_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Status    string    `json:"status" db:"status"` // PENDING, ACCEPTED, REJECTED
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
