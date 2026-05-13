package routes

import (
	"os"

	"github.com/Hamza-agha-tec/goback/db"
	"github.com/Hamza-agha-tec/goback/handlers/auth"
	"github.com/Hamza-agha-tec/goback/handlers/channels"
	"github.com/Hamza-agha-tec/goback/handlers/collaboration"
	"github.com/Hamza-agha-tec/goback/handlers/contacts"
	"github.com/Hamza-agha-tec/goback/handlers/content"
	"github.com/Hamza-agha-tec/goback/handlers/files"
	"github.com/Hamza-agha-tec/goback/handlers/groups"
	"github.com/Hamza-agha-tec/goback/handlers/invitations"
	livekithandler "github.com/Hamza-agha-tec/goback/handlers/livekit"
	"github.com/Hamza-agha-tec/goback/handlers/messaging"
	"github.com/Hamza-agha-tec/goback/handlers/notifications"
	"github.com/Hamza-agha-tec/goback/handlers/payments"
	"github.com/Hamza-agha-tec/goback/handlers/spotify"
	userhandlers "github.com/Hamza-agha-tec/goback/handlers/users"
	"github.com/Hamza-agha-tec/goback/handlers/voice"
	"github.com/Hamza-agha-tec/goback/handlers/websocket"
	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

func SetupRoutes(e *echo.Echo) {
	// Set Supabase JWT secret in context for middleware
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			supabaseSecret := os.Getenv("SUPABASE_JWT_SECRET")
			c.Set("SUPABASE_JWT_SECRET", supabaseSecret)
			return next(c)
		}
	})

	// Initialize services
	authService := services.NewAuthService(db.DB)
	userService := services.NewUserService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	channelService := services.NewChannelService(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	contactService := services.NewContactService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	paymentService := services.NewPaymentService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	productPaymentsService := services.NewProductPaymentsService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	voiceService := services.NewVoiceService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	groupService := services.NewGroupService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	socketIOService := services.NewSocketIOService(db.DB)
	notificationService := services.NewNotificationService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))

	collaborationService := services.NewCollaborationService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	messagingService := services.NewMessagingService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	contentService := services.NewContentService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	fileService := services.NewFileService(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	spotifyService := services.NewSpotifyService(db.DB, os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))
	invitationService := services.NewInvitationService(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_ANON_KEY"))

	// Add user routes with new code style
	userRoutes(e, userService, contentService)

	// Add Socket.IO middleware
	e.Use(socketIOService.EchoMiddleware())

	// Initialize handlers
	authHandler := auth.NewAuthHandler(authService)
	userHandler := userhandlers.NewUserHandler(userService)
	channelHandler := channels.NewChannelHandler(channelService)
	contactHandler := contacts.NewContactHandler(contactService)
	paymentHandler := payments.NewPaymentHandler(paymentService, productPaymentsService)
	voiceHandler := voice.NewVoiceHandler(voiceService)
	groupHandler := groups.NewGroupHandler(groupService)
	webSocketHandler := websocket.NewWebSocketHandler(socketIOService)
	notificationHandler := notifications.NewNotificationHandler(notificationService)

	collaborationHandler := collaboration.NewCollaborationHandler(collaborationService)
	messagingHandler := messaging.NewMessagingHandler(messagingService, socketIOService)
	contentHandler := content.NewContentHandler(contentService)
	fileHandler := files.NewFileHandler(fileService)
	spotifyHandler := spotify.NewSpotifyHandler(spotifyService)
	invitationHandler := invitations.NewInvitationHandler(invitationService)

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// Public routes — no middleware
	public := e.Group("")
	public.GET("/users", userhandlers.GetAllUsers(userService))
	public.GET("/users/:id", userhandlers.GetUserByID(userService))
	public.POST("/auth", authHandler.Authenticate)

	// Optional auth routes (work with or without auth)
	optionalAuth := e.Group("")
	optionalAuth.Use(middleware.AuthMiddleware)
	optionalAuth.GET("/users/:id/followers", userHandler.GetFollowers)
	optionalAuth.GET("/users/:id/following", userHandler.GetFollowing)
	optionalAuth.GET("/users/username/:username", userHandler.GetUserByUsername)
	optionalAuth.GET("/users/:id", userHandler.GetUserByID)

	// Protected routes — with middleware
	protected := e.Group("")
	protected.Use(middleware.AuthMiddleware)

	// Auth routes
	protected.GET("/auth", authHandler.GetCurrentUser)
	protected.DELETE("/auth", authHandler.SignOut)

	// User routes
	protected.GET("/users/profile", userHandler.GetProfile)
	protected.PATCH("/users/profile", userHandler.UpdateProfile)
	protected.GET("/users/settings", userHandler.GetSettings)
	protected.PATCH("/users/settings", userHandler.UpdateSettings)
	protected.GET("/users/search", userHandler.Search)
	protected.GET("/users/mutual-followers", userHandler.GetMutualFollowers)
	protected.POST("/users/follows/:id", userHandler.FollowUser)
	protected.DELETE("/users/follows/:id", userHandler.UnfollowUser)

	// Channel routes
	protected.POST("/channels", channelHandler.CreateChannel)
	protected.GET("/channels", channelHandler.GetUserChannels)
	protected.GET("/channels/discover", channelHandler.DiscoverChannels)
	protected.GET("/channels/:id/invite-link", channelHandler.GetInviteLink)
	protected.GET("/channels/:id", channelHandler.GetChannelDetails)
	protected.PATCH("/channels/:id", channelHandler.UpdateChannel)
	protected.DELETE("/channels/:id", channelHandler.DeleteChannel)
	protected.GET("/channels/:id/members", channelHandler.GetMembers)
	protected.POST("/channels/:id/members", channelHandler.AddMember)
	protected.DELETE("/channels/:id/members/:userId", channelHandler.KickMember)
	protected.POST("/channels/:id/join", channelHandler.JoinChannel)
	protected.POST("/channels/:id/request-join", channelHandler.RequestJoinChannel)
	protected.GET("/channels/:id/join-requests", channelHandler.GetChannelJoinRequests)
	protected.PATCH("/channels/:id/join-requests/:requestId", channelHandler.RespondToChannelJoinRequest)

	// Contact routes
	protected.GET("/contacts", contactHandler.FindAll)
	protected.POST("/contacts", contactHandler.Create)
	protected.PATCH("/contacts/:contactId", contactHandler.Update)
	protected.PATCH("/contacts/:contactId/block", contactHandler.Block)
	protected.PATCH("/contacts/:contactId/archive", contactHandler.Archive)
	protected.PATCH("/contacts/:contactId/favorite", contactHandler.Favorite)
	protected.PATCH("/contacts/:contactId/pin", contactHandler.Pin)
	protected.PATCH("/contacts/:contactId/mute", contactHandler.Mute)
	protected.DELETE("/contacts/:contactId", contactHandler.Remove)

	// Payment routes
	protected.POST("/payments/checkout", paymentHandler.CreateCheckout)
	protected.GET("/payments/subscription", paymentHandler.GetSubscription)
	protected.GET("/payments/portal", paymentHandler.GetPortal)
	protected.POST("/payments/checkout/product", paymentHandler.CreateProductCheckout)
	protected.GET("/payments/orders", paymentHandler.GetOrders)
	protected.GET("/payments/orders/:orderId", paymentHandler.GetOrderById)
	protected.POST("/payments/webhook", paymentHandler.HandleWebhook)

	// Voice routes
	protected.GET("/voice/rooms", voiceHandler.GetUserVoiceRooms)
	protected.GET("/voice/rooms/:roomId", voiceHandler.GetVoiceRoom)
	protected.POST("/voice/rooms", voiceHandler.CreateVoiceRoom)
	protected.POST("/voice/rooms/:roomId/validate-access", voiceHandler.ValidateRoomAccess)

	// LiveKit token
	protected.POST("/livekit/token", livekithandler.GenerateToken)

	// Group routes
	protected.POST("/channels/:channelId/groups", groupHandler.CreateGroup)
	protected.GET("/channels/:channelId/groups", groupHandler.GetChannelGroups)
	protected.GET("/groups/:groupId/members", groupHandler.GetGroupMembers)
	protected.PATCH("/groups/:groupId", groupHandler.UpdateGroup)
	protected.DELETE("/groups/:groupId", groupHandler.DeleteGroup)
	protected.POST("/groups/:groupId/members", groupHandler.AddGroupMember)
	protected.PATCH("/groups/:groupId/members", groupHandler.UpdateGroupMemberRole)
	protected.DELETE("/groups/:groupId/members/:memberId", groupHandler.DeleteGroupMember)
	protected.POST("/groups/:groupId/join-requests", groupHandler.RequestJoin)
	protected.GET("/groups/:groupId/join-requests", groupHandler.GetJoinRequests)
	protected.PATCH("/groups/:groupId/join-requests/:requestId", groupHandler.RespondToJoinRequest)

	// WebSocket routes
	protected.GET("/websocket", webSocketHandler.HandleWebSocket)
	protected.GET("/websocket/info", webSocketHandler.GetSocketInfo)

	// Notification routes
	protected.GET("/notifications", notificationHandler.GetNotifications)
	protected.GET("/notifications/unread-count", notificationHandler.GetUnreadCount)
	protected.PATCH("/notifications/:id/read", notificationHandler.MarkAsRead)
	protected.PATCH("/notifications/read-all", notificationHandler.MarkAllAsRead)
	protected.DELETE("/notifications/:id", notificationHandler.DeleteNotification)

	// Collaboration routes
	protected.GET("/tasks", collaborationHandler.GetTasks)
	protected.POST("/tasks", collaborationHandler.CreateTask)
	protected.PATCH("/tasks/:id", collaborationHandler.UpdateTask)
	protected.GET("/notes", collaborationHandler.GetNotes)
	protected.POST("/notes", collaborationHandler.CreateNote)
	protected.PATCH("/notes/:id", collaborationHandler.UpdateNote)
	protected.GET("/goals", collaborationHandler.GetGoals)
	protected.POST("/goals", collaborationHandler.CreateGoal)
	protected.PATCH("/goals/:id", collaborationHandler.UpdateGoal)
	protected.GET("/goals/:id/milestones", collaborationHandler.GetMilestones)
	protected.POST("/goals/:id/milestones", collaborationHandler.CreateMilestone)
	protected.PATCH("/goals/milestones/:milestoneId/toggle", collaborationHandler.ToggleMilestone)
	protected.GET("/goals/:id/notes", collaborationHandler.GetGoalNotes)
	protected.POST("/goals/:id/notes", collaborationHandler.CreateGoalNote)

	// Messaging routes
	protected.GET("/direct-conversations", messagingHandler.GetDirectConversations)
	protected.POST("/direct-conversations", messagingHandler.CreateDirectConversation)
	protected.GET("/direct-conversations/:id/messages", messagingHandler.GetDirectMessages)
	protected.POST("/direct-conversations/:id/messages", messagingHandler.SendDirectMessage)
	protected.DELETE("/direct-conversations/:id", messagingHandler.DeleteDirectConversation)
	protected.POST("/direct-conversations/messages/:messageId/reactions", messagingHandler.ToggleDirectMessageReaction)
	protected.GET("/groups/:groupId/messages", messagingHandler.GetGroupMessages)
	protected.POST("/groups/:groupId/messages", messagingHandler.SendGroupMessage)
	protected.POST("/groups/messages/:messageId/reactions", messagingHandler.ToggleGroupMessageReaction)
	protected.PATCH("/groups/messages/:messageId/pin", messagingHandler.ToggleGroupMessagePin)
	protected.DELETE("/groups/messages/:messageId", messagingHandler.DeleteGroupMessage)

	// Content routes
	optionalAuth.GET("/posts/users/:userId", contentHandler.GetUserPosts)

	protected.POST("/posts", contentHandler.CreatePost)
	protected.POST("/posts/:id/comments", contentHandler.AddComment)
	protected.POST("/posts/:id/likes", contentHandler.LikePost)
	protected.DELETE("/posts/:id/likes", contentHandler.UnlikePost)
	protected.POST("/stories", contentHandler.CreateStory)
	protected.GET("/stories/feed", contentHandler.GetFeed)
	protected.GET("/stories/:id", contentHandler.GetStoryById)
	protected.POST("/stories/:id/view", contentHandler.RecordView)
	protected.GET("/stories/:id/viewers", contentHandler.GetStoryViewers)
	protected.POST("/stories/:id/react", contentHandler.ReactToStory)
	protected.DELETE("/stories/:id/react", contentHandler.RemoveReaction)
	protected.DELETE("/stories/:id", contentHandler.DeleteStory)
	protected.GET("/store/products", contentHandler.GetProducts)
	protected.GET("/store/products/active", contentHandler.GetActiveProducts)
	protected.GET("/store/products/featured", contentHandler.GetFeaturedProducts)
	protected.GET("/store/products/category/:category", contentHandler.GetProductsByCategory)
	protected.GET("/store/products/search", contentHandler.SearchProducts)
	protected.GET("/store/products/price-range", contentHandler.GetProductsByPriceRange)
	protected.GET("/store/products/on-sale", contentHandler.GetOnSaleProducts)
	protected.GET("/store/products/:id", contentHandler.GetProductById)
	protected.GET("/store/products/slug/:slug", contentHandler.GetProductBySlug)
	protected.POST("/store/products", contentHandler.CreateProduct)
	protected.PUT("/store/products/:id", contentHandler.UpdateProduct)
	protected.DELETE("/store/products/:id", contentHandler.DeleteProduct)

	// File routes
	protected.POST("/files/upload", fileHandler.UploadFile)
	protected.POST("/files/channels/:channelId/banner", fileHandler.UploadChannelBanner)
	protected.POST("/files/channels/:channelId/logo", fileHandler.UploadChannelLogo)
	protected.POST("/files/users/me/avatar_url", fileHandler.UploadUserAvatar)
	protected.POST("/files/users/me/enter_sound", fileHandler.UploadUserEnterSound)
	protected.POST("/files/users/me/logo", fileHandler.UploadUserLogo)
	protected.POST("/files/groups/:groupId/banner", fileHandler.UploadGroupBanner)
	protected.POST("/files/groups/:groupId/logo", fileHandler.UploadGroupLogo)
	protected.POST("/files/groups/:groupId/file", fileHandler.UploadGroupPrimaryFile)
	protected.POST("/files/groups/:groupId/files", fileHandler.UploadGroupExtra)
	protected.POST("/files/messages/upload", fileHandler.UploadMessageFile)
	protected.POST("/files/stories/upload", fileHandler.UploadStoryMedia)

	// Spotify routes
	protected.GET("/spotify/auth", spotifyHandler.GetAuthURL)
	protected.GET("/spotify/callback", spotifyHandler.Callback)
	protected.GET("/spotify/connect", spotifyHandler.Connect)
	protected.DELETE("/spotify/disconnect", spotifyHandler.Disconnect)
	protected.GET("/spotify/now-playing/:userId", spotifyHandler.GetNowPlaying)
	protected.GET("/spotify/profile/:userId", spotifyHandler.GetProfile)
	protected.GET("/spotify/search", spotifyHandler.Search)

	// Invitation routes
	protected.POST("/invitations", invitationHandler.Create)
	protected.POST("/invitations/respond", invitationHandler.Respond)
	protected.GET("/invitations", invitationHandler.GetInvitations)
}
