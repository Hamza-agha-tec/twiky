package livekit

import (
	"net/http"
	"os"
	"time"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type tokenRequest struct {
	RoomName            string `json:"roomName"`
	ParticipantIdentity string `json:"participantIdentity"`
}

func GenerateToken(c echo.Context) error {
	_ = c.Get("user").(*middleware.AuthenticatedUser)

	var req tokenRequest
	if err := c.Bind(&req); err != nil || req.RoomName == "" || req.ParticipantIdentity == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "roomName and participantIdentity required"})
	}

	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")
	if apiKey == "" || apiSecret == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "LiveKit not configured"})
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"iss": apiKey,
		"sub": req.ParticipantIdentity,
		"iat": now.Unix(),
		"nbf": now.Add(-10 * time.Second).Unix(),
		"exp": now.Add(6 * time.Hour).Unix(),
		"video": map[string]interface{}{
			"room":         req.RoomName,
			"roomJoin":     true,
			"canPublish":   true,
			"canSubscribe": true,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(apiSecret))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to sign token"})
	}

	return c.JSON(http.StatusOK, map[string]string{"token": signed})
}
