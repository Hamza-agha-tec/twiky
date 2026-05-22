package github

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type GitHubHandler struct {
	githubService *services.GitHubService
}

func NewGitHubHandler(githubService *services.GitHubService) *GitHubHandler {
	return &GitHubHandler{githubService: githubService}
}

func (h *GitHubHandler) GetAuthURL(c echo.Context) error {
	url := h.githubService.GetAuthURL()
	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *GitHubHandler) Callback(c echo.Context) error {
	code := c.QueryParam("code")
	if code == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing code"})
	}
	userID := c.Get("userID").(string)
	conn, err := h.githubService.HandleCallback(userID, code)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":  "github connected successfully",
		"username": conn.GitHubUsername,
		"name":     conn.GitHubName,
	})
}

func (h *GitHubHandler) Disconnect(c echo.Context) error {
	userID := c.Get("userID").(string)
	if err := h.githubService.Disconnect(userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "github disconnected"})
}

func (h *GitHubHandler) GetProfile(c echo.Context) error {
	userID := c.Param("userId")
	profile, err := h.githubService.GetProfile(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, profile)
}

func (h *GitHubHandler) GetActivity(c echo.Context) error {
	userID := c.Param("userId")
	activity, err := h.githubService.GetActivity(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"events": activity})
}

func (h *GitHubHandler) GetStatus(c echo.Context) error {
	userID := c.Param("userId")
	coding, err := h.githubService.IsCodingNow(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	conn, _ := h.githubService.GetConnection(userID)
	username := ""
	if conn != nil {
		username = conn.GitHubUsername
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"is_coding": coding,
		"username":  username,
	})
}
