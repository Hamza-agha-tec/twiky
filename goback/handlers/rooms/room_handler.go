package rooms

import (
	"encoding/json"
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type RoomHandler struct {
	roomService *services.RoomService
}

func NewRoomHandler(roomService *services.RoomService) *RoomHandler {
	return &RoomHandler{roomService: roomService}
}

func userID(c echo.Context) string {
	return c.Get("user").(*middleware.AuthenticatedUser).UserID
}

func (h *RoomHandler) GetMyRoom(c echo.Context) error {
	payload, err := h.roomService.GetRoom(userID(c))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, payload)
}

type saveRoomRequest struct {
	State json.RawMessage `json:"state"`
	Image *string         `json:"image,omitempty"`
}

func (h *RoomHandler) SaveMyRoom(c echo.Context) error {
	var req saveRoomRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	payload, err := h.roomService.SaveRoom(userID(c), req.State, req.Image)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, payload)
}

func (h *RoomHandler) GetPublicRoom(c echo.Context) error {
	username := c.Param("username")
	if username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "username required"})
	}
	payload, err := h.roomService.GetPublicRoomByUsername(username, userID(c))
	if err != nil {
		if err.Error() == "user not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, payload)
}

func (h *RoomHandler) VisitRoom(c echo.Context) error {
	username := c.Param("username")
	if err := h.roomService.RecordVisit(username, userID(c)); err != nil {
		if err.Error() == "user not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *RoomHandler) GetGroupPixelRoom(c echo.Context) error {
	groupID := c.Param("groupId")
	if groupID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "groupId required"})
	}
	payload, err := h.roomService.GetGroupRoom(groupID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, payload)
}

func (h *RoomHandler) SaveGroupPixelRoom(c echo.Context) error {
	groupID := c.Param("groupId")
	if groupID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "groupId required"})
	}
	var req saveRoomRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	payload, err := h.roomService.SaveGroupRoom(groupID, req.State)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, payload)
}

func (h *RoomHandler) ToggleLike(c echo.Context) error {
	username := c.Param("username")
	result, err := h.roomService.ToggleLike(username, userID(c))
	if err != nil {
		if err.Error() == "user not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, result)
}
