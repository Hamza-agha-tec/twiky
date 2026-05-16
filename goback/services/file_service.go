package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
)

type FileService struct {
	supabase *SupabaseClient
}

func NewFileService(supabaseURL, supabaseKey string) *FileService {
	return &FileService{
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

// Helper to upload a file directly to Supabase Storage via REST
func (s *FileService) UploadToSupabase(bucket, path string, file *multipart.FileHeader) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return "", err
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	// Fallback to anon key if service role is missing
	if supabaseKey == "" {
		supabaseKey = os.Getenv("SUPABASE_ANON_KEY")
	}

	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, path)

	req, err := http.NewRequest("POST", uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", file.Header.Get("Content-Type"))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase storage error: %s: %s", resp.Status, string(body))
	}

	// Return public URL
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, path)
	return publicURL, nil
}

type SignedUploadURLResult struct {
	SignedURL string `json:"signedUrl"`
	Token     string `json:"token"`
	Path      string `json:"path"`
	PublicURL string `json:"publicUrl"`
}

// CreateSignedUploadURL asks Supabase Storage for a one-time signed upload URL
// for the given bucket/path, then returns it along with the eventual public URL.
func (s *FileService) CreateSignedUploadURL(bucket, path string) (*SignedUploadURLResult, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if supabaseKey == "" {
		supabaseKey = os.Getenv("SUPABASE_ANON_KEY")
	}
	if supabaseURL == "" || supabaseKey == "" {
		return nil, fmt.Errorf("supabase env not configured")
	}

	endpoint := fmt.Sprintf("%s/storage/v1/object/upload/sign/%s/%s", supabaseURL, bucket, path)
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader([]byte(`{}`)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase signed-url error: %s: %s", resp.Status, string(body))
	}

	// Supabase returns: { "url": "/object/upload/sign/<bucket>/<path>?token=...", "token": "..." }
	var parsed struct {
		URL   string `json:"url"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("decode signed-url response: %w", err)
	}

	// Build a fully-qualified signed URL the client can PUT to.
	signedURL := parsed.URL
	if signedURL != "" && signedURL[0] == '/' {
		signedURL = supabaseURL + "/storage/v1" + signedURL
	}
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, path)

	return &SignedUploadURLResult{
		SignedURL: signedURL,
		Token:     parsed.Token,
		Path:      path,
		PublicURL: publicURL,
	}, nil
}
