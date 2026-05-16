package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type NotificationService struct {
	db       *sql.DB
	supabase *SupabaseClient
	socketIO *SocketIOService
}

func NewNotificationService(db *sql.DB, supabaseURL, supabaseKey string, socketIO *SocketIOService) *NotificationService {
	return &NotificationService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
		socketIO: socketIO,
	}
}

func (s *NotificationService) formatNotification(n *models.Notification) {
	if n.Actor == nil {
		n.Actor = &models.NotificationActor{
			Username: "Twiky",
		}
	}

	switch n.Type {
	case "follow":
		n.Title = "New Follower"
		n.Message = fmt.Sprintf("%s started following you.", n.Actor.Username)
	case "like":
		n.Title = "New Like"
		n.Message = fmt.Sprintf("%s liked your post.", n.Actor.Username)
	case "comment":
		n.Title = "New Comment"
		n.Message = fmt.Sprintf("%s commented on your post.", n.Actor.Username)
	case "MENTION":
		n.Title = "New Mention"
		n.Message = fmt.Sprintf("%s mentioned you.", n.Actor.Username)
	case "mention_group":
		groupName := "a group"
		if name, ok := n.Metadata["group_name"].(string); ok {
			groupName = name
		}
		n.Title = "Group Mention"
		n.Message = fmt.Sprintf("%s mentioned you in %s.", n.Actor.Username, groupName)
	case "channel_invite":
		channelName := "a channel"
		if name, ok := n.Metadata["channel_name"].(string); ok {
			channelName = name
		}
		n.Title = "Channel Invitation"
		n.Message = fmt.Sprintf("%s invited you to join %s.", n.Actor.Username, channelName)
	case "group_invite":
		groupName := "a group"
		if name, ok := n.Metadata["group_name"].(string); ok {
			groupName = name
		}
		n.Title = "Group Invitation"
		n.Message = fmt.Sprintf("%s invited you to join %s.", n.Actor.Username, groupName)
	default:
		n.Title = "New Notification"
		n.Message = "You have a new update."
	}
}

func (s *NotificationService) GetNotifications(userID string, limit, offset int) ([]*models.Notification, error) {
	query := `
		SELECT n.id, n.recipient_id, n.actor_id, n.type, n.entity_id, n.entity_type, n.is_read, n.metadata, n.created_at,
		       u.id, u.username, u.avatar_url
		FROM notifications n
		LEFT JOIN users u ON n.actor_id = u.id
		WHERE n.recipient_id = $1
		ORDER BY n.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query notifications: %w", err)
	}
	defer rows.Close()

	var notificationPtrs []*models.Notification
	for rows.Next() {
		n := &models.Notification{
			Actor: &models.NotificationActor{},
		}
		var metadataJSON []byte
		var actorID, actorUsername, actorAvatar sql.NullString

		err := rows.Scan(
			&n.ID, &n.RecipientID, &n.ActorID, &n.Type, &n.EntityID, &n.EntityType,
			&n.IsRead, &metadataJSON, &n.CreatedAt,
			&actorID, &actorUsername, &actorAvatar,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification row: %w", err)
		}

		n.Metadata = make(map[string]interface{})
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &n.Metadata)
		}

		if actorID.Valid {
			n.Actor.ID = actorID.String
			n.Actor.Username = actorUsername.String
			n.Actor.AvatarURL = actorAvatar.String
		} else {
			n.Actor = nil
		}

		s.formatNotification(n)
		notificationPtrs = append(notificationPtrs, n)
	}

	return notificationPtrs, nil
}

func (s *NotificationService) GetUnreadCount(userID string) (int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false`
	var count int
	err := s.db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to query unread count: %w", err)
	}
	return count, nil
}

func (s *NotificationService) MarkAsRead(userID, notificationID string) error {
	query := `UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2`
	_, err := s.db.Exec(query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}
	return nil
}

func (s *NotificationService) MarkAllAsRead(userID string) error {
	updateData := map[string]interface{}{
		"is_read": true,
	}

	var notifications []models.Notification
	err := s.supabase.GetClient().DB.From("notifications").
		Update(updateData).
		Eq("recipient_id", userID).
		Execute(&notifications)

	if err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}

	return nil
}

func (s *NotificationService) CreateNotification(notification models.NotificationCreateDto) (*models.Notification, error) {
	notificationData := map[string]interface{}{
		"recipient_id": notification.RecipientID,
		"actor_id":     notification.ActorID,
		"type":         notification.Type,
		"entity_id":    notification.EntityID,
		"entity_type":  notification.EntityType,
		"is_read":      false,
		"metadata":     notification.Metadata,
		"created_at":   time.Now(),
	}

	var notifications []models.Notification
	err := s.supabase.GetClient().DB.From("notifications").
		Insert(notificationData).
		Execute(&notifications)

	if err != nil {
		return nil, fmt.Errorf("failed to create notification: %w", err)
	}

	if len(notifications) == 0 {
		return nil, fmt.Errorf("failed to create notification: no notification returned")
	}

	newNotification := &notifications[0]

	var actors []models.User
	err = s.supabase.GetClient().DB.From("users").
		Select("*").
		Eq("id", newNotification.ActorID).
		Execute(&actors)
	if err == nil && len(actors) > 0 {
		newNotification.Actor = &models.NotificationActor{
			ID: actors[0].ID,
		}
		if actors[0].Username != nil {
			newNotification.Actor.Username = *actors[0].Username
		}
		if actors[0].AvatarURL != nil {
			newNotification.Actor.AvatarURL = *actors[0].AvatarURL
		}
	}

	s.formatNotification(newNotification)

	if s.socketIO != nil {
		s.socketIO.NotifyUser(newNotification.RecipientID, newNotification)
	}

	return newNotification, nil
}

