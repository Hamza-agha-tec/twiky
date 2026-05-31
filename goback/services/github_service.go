package services

// Required Supabase table:
//
// CREATE TABLE github_connections (
//   user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
//   github_id       TEXT NOT NULL,
//   github_username TEXT NOT NULL,
//   github_name     TEXT,
//   github_avatar_url TEXT,
//   access_token    TEXT NOT NULL,
//   connected_at    TIMESTAMPTZ DEFAULT NOW()
// );

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type GitHubService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewGitHubService(db *sql.DB, supabaseURL, supabaseKey string) *GitHubService {
	return &GitHubService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *GitHubService) GetAuthURL() string {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	redirectURI := os.Getenv("GITHUB_REDIRECT_URI")
	scopes := "read:user user:email public_repo"
	return fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=%s",
		clientID, url.QueryEscape(redirectURI), url.QueryEscape(scopes),
	)
}

func (s *GitHubService) HandleCallback(userID, code string) (*models.GitHubConnection, error) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	redirectURI := os.Getenv("GITHUB_REDIRECT_URI")

	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, _ := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		return nil, err
	}
	if tokenRes.Error != "" {
		return nil, fmt.Errorf("github oauth error: %s", tokenRes.Error)
	}
	if tokenRes.AccessToken == "" {
		return nil, fmt.Errorf("no access token returned")
	}

	ghUser, err := s.fetchGitHubUser(tokenRes.AccessToken)
	if err != nil {
		return nil, err
	}

	conn := &models.GitHubConnection{
		UserID:          userID,
		GitHubID:        fmt.Sprintf("%v", ghUser["id"]),
		GitHubUsername:  stringVal(ghUser, "login"),
		GitHubName:      stringVal(ghUser, "name"),
		GitHubAvatarURL: stringVal(ghUser, "avatar_url"),
		AccessToken:     tokenRes.AccessToken,
		ConnectedAt:     time.Now(),
	}

	upsertData := map[string]interface{}{
		"user_id":           conn.UserID,
		"github_id":         conn.GitHubID,
		"github_username":   conn.GitHubUsername,
		"github_name":       conn.GitHubName,
		"github_avatar_url": conn.GitHubAvatarURL,
		"access_token":      conn.AccessToken,
		"connected_at":      conn.ConnectedAt,
	}
	var rows []models.GitHubConnection
	if err := s.supabase.GetClient().DB.From("github_connections").Upsert(upsertData).Execute(&rows); err != nil {
		return nil, err
	}
	return conn, nil
}

func (s *GitHubService) Disconnect(userID string) error {
	var rows []models.GitHubConnection
	return s.supabase.GetClient().DB.From("github_connections").
		Delete().Eq("user_id", userID).Execute(&rows)
}

func (s *GitHubService) GetConnection(userID string) (*models.GitHubConnection, error) {
	var rows []models.GitHubConnection
	if err := s.supabase.GetClient().DB.From("github_connections").
		Select("*").Eq("user_id", userID).Execute(&rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// GetProfile returns the GitHub user profile for display on a Twiky profile.
func (s *GitHubService) GetProfile(userID string) (map[string]interface{}, error) {
	conn, err := s.GetConnection(userID)
	if err != nil {
		return nil, err
	}
	if conn == nil {
		return nil, fmt.Errorf("not connected")
	}

	ghUser, err := s.fetchGitHubUser(conn.AccessToken)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"login":        ghUser["login"],
		"name":         ghUser["name"],
		"avatar_url":   ghUser["avatar_url"],
		"html_url":     ghUser["html_url"],
		"bio":          ghUser["bio"],
		"public_repos": ghUser["public_repos"],
		"followers":    ghUser["followers"],
		"following":    ghUser["following"],
	}, nil
}

// GetActivity returns recent public events for the connected user.
func (s *GitHubService) GetActivity(userID string) ([]map[string]interface{}, error) {
	conn, err := s.GetConnection(userID)
	if err != nil {
		return nil, err
	}
	if conn == nil {
		return nil, fmt.Errorf("not connected")
	}

	eventsURL := fmt.Sprintf("https://api.github.com/users/%s/events?per_page=20", conn.GitHubUsername)
	req, _ := http.NewRequest("GET", eventsURL, nil)
	req.Header.Set("Authorization", "Bearer "+conn.AccessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var events []map[string]interface{}
	if err := json.Unmarshal(body, &events); err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for _, e := range events {
		eventType, _ := e["type"].(string)
		repoMap, _ := e["repo"].(map[string]interface{})
		repoName := stringVal(repoMap, "name")
		createdAt, _ := e["created_at"].(string)
		payload, _ := e["payload"].(map[string]interface{})

		item := map[string]interface{}{
			"type":       eventType,
			"repo":       repoName,
			"created_at": createdAt,
		}

		switch eventType {
		case "PushEvent":
			commits, _ := payload["commits"].([]interface{})
			if len(commits) > 0 {
				first := commits[0].(map[string]interface{})
				item["message"] = stringVal(first, "message")
			}
			item["commit_count"] = len(commits)
		case "PullRequestEvent":
			pr, _ := payload["pull_request"].(map[string]interface{})
			item["action"] = stringVal(payload, "action")
			item["message"] = stringVal(pr, "title")
		case "IssuesEvent":
			issue, _ := payload["issue"].(map[string]interface{})
			item["action"] = stringVal(payload, "action")
			item["message"] = stringVal(issue, "title")
		case "CreateEvent":
			item["ref_type"] = stringVal(payload, "ref_type")
			item["message"] = stringVal(payload, "ref")
		default:
			continue
		}

		result = append(result, item)
		if len(result) >= 10 {
			break
		}
	}
	return result, nil
}

// IsCodingNow returns true if the user pushed code within the last 4 hours.
func (s *GitHubService) IsCodingNow(userID string) (bool, error) {
	activity, err := s.GetActivity(userID)
	if err != nil {
		return false, nil
	}
	cutoff := time.Now().Add(-4 * time.Hour)
	for _, e := range activity {
		if e["type"] != "PushEvent" {
			continue
		}
		createdStr, _ := e["created_at"].(string)
		t, err := time.Parse(time.RFC3339, createdStr)
		if err == nil && t.After(cutoff) {
			return true, nil
		}
	}
	return false, nil
}

func (s *GitHubService) fetchGitHubUser(token string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	return user, nil
}

func stringVal(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	v, _ := m[key].(string)
	return v
}
