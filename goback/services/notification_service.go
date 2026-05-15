package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type NotificationService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewNotificationService(db *sql.DB, supabaseURL, supabaseKey string) *NotificationService {
	return &NotificationService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
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

		// Handle metadata
		// If metadataJSON is nil or empty, use an empty map
		n.Metadata = make(map[string]interface{})
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &n.Metadata)
		}

		// Handle actor
		if actorID.Valid {
			n.Actor.ID = actorID.String
			n.Actor.Username = actorUsername.String
			n.Actor.AvatarURL = actorAvatar.String
		} else {
			n.Actor = nil
		}

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

	return &notifications[0], nil
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

// Helper methods for common notification types

func (s *NotificationService) CreateFollowNotification(followerID, followingID string) error {
	notification := models.NotificationCreateDto{
		RecipientID: followingID,
		ActorID:     followerID,
		Type:        "follow",
		EntityID:    followerID,
		EntityType:  "user",
		Metadata: map[string]interface{}{
			"follower_id": followerID,
		},
	}

	_, err := s.CreateNotification(notification)
	return err
}

func (s *NotificationService) CreateLikeNotification(likerID, postID string) error {
	// Get post owner to notify them
	var postOwnerID string
	query := `SELECT user_id FROM user_posts WHERE id = $1`
	err := s.db.QueryRow(query, postID).Scan(&postOwnerID)
	if err != nil {
		return fmt.Errorf("failed to get post owner: %w", err)
	}

	// Don't notify if user liked their own post
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
	// Get post owner to notify them
	var postOwnerID string
	query := `SELECT user_id FROM user_posts WHERE id = $1`
	err := s.db.QueryRow(query, postID).Scan(&postOwnerID)
	if err != nil {
		return fmt.Errorf("failed to get post owner: %w", err)
	}

	// Don't notify if user commented on their own post
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
