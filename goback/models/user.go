package models

import (
	"time"
)

type UserSettings struct {
	ID                 string    `json:"id" db:"id"`
	UserID             string    `json:"user_id" db:"user_id"`
	Theme              string    `json:"theme" db:"theme"`
	Language           string    `json:"language" db:"language"`
	Notifications      bool      `json:"notifications" db:"notifications"`
	EmailNotifications bool      `json:"email_notifications" db:"email_notifications"`
	PushNotifications  bool      `json:"push_notifications" db:"push_notifications"`
	PrivacyLevel       string    `json:"privacy_level" db:"privacy_level"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

type UserProfile struct {
	User
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
