package handlers

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

// GetAllUsers — GET /api/users
func GetAllUsers(userService *services.UserService) echo.HandlerFunc {
	return func(c echo.Context) error {
		users, err := userService.GetUsers()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, users)
	}
}

// GetUserByID — GET /api/users/:id
func GetUserByID(userService *services.UserService) echo.HandlerFunc {
	return func(c echo.Context) error {
		id := c.Param("id")

		user, err := userService.GetUserByID(id, "") // requestingUserID empty for this endpoint
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
		}

		return c.JSON(http.StatusOK, user)
	}
}

// UpdateUser — PATCH /api/users/:id
func UpdateUser(userService *services.UserService) echo.HandlerFunc {
	return func(c echo.Context) error {
		id := c.Param("id")

		var input models.UpdateUserInput
		if err := c.Bind(&input); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		}

		err := userService.UpdateProfile(id, input)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]string{"message": "user updated successfully"})
	}
}

// DeleteUser — DELETE /api/users/:id
func DeleteUser(userService *services.UserService) echo.HandlerFunc {
	return func(c echo.Context) error {
		//id := c.Param("id")

		// This would need a DeleteUser method in the service
		// For now, returning not implemented
		return c.JSON(http.StatusNotImplemented, map[string]string{"error": "not implemented"})
	}
}
