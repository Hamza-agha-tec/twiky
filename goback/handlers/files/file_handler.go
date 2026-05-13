package files

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type FileHandler struct {
	fileService *services.FileService
}

func NewFileHandler(fileService *services.FileService) *FileHandler {
	return &FileHandler{
		fileService: fileService,
	}
}

func (h *FileHandler) UploadFile(c echo.Context) error {
	bucket := c.FormValue("bucket")
	if bucket == "" {
		bucket = "general"
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	userID := c.Get("userID").(string)
	path := fmt.Sprintf("%s/%d_%s", userID, time.Now().Unix(), file.Filename)

	url, err := h.fileService.UploadToSupabase(bucket, path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"url": url,
	})
}

func (h *FileHandler) UploadChannelBanner(c echo.Context) error {
	channelID := c.Param("channelId")

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("channels/%s/banner_%s", channelID, file.Filename)
	url, err := h.fileService.UploadToSupabase("channels", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadChannelLogo(c echo.Context) error {
	channelID := c.Param("channelId")

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("channels/%s/logo_%s", channelID, file.Filename)
	url, err := h.fileService.UploadToSupabase("channels", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadUserAvatar(c echo.Context) error {
	userID := c.Get("userID").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("users/%s/avatar_url_%s", userID, file.Filename)
	url, err := h.fileService.UploadToSupabase("users", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadUserEnterSound(c echo.Context) error {
	userID := c.Get("userID").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("users/%s/enter_sound_%s", userID, file.Filename)
	url, err := h.fileService.UploadToSupabase("users", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadUserLogo(c echo.Context) error {
	userID := c.Get("userID").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("users/%s/logo_%s", userID, file.Filename)
	url, err := h.fileService.UploadToSupabase("users", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadGroupBanner(c echo.Context) error {
	groupID := c.Param("groupId")

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("groups/%s/banner_%s", groupID, file.Filename)
	url, err := h.fileService.UploadToSupabase("groups", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadGroupLogo(c echo.Context) error {
	groupID := c.Param("groupId")

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("groups/%s/logo_%s", groupID, file.Filename)
	url, err := h.fileService.UploadToSupabase("groups", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadGroupPrimaryFile(c echo.Context) error {
	groupID := c.Param("groupId")

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("groups/%s/primary_%s", groupID, file.Filename)
	url, err := h.fileService.UploadToSupabase("groups", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadGroupExtra(c echo.Context) error {
	groupID := c.Param("groupId")

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("groups/%s/extra_%s", groupID, file.Filename)
	url, err := h.fileService.UploadToSupabase("groups", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) UploadMessageFile(c echo.Context) error {
	userID := c.Get("userID").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("messages/%s/%s", userID, file.Filename)
	url, err := h.fileService.UploadToSupabase("messages", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	fileType := "file"
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp":
		fileType = "image"
	case ".mp4", ".webm", ".mov", ".avi", ".mkv":
		fileType = "video"
	case ".mp3", ".wav", ".ogg", ".m4a":
		fileType = "voice"
	}

	return c.JSON(http.StatusOK, map[string]string{
		"url":      url,
		"fileUrl":  url,
		"fileName": file.Filename,
		"fileType": fileType,
	})
}

func (h *FileHandler) UploadStoryMedia(c echo.Context) error {
	userID := c.Get("userID").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file missing from request"})
	}

	path := fmt.Sprintf("stories/%s/%s", userID, file.Filename)
	url, err := h.fileService.UploadToSupabase("stories", path, file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *FileHandler) GetStorySignedUploadUrl(c echo.Context) error {
	userID := c.Get("userID").(string)

	var body struct {
		Filename string `json:"filename"`
		MimeType string `json:"mimeType"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	// For now, return a simple signed URL (in production, you'd generate proper signed URLs)
	signedUrl := fmt.Sprintf("https://your-supabase-url.com/storage/v1/upload/signature/stories/%s/%s", userID, body.Filename)

	return c.JSON(http.StatusOK, map[string]string{
		"signedUrl": signedUrl,
	})
}
