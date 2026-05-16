package models

import (
	"time"
)

type Channel struct {
	ID               string    `json:"id" db:"id"`
	Name             string    `json:"name" db:"name"`
	Description      string    `json:"description" db:"description"`
	AvatarURL        string    `json:"avatar_url" db:"avatar_url"`
	OwnerID          string    `json:"owner_id" db:"owner_id"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	BannerURL        string    `json:"banner_url" db:"banner_url nullable"`
	AccessType       string    `json:"access_type" db:"access_type"`
	Type             string    `json:"type" db:"type"`
	InviteCode       string    `json:"invite_code" db:"invite_code"`
	Role             string    `json:"role,omitempty"`
	MembershipStatus string    `json:"membership_status,omitempty"`
	MemberCount      int       `json:"member_count"`
}

type ChannelMember struct {
	ChannelID string    `json:"channel_id" db:"channel_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"`
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
	Status    string    `json:"status" db:"status"`
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type JoinRequestUser struct {
	ID        string  `json:"id"`
	Username  *string `json:"username"`
	AvatarURL *string `json:"avatar_url"`
}

type ChannelJoinRequestWithUser struct {
	ID        string          `json:"id"`
	Status    string          `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
	User      JoinRequestUser `json:"user"`
}

type Group struct {
	ID          string    `json:"id" db:"id"`
	ChannelID   string    `json:"channel_id" db:"channel_id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description" db:"description"`
	IsGeneral   bool      `json:"is_general" db:"is_general"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	GroupType   string    `json:"group_type" db:"group_type"`
	AccessType  string    `json:"access_type" db:"access_type"`
	IsMember    bool      `json:"is_member"`
}

type GroupMember struct {
	GroupID  string    `json:"group_id" db:"group_id"`
	UserID   string    `json:"user_id" db:"user_id"`
	Role     string    `json:"role" db:"role"`
	JoinedAt time.Time `json:"joined_at" db:"joined_at"`
}

type GroupJoinRequest struct {
	ID        string    `json:"id"`
	GroupID   string    `json:"group_id"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	Username  *string   `json:"username,omitempty"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	User      *JoinRequestUser `json:"user,omitempty"`
}

type GroupMemberUser struct {
	ID         string  `json:"id"`
	Email      string  `json:"email"`
	Fullname   string  `json:"fullname"`
	Username   string  `json:"username"`
	AvatarURL  *string `json:"avatar_url"`
	Banner     *string `json:"banner"`
	Bio        *string `json:"bio"`
	IsVerified *bool   `json:"is_verified"`
	SubPlan    string  `json:"sub_plan"`
}

type GroupMemberResponse struct {
	Role     string          `json:"role"`
	JoinedAt time.Time       `json:"joined_at"`
	User     GroupMemberUser `json:"user"`
}
