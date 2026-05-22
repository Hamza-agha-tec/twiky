package services

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

type SpotifyService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewSpotifyService(db *sql.DB, supabaseURL, supabaseKey string) *SpotifyService {
	return &SpotifyService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *SpotifyService) GetAuthURL(userID string) string {
	clientID := os.Getenv("SPOTIFY_CLIENT_ID")
	redirectURI := os.Getenv("SPOTIFY_REDIRECT_URI")

	scopes := "user-read-currently-playing user-read-playback-state user-top-read user-read-recently-played"

	authURL := fmt.Sprintf("https://accounts.spotify.com/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s",
		clientID, url.QueryEscape(redirectURI), url.QueryEscape(scopes))

	return authURL
}

func (s *SpotifyService) HandleCallback(userID, code string) error {
	clientID := os.Getenv("SPOTIFY_CLIENT_ID")
	clientSecret := os.Getenv("SPOTIFY_CLIENT_SECRET")
	redirectURI := os.Getenv("SPOTIFY_REDIRECT_URI")

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, _ := http.NewRequest("POST", "https://accounts.spotify.com/api/token", strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(clientID, clientSecret)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("spotify token error: %s", resp.Status)
	}

	var tokenRes struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		return err
	}

	expiresAt := time.Now().Add(time.Duration(tokenRes.ExpiresIn) * time.Second)

	tokenData := map[string]interface{}{
		"user_id":       userID,
		"access_token":  tokenRes.AccessToken,
		"refresh_token": tokenRes.RefreshToken,
		"expires_at":    expiresAt,
	}

	var tokens []models.SpotifyToken
	err = s.supabase.GetClient().DB.From("spotify_connections").
		Upsert(tokenData).
		Execute(&tokens)

	return err
}

func (s *SpotifyService) Disconnect(userID string) error {
	var tokens []models.SpotifyToken
	err := s.supabase.GetClient().DB.From("spotify_connections").
		Delete().
		Eq("user_id", userID).
		Execute(&tokens)

	return err
}

func (s *SpotifyService) GetValidToken(userID string) (string, error) {
	var tokens []models.SpotifyToken
	err := s.supabase.GetClient().DB.From("spotify_connections").
		Select("*").
		Eq("user_id", userID).
		Execute(&tokens)

	if err != nil {
		return "", fmt.Errorf("failed to get token: %w", err)
	}

	if len(tokens) == 0 {
		return "", fmt.Errorf("user not connected to spotify")
	}

	token := tokens[0]

	if time.Now().After(token.ExpiresAt.Add(-5 * time.Minute)) {
		// refresh token logic...
		return s.refreshToken(userID, token.RefreshToken)
	}

	return token.AccessToken, nil
}

func (s *SpotifyService) refreshToken(userID, refreshToken string) (string, error) {
	clientID := os.Getenv("SPOTIFY_CLIENT_ID")
	clientSecret := os.Getenv("SPOTIFY_CLIENT_SECRET")

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	req, _ := http.NewRequest("POST", "https://accounts.spotify.com/api/token", strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(clientID, clientSecret)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("spotify refresh error")
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	json.NewDecoder(resp.Body).Decode(&tokenRes)

	expiresAt := time.Now().Add(time.Duration(tokenRes.ExpiresIn) * time.Second)
	updateData := map[string]interface{}{
		"access_token": tokenRes.AccessToken,
		"expires_at":   expiresAt,
	}
	s.supabase.GetClient().DB.From("spotify_connections").
		Update(updateData).
		Eq("user_id", userID).
		Execute(&[]models.SpotifyToken{})

	return tokenRes.AccessToken, nil
}

func (s *SpotifyService) GetNowPlaying(targetUserID, requestUserID string) (map[string]interface{}, error) {
	token, err := s.GetValidToken(targetUserID)
	if err != nil {
		return nil, fmt.Errorf("user not connected to spotify")
	}

	req, _ := http.NewRequest("GET", "https://api.spotify.com/v1/me/player/currently-playing", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 204 {
		return map[string]interface{}{"is_playing": false}, nil
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	return result, nil
}

func (s *SpotifyService) Connect(userID string) error {
	// This method can be used to check if user is already connected
	// or perform any additional connection logic
	return nil
}

func (s *SpotifyService) GetProfile(userID, requestUserID string) (map[string]interface{}, error) {
	token, err := s.GetValidToken(userID)
	if err != nil {
		return nil, fmt.Errorf("user not connected to spotify")
	}

	req, _ := http.NewRequest("GET", "https://api.spotify.com/v1/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var profile map[string]interface{}
	json.Unmarshal(body, &profile)

	return profile, nil
}

func (s *SpotifyService) Search(userID, query string) (map[string]interface{}, error) {
	token, err := s.GetValidToken(userID)
	if err != nil {
		return nil, fmt.Errorf("user not connected to spotify")
	}

	searchURL := fmt.Sprintf("https://api.spotify.com/v1/search?q=%s&type=track,artist,album&limit=10", url.QueryEscape(query))
	req, _ := http.NewRequest("GET", searchURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var results map[string]interface{}
	json.Unmarshal(body, &results)

	return results, nil
}
