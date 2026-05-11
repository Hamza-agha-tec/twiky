package handlers

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type UserHandler struct {
	userService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

func (h *UserHandler) GetProfile(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	profile, err := h.userService.GetUserByID(user.UserID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	return c.JSON(http.StatusOK, profile)
}

func (h *UserHandler) UpdateProfile(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var updateData models.UpdateUserInput
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.userService.UpdateProfile(user.UserID, updateData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update profile"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "profile updated successfully"})
}

func (h *UserHandler) GetSettings(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	settings, err := h.userService.GetSettings(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get settings"})
	}

	return c.JSON(http.StatusOK, settings)
}

func (h *UserHandler) UpdateSettings(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var updateData models.UserSettings
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// TODO: Implement settings update service method using user.UserID
	_ = user.UserID // Placeholder to avoid unused variable error
	return c.JSON(http.StatusOK, map[string]string{"message": "settings updated successfully"})
}

func (h *UserHandler) Search(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	username := c.QueryParam("username")

	if username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "username parameter is required"})
	}

	users, err := h.userService.SearchByUsername(username, user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to search users"})
	}

	return c.JSON(http.StatusOK, users)
}

func (h *UserHandler) GetMutualFollowers(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	mutualFollowers, err := h.userService.GetMutualFollowers(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get mutual followers"})
	}

	return c.JSON(http.StatusOK, mutualFollowers)
}

func (h *UserHandler) FollowUser(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	followingID := c.Param("id")

	if followingID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user ID is required"})
	}

	err := h.userService.FollowUser(user.UserID, followingID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to follow user"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user followed successfully"})
}

func (h *UserHandler) UnfollowUser(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	followingID := c.Param("id")

	if followingID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user ID is required"})
	}

	err := h.userService.UnfollowUser(user.UserID, followingID)
	if err != nil {
		if err.Error() == "not following this user" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to unfollow user"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user unfollowed successfully"})
}

func (h *UserHandler) GetFollowers(c echo.Context) error {
	id := c.Param("id")
	user := c.Get("user")
	var requestingUserID string
	if user != nil {
		requestingUserID = user.(*middleware.AuthenticatedUser).UserID
	}

	followers, err := h.userService.GetFollowers(id, requestingUserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get followers"})
	}

	if followers == nil {
		followers = []*models.FollowerResponse{}
	}

	return c.JSON(http.StatusOK, followers)
}

func (h *UserHandler) GetFollowing(c echo.Context) error {
	id := c.Param("id")
	user := c.Get("user")
	var requestingUserID string
	if user != nil {
		requestingUserID = user.(*middleware.AuthenticatedUser).UserID
	}

	following, err := h.userService.GetFollowing(id, requestingUserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get following"})
	}

	if following == nil {
		following = []*models.FollowingResponse{}
	}

	return c.JSON(http.StatusOK, following)
}

func (h *UserHandler) GetUserByUsername(c echo.Context) error {
	username := c.Param("username")

	user := c.Get("user").(*middleware.AuthenticatedUser)
	var requestingUserID string

	if user != nil {
		requestingUserID = user.UserID
	}

	users, err := h.userService.SearchByUsername(username, requestingUserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to search users"})
	}

	return c.JSON(http.StatusOK, users)
}

func (h *UserHandler) GetUserByID(c echo.Context) error {
	id := c.Param("id")
	user := c.Get("user")
	var requestingUserID string

	if user != nil {
		requestingUserID = user.(*middleware.AuthenticatedUser).UserID
	}

	profile, err := h.userService.GetUserByID(id, requestingUserID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	return c.JSON(http.StatusOK, profile)
}

func (h *UserHandler) GetUsers(c echo.Context) error {
	users, err := h.userService.GetUsers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get users"})
	}

	return c.JSON(http.StatusOK, users)
}
