package notifications

import (
	"net/http"
	"strconv"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type NotificationHandler struct {
	notificationService *services.NotificationService
}

func NewNotificationHandler(notificationService *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
	}
}

func (h *NotificationHandler) GetNotifications(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	authUser := user.(*middleware.AuthenticatedUser)

	// Parse query parameters
	limitStr := c.QueryParam("limit")
	offsetStr := c.QueryParam("offset")

	limit := 20 // default limit
	offset := 0 // default offset

	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	notifications, err := h.notificationService.GetNotifications(authUser.UserID, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get notifications"})
	}

	return c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) GetUnreadCount(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	authUser := user.(*middleware.AuthenticatedUser)

	count, err := h.notificationService.GetUnreadCount(authUser.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get unread count"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"unread_count": count,
	})
}

func (h *NotificationHandler) MarkAsRead(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	authUser := user.(*middleware.AuthenticatedUser)

	notificationID := c.Param("id")
	if notificationID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "notification ID required"})
	}

	err := h.notificationService.MarkAsRead(authUser.UserID, notificationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to mark notification as read"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	authUser := user.(*middleware.AuthenticatedUser)

	err := h.notificationService.MarkAllAsRead(authUser.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to mark all notifications as read"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "all notifications marked as read"})
}

func (h *NotificationHandler) DeleteNotification(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	authUser := user.(*middleware.AuthenticatedUser)

	notificationID := c.Param("id")
	if notificationID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "notification ID required"})
	}

	err := h.notificationService.DeleteNotification(authUser.UserID, notificationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete notification"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "notification deleted"})
}
