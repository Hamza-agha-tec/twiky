package websocket

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type WebSocketHandler struct {
	socketIOService *services.SocketIOService
}

func NewWebSocketHandler(socketIOService *services.SocketIOService) *WebSocketHandler {
	return &WebSocketHandler{
		socketIOService: socketIOService,
	}
}

func (h *WebSocketHandler) HandleWebSocket(c echo.Context) error {
	// The actual Socket.IO handling is done by the middleware
	// This endpoint is just for compatibility
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Socket.IO endpoint available at /socket.io/",
		"status":  "active",
	})
}

func (h *WebSocketHandler) GetSocketInfo(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	authUser := user.(*middleware.AuthenticatedUser)
	
	return c.JSON(http.StatusOK, map[string]interface{}{
		"user_id": authUser.UserID,
		"socket_endpoint": "/socket.io/",
		"available_events": []string{
			"chat_message",
			"voice_event", 
			"join_channel",
			"leave_channel",
			"join_voice_room",
			"leave_voice_room",
		},
		"status": "connected",
	})
}
