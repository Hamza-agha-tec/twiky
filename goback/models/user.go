package models

import (
	"time"
)

type UserSettings struct {
	ID                      string    `json:"id"`
	UserID                  string    `json:"user_id"`
	Theme                   string    `json:"theme"`
	NotificationsEnabled    bool      `json:"notifications_enabled"`
	CreatedAt               time.Time `json:"created_at"`
	Language                string    `json:"language"`
	AccentColor             string    `json:"accent_color"`
	DoNotDisturb            bool      `json:"do_not_disturb"`
	WhoCanSeeMeOnline       string    `json:"who_can_see_me_online"`
	WhoCanSeeMyLastSeen     string    `json:"who_can_see_my_last_seen"`
	ReadConfirmation        bool      `json:"read_confirmation"`
	Email                   string    `json:"email"`
	DodoCustomerID          string    `json:"dodo_customer_id"`
	WhoCanSeeMyProfilePhoto string    `json:"who_can_see_my_profile_photo"`
	WhoCanDiscoverMe        string    `json:"who_can_discover_me"`
}

type UserProfile struct {
	User        User         `json:"user"`
	Settings    UserSettings `json:"settings,omitempty"`
	Followers   int          `json:"followers_count"`
	Following   int          `json:"following_count"`
	IsFollowing bool         `json:"is_following,omitempty"`
}

type Follow struct {
	ID          string    `json:"id" db:"id"`
	FollowerID  string    `json:"follower_id" db:"follower_id"`
	FollowingID string    `json:"following_id" db:"following_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}
