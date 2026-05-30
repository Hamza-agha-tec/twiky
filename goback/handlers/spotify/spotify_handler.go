package spotify

import (
	"net/http"
	"net/url"
	"os"

	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type SpotifyHandler struct {
	spotifyService *services.SpotifyService
}

func NewSpotifyHandler(spotifyService *services.SpotifyService) *SpotifyHandler {
	return &SpotifyHandler{
		spotifyService: spotifyService,
	}
}

func (h *SpotifyHandler) GetAuthURL(c echo.Context) error {
	userID := c.Get("userID").(string)
	url := h.spotifyService.GetAuthURL(userID)
	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func (h *SpotifyHandler) Callback(c echo.Context) error {
	code := c.QueryParam("code")
	userID := c.QueryParam("state")
	frontendURL := os.Getenv("NEXT_PUBLIC_SITE_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	if code == "" || userID == "" {
		return c.Redirect(http.StatusFound, frontendURL+"/chat?spotify=error&reason="+url.QueryEscape("missing code or state: code="+code+" state="+userID))
	}

	err := h.spotifyService.HandleCallback(userID, code)
	if err != nil {
		return c.Redirect(http.StatusFound, frontendURL+"/chat?spotify=error&reason="+url.QueryEscape(err.Error()))
	}

	return c.Redirect(http.StatusFound, frontendURL+"/chat?spotify=connected")
}

func (h *SpotifyHandler) Disconnect(c echo.Context) error {
	userID := c.Get("userID").(string)
	err := h.spotifyService.Disconnect(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "disconnected successfully"})
}

func (h *SpotifyHandler) GetNowPlaying(c echo.Context) error {
	targetUserID := c.Param("userId")
	requestUserID := c.Get("userID").(string)

	data, err := h.spotifyService.GetNowPlaying(targetUserID, requestUserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, data)
}

func (h *SpotifyHandler) Connect(c echo.Context) error {
	userID := c.Get("userID").(string)

	err := h.spotifyService.Connect(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "spotify connected successfully"})
}

func (h *SpotifyHandler) GetProfile(c echo.Context) error {
	userID := c.Param("userId")
	requestUserID := c.Get("userID").(string)

	profile, err := h.spotifyService.GetProfile(userID, requestUserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, profile)
}

func (h *SpotifyHandler) Search(c echo.Context) error {
	query := c.QueryParam("q")
	if query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query parameter is required"})
	}

	userID := c.Get("userID").(string)
	results, err := h.spotifyService.Search(userID, query)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, results)
}
