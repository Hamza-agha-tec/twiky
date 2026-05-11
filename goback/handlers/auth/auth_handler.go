package auth

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

func (h *AuthHandler) Authenticate(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Authenticated!",
	})
}

func (h *AuthHandler) GetCurrentUser(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	userData, err := h.authService.GetUserByID(user.UserID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	return c.JSON(http.StatusOK, userData)
}

func (h *AuthHandler) SignOut(c echo.Context) error {
	// In a Supabase-based auth system, sign-out is typically handled client-side
	// But we can perform any server-side cleanup here
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Signed Out!",
	})
}
