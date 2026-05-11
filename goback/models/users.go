package models

import "time"

type UserFollow struct {
	ID        string  `json:"id" db:"id"`
	Username  *string `json:"username" db:"username"`
	AvatarURL *string `json:"avatar_url" db:"avatar_url"`
}

type FollowUser struct {
	ID        string  `json:"id"`
	Username  *string `json:"username"`
	AvatarURL *string `json:"avatar_url"`
	Bio       *string `json:"bio"`
	SubPlan   string  `json:"sub_plan"`
}

type FollowerResponse struct {
	FollowerID string      `json:"follower_id"`
	Users      *FollowUser `json:"users"`
}

type FollowingResponse struct {
	FollowingID string      `json:"following_id"`
	Users       *FollowUser `json:"users"`
}

type User struct {
	ID            string    `json:"id" db:"id"`
	Email         string    `json:"email" db:"email"`
	FullName      *string   `json:"full_name" db:"full_name"`
	Username      *string   `json:"username" db:"username"`
	AvatarURL     *string   `json:"avatar_url" db:"avatar_url"`
	Bio           *string   `json:"bio" db:"bio"`
	Status        *string   `json:"status" db:"status"`
	PhoneNumber   *string   `json:"phone_number" db:"phone_number"`
	LastSeenAt    *string   `json:"last_seen_at" db:"last_seen_at"`
	Banner        *string   `json:"banner" db:"banner"`
	Logo          *string   `json:"logo" db:"logo"`
	XURL          *string   `json:"x_url" db:"x_url"`
	WebsiteURL    *string   `json:"website_url" db:"website_url"`
	EnterSoundURL *string   `json:"enter_sound_url" db:"enter_sound_url"`
	IsVerified    *bool     `json:"is_verified" db:"is_verified"`
	IsOnline      bool      `json:"is_online" db:"is_online"`
	SubPlan       string    `json:"sub_plan" db:"sub_plan"`
	LastActiveAt  time.Time `json:"last_active_at" db:"last_active_at"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// UpdateUserInput holds only the fields a user is allowed to update
type UpdateUserInput struct {
	Username      *string `json:"username"`
	AvatarURL     *string `json:"avatar_url"`
	PhoneNumber   *string `json:"phone_number"`
	Bio           *string `json:"bio"`
	Status        *string `json:"status"`
	Banner        *string `json:"banner"`
	Logo          *string `json:"logo"`
	Fullname      *string `json:"fullname"`
	XURL          *string `json:"x_url"`
	WebsiteURL    *string `json:"website_url"`
	EnterSoundURL *string `json:"enter_sound_url"`
}
