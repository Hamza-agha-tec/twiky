package voice

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type VoiceHandler struct {
	voiceService *services.VoiceService
}

func NewVoiceHandler(voiceService *services.VoiceService) *VoiceHandler {
	return &VoiceHandler{
		voiceService: voiceService,
	}
}

func (h *VoiceHandler) GetUserVoiceRooms(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	
	rooms, err := h.voiceService.GetUserVoiceGroups(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get voice rooms"})
	}

	return c.JSON(http.StatusOK, rooms)
}

func (h *VoiceHandler) GetVoiceRoom(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	roomID := c.Param("roomId")
	
	room, err := h.voiceService.GetVoiceRoomInfo(roomID, user.UserID)
	if err != nil {
		if err.Error() == "voice room not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "voice room not found"})
		}
		if err.Error() == "access denied" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "access denied"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get voice room"})
	}

	return c.JSON(http.StatusOK, room)
}

func (h *VoiceHandler) CreateVoiceRoom(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	
	var createData map[string]interface{}
	if err := c.Bind(&createData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Validate required fields
	if _, ok := createData["channelId"]; !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "channelId is required"})
	}
	if _, ok := createData["name"]; !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	channelID := createData["channelId"].(string)
	
	room, err := h.voiceService.CreateVoiceRoom(channelID, user.UserID, createData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create voice room"})
	}

	return c.JSON(http.StatusCreated, room)
}

func (h *VoiceHandler) ValidateRoomAccess(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	roomID := c.Param("roomId")
	
	hasAccess, err := h.voiceService.ValidateVoiceRoomAccess(roomID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to validate room access"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"hasAccess": hasAccess})
}
