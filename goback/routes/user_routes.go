package routes

import (
	"github.com/Hamza-agha-tec/goback/handlers/content"
	handlers "github.com/Hamza-agha-tec/goback/handlers/users"
	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

func userRoutes(e *echo.Echo, userService *services.UserService, contentService *services.ContentService, notificationService *services.NotificationService, socketIOService *services.SocketIOService) {

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// Public routes — no middleware
	public := e.Group("/api")
	public.GET("/users", handlers.GetAllUsers(userService))
	public.GET("/users/:id", handlers.GetUserByID(userService))
	public.GET("/users/search", handlers.SearchUsers(userService))
	public.GET("/posts/users/:id", content.NewContentHandler(contentService, notificationService, socketIOService).GetUserPosts)

	// Protected routes — with middleware
	protected := e.Group("/api")
	protected.Use(middleware.AuthMiddleware)
	protected.PATCH("/users/:id", handlers.UpdateUser(userService))
	protected.DELETE("/users/:id", handlers.DeleteUser(userService))
}
