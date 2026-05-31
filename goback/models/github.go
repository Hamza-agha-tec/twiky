package models

import "time"

type GitHubConnection struct {
	UserID          string    `json:"user_id" db:"user_id"`
	GitHubID        string    `json:"github_id" db:"github_id"`
	GitHubUsername  string    `json:"github_username" db:"github_username"`
	GitHubName      string    `json:"github_name" db:"github_name"`
	GitHubAvatarURL string    `json:"github_avatar_url" db:"github_avatar_url"`
	AccessToken     string    `json:"access_token" db:"access_token"`
	ConnectedAt     time.Time `json:"connected_at" db:"connected_at"`
}
