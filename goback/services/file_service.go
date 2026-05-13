package services

import (
	"bytes"
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
		return "", fmt.Errorf("supabase storage error: %s", resp.Status)
	}

	// Return public URL
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, path)
	return publicURL, nil
}
