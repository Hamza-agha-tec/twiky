package services

import (
	"database/sql"
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
	var notifications []models.Notification
	err := s.supabase.GetClient().DB.From("notifications").
		Select("*").
		Eq("recipient_id", userID).
		Execute(&notifications)

	if err != nil {
		return nil, fmt.Errorf("failed to query notifications: %w", err)
	}

	// Apply pagination manually since Supabase client doesn't support LIMIT/OFFSET
	start := offset
	end := offset + limit
	if start > len(notifications) {
		return []*models.Notification{}, nil
	}
	if end > len(notifications) {
		end = len(notifications)
	}

	// Convert to pointer slice with pagination
	var notificationPtrs []*models.Notification
	for i := start; i < end; i++ {
		notificationPtrs = append(notificationPtrs, &notifications[i])
	}

	return notificationPtrs, nil
}

func (s *NotificationService) GetUnreadCount(userID string) (int, error) {
	var notifications []models.Notification
	err := s.supabase.GetClient().DB.From("notifications").
		Select("id").
		Eq("recipient_id", userID).
		Eq("is_read", "false").
		Execute(&notifications)

	if err != nil {
		return 0, fmt.Errorf("failed to query unread count: %w", err)
	}

	return len(notifications), nil
}

func (s *NotificationService) MarkAsRead(userID, notificationID string) error {
	updateData := map[string]interface{}{
		"is_read": true,
	}

	var notifications []models.Notification
	err := s.supabase.GetClient().DB.From("notifications").
		Update(updateData).
		Eq("id", notificationID).
		Eq("recipient_id", userID).
		Execute(&notifications)

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