func (s *NotificationService) DeleteNotification(userID, notificationID string) error {
	var notifications []models.Notification
	err := s.supabase.GetClient().DB.From("notifications").
		Delete().
		Eq("id", notificationID).
		Eq("recipient_id", userID).
		Execute(&notifications)

	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	return nil
}

func (s *NotificationService) CreateFollowNotification(followerID, followingID string) error {
	notification := models.NotificationCreateDto{
		RecipientID: followingID,
		ActorID:     followerID,
		Type:        "follow",
		EntityID:    followerID,
		EntityType:  "user",
		Metadata: map[string]interface{}{
			"follower_id":     followerID,
			"can_follow_back": true,
		},
	}

	_, err := s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateLikeNotification(likerID, postID string) error {
	var postOwnerID string
	query := `SELECT user_id FROM user_posts WHERE id = $1`
	err := s.db.QueryRow(query, postID).Scan(&postOwnerID)
	if err != nil {
		return fmt.Errorf("failed to get post owner: %w", err)
	}

	if likerID == postOwnerID {
		return nil
	}

	notification := models.NotificationCreateDto{
		RecipientID: postOwnerID,
		ActorID:     likerID,
		Type:        "like",
		EntityID:    postID,
		EntityType:  "post",
		Metadata: map[string]interface{}{
			"liker_id": likerID,
			"post_id":  postID,
		},
	}

	_, err = s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateCommentNotification(commenterID, postID, commentID string) error {
	var postOwnerID string
	query := `SELECT user_id FROM user_posts WHERE id = $1`
	err := s.db.QueryRow(query, postID).Scan(&postOwnerID)
	if err != nil {
		return fmt.Errorf("failed to get post owner: %w", err)
	}

	if commenterID == postOwnerID {
		return nil
	}

	notification := models.NotificationCreateDto{
		RecipientID: postOwnerID,
		ActorID:     commenterID,
		Type:        "comment",
		EntityID:    commentID,
		EntityType:  "comment",
		Metadata: map[string]interface{}{
			"commenter_id": commenterID,
			"post_id":      postID,
			"comment_id":   commentID,
		},
	}

	_, err = s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateMentionGroupNotification(actorID, recipientID, groupID, groupName string) error {
	notification := models.NotificationCreateDto{
		RecipientID: recipientID,
		ActorID:     actorID,
		Type:        "mention_group",
		EntityID:    groupID,
		EntityType:  "group",
		Metadata: map[string]interface{}{
			"group_id":   groupID,
			"group_name": groupName,
		},
	}

	_, err := s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateChannelInviteNotification(actorID, recipientID, channelID, channelName string) error {
	notification := models.NotificationCreateDto{
		RecipientID: recipientID,
		ActorID:     actorID,
		Type:        "channel_invite",
		EntityID:    channelID,
		EntityType:  "channel",
		Metadata: map[string]interface{}{
			"channel_id":   channelID,
			"channel_name": channelName,
		},
	}

	_, err := s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateGroupInviteNotification(actorID, recipientID, groupID, groupName string) error {
	notification := models.NotificationCreateDto{
		RecipientID: recipientID,
		ActorID:     actorID,
		Type:        "group_invite",
		EntityID:    groupID,
		EntityType:  "group",
		Metadata: map[string]interface{}{
			"group_id":   groupID,
			"group_name": groupName,
		},
	}

	_, err := s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateMentionNotifications(actorID, groupID, content string, explicitMentions []models.EntityMention) {
	log.Printf("[MENTION] Scanning content and processing %d explicit mentions", len(explicitMentions))

	// 1. Fetch Group info for metadata
	var groupName string
	err := s.db.QueryRow("SELECT name FROM groups WHERE id = $1", groupID).Scan(&groupName)
	if err != nil {
		log.Printf("[MENTION] Error fetching group name: %v", err)
		groupName = "a group"
	}

	notified := make(map[string]bool)

	// 2. Process explicit mentions from dropdown selection
	for _, m := range explicitMentions {
		if m.Type != "user" || m.EntityID == "" || m.EntityID == actorID {
			continue
		}
		if notified[m.EntityID] {
			continue
		}

		log.Printf("[MENTION] Processing explicit mention for user ID: %s", m.EntityID)
		s.notifyMention(actorID, m.EntityID, groupID, groupName)
		notified[m.EntityID] = true
	}

	// 3. Find all @username patterns in text (for manually typed mentions)
	re := regexp.MustCompile(`@(\w+)`)
	matches := re.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		username := match[1]
		log.Printf("[MENTION] Found text mention candidate: %s", username)

		// Find user by username (Case Insensitive)
		var recipientID string
		err := s.db.QueryRow("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", username).Scan(&recipientID)
		if err != nil {
			log.Printf("[MENTION] User %s not found in database", username)
			continue
		}

		if recipientID == actorID || notified[recipientID] {
			continue
		}

		s.notifyMention(actorID, recipientID, groupID, groupName)
		notified[recipientID] = true
	}
}

func (s *NotificationService) notifyMention(actorID, recipientID, groupID, groupName string) {
	metadata := map[string]interface{}{
		"group_id":   groupID,
		"group_name": groupName,
	}

	_, err := s.CreateNotification(models.NotificationCreateDto{
		RecipientID: recipientID,
		ActorID:     actorID,
		Type:        "MENTION",
		EntityID:    groupID,
		EntityType:  "GROUP",
		Metadata:    metadata,
	})

	if err != nil {
		log.Printf("[MENTION] Failed to create notification for user %s: %v", recipientID, err)
	} else {
		log.Printf("[MENTION] Successfully notified user %s", recipientID)
	}
}
