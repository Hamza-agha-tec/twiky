package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/lib/pq"
)

type MessagingService struct {
	db *sql.DB
}

func NewMessagingService(db *sql.DB) *MessagingService {
	return &MessagingService{
		db: db,
	}
}

// --- DIRECT CONVERSATIONS ---

func (s *MessagingService) GetDirectConversations(userID string) ([]*models.DirectConversation, error) {

	rows, err := s.db.Query(`
		SELECT id, user_one_id, user_two_id, created_at
		FROM direct_conversations
		WHERE user_one_id = $1 OR user_two_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []*models.DirectConversation

	for rows.Next() {
		c := &models.DirectConversation{}

		err := rows.Scan(
			&c.ID,
			&c.UserOneID,
			&c.UserTwoID,
			&c.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		convs = append(convs, c)
	}

	// STEP 2 users
	userIDsMap := map[string]struct{}{}
	for _, c := range convs {
		userIDsMap[c.UserOneID] = struct{}{}
		userIDsMap[c.UserTwoID] = struct{}{}
	}

	var userIDs []string
	for id := range userIDsMap {
		userIDs = append(userIDs, id)
	}

	users := map[string]models.UserPublic{}

	if len(userIDs) > 0 {
		urows, err := s.db.Query(`
			SELECT id, username, avatar_url, banner, sub_plan, is_verified, last_seen_at
			FROM users
			WHERE id = ANY($1)
		`, pq.Array(userIDs))
		if err != nil {
			return nil, err
		}
		defer urows.Close()

		for urows.Next() {
			var u models.UserPublic
			_ = urows.Scan(
				&u.ID,
				&u.Username,
				&u.AvatarURL,
				&u.Banner,
				&u.SubPlan,
				&u.IsVerified,
				&u.LastSeenAt,
			)
			users[u.ID] = u
		}
	}

	for _, c := range convs {
		_ = users[c.UserOneID]
		_ = users[c.UserTwoID]
	}

	return convs, nil
}

func (s *MessagingService) CreateDirectConversation(userID string, dto models.StartDirectConversationDto) (*models.DirectConversation, error) {
	// Check if conversation already exists
	var existingConv models.DirectConversation
	err := s.db.QueryRow(`
		SELECT id, user_one_id, user_two_id, created_at, updated_at
		FROM direct_conversations
		WHERE (user_one_id = $1 AND user_two_id = $2) OR (user_one_id = $2 AND user_two_id = $1)
	`, userID, dto.UserID).Scan(&existingConv.ID, &existingConv.UserOneID, &existingConv.UserTwoID, &existingConv.CreatedAt)

	if err == nil {
		return &existingConv, nil
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check existing conversation: %w", err)
	}

	// Create new conversation
	query := `
		INSERT INTO direct_conversations (id, user_one_id, user_two_id, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, user_one_id, user_two_id, created_at, updated_at
	`

	conv := &models.DirectConversation{}
	err = s.db.QueryRow(query, userID, dto.UserID).Scan(
		&conv.ID, &conv.UserOneID, &conv.UserTwoID, &conv.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create direct conversation: %w", err)
	}

	return conv, nil
}

func (s *MessagingService) GetDirectMessages(userID string, conversationID string) ([]*models.DirectMessage, error) {
	// Verify user is part of conversation
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM direct_conversations 
			WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)
		)
	`, conversationID, userID).Scan(&exists)

	if err != nil || !exists {
		return nil, fmt.Errorf("conversation not found or access denied")
	}

	query := `
		SELECT id, conversation_id, sender_id, content, created_at, updated_at
		FROM direct_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`

	rows, err := s.db.Query(query, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get direct messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.DirectMessage
	for rows.Next() {
		msg := &models.DirectMessage{}
		err := rows.Scan(&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Content, &msg.CreatedAt, &msg.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (s *MessagingService) SendDirectMessage(userID string, conversationID string, dto models.SendDirectMessageDto) (*models.DirectMessage, error) {
	// Verify user is part of conversation
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM direct_conversations 
			WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)
		)
	`, conversationID, userID).Scan(&exists)

	if err != nil || !exists {
		return nil, fmt.Errorf("conversation not found or access denied")
	}

	query := `
		INSERT INTO direct_messages (id, conversation_id, sender_id, content, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, conversation_id, sender_id, content, created_at, updated_at
	`

	msg := &models.DirectMessage{}
	err = s.db.QueryRow(query, conversationID, userID, dto.Content).Scan(
		&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Content, &msg.CreatedAt, &msg.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to send direct message: %w", err)
	}

	return msg, nil
}

func (s *MessagingService) ToggleDirectMessageReaction(userID string, messageID string, emoji string) (*models.DirectMessage, error) {
	// Verify user sent the message
	var senderID string
	err := s.db.QueryRow("SELECT sender_id FROM direct_messages WHERE id = $1", messageID).Scan(&senderID)
	if err != nil || senderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Upsert reaction
	_, err = s.db.Exec(`
		INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET emoji = $3
	`, messageID, userID, emoji)

	if err != nil {
		return nil, fmt.Errorf("failed to toggle reaction: %w", err)
	}

	// Return updated message
	query := `
		SELECT id, conversation_id, sender_id, content, created_at, updated_at
		FROM direct_messages
		WHERE id = $1
	`

	msg := &models.DirectMessage{}
	err = s.db.QueryRow(query, messageID).Scan(
		&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Content, &msg.CreatedAt, &msg.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get updated message: %w", err)
	}

	return msg, nil
}

// --- GROUP MESSAGING ---

func (s *MessagingService) GetGroupMessages(userID string, groupID string) ([]*models.GroupMessage, error) {
	// Verify user is member of group
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_members 
			WHERE group_id = $1 AND user_id = $2
		)
	`, groupID, userID).Scan(&exists)

	if err != nil || !exists {
		return nil, fmt.Errorf("group not found or access denied")
	}

	query := `
		SELECT id, group_id, sender_id, content, pinned, created_at, updated_at
		FROM group_messages
		WHERE group_id = $1
		ORDER BY created_at ASC
	`

	rows, err := s.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.GroupMessage
	for rows.Next() {
		msg := &models.GroupMessage{}
		err := rows.Scan(&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Pinned, &msg.CreatedAt, &msg.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (s *MessagingService) SendGroupMessage(userID string, groupID string, dto models.SendGroupMessageDto) (*models.GroupMessage, error) {
	// Verify user is member of group
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_members 
			WHERE group_id = $1 AND user_id = $2
		)
	`, groupID, userID).Scan(&exists)

	if err != nil || !exists {
		return nil, fmt.Errorf("group not found or access denied")
	}

	query := `
		INSERT INTO group_messages (id, group_id, sender_id, content, pinned, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, group_id, sender_id, content, pinned, created_at, updated_at
	`

	msg := &models.GroupMessage{}
	err = s.db.QueryRow(query, groupID, userID, dto.Content).Scan(
		&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Pinned, &msg.CreatedAt, &msg.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to send group message: %w", err)
	}

	return msg, nil
}

func (s *MessagingService) ToggleGroupMessageReaction(userID string, messageID string, emoji string) (*models.GroupMessage, error) {
	// Verify user sent the message
	var senderID string
	err := s.db.QueryRow("SELECT sender_id FROM group_messages WHERE id = $1", messageID).Scan(&senderID)
	if err != nil || senderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Upsert reaction
	_, err = s.db.Exec(`
		INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET emoji = $3
	`, messageID, userID, emoji)

	if err != nil {
		return nil, fmt.Errorf("failed to toggle reaction: %w", err)
	}

	// Return updated message
	query := `
		SELECT id, group_id, sender_id, content, pinned, created_at, updated_at
		FROM group_messages
		WHERE id = $1
	`

	msg := &models.GroupMessage{}
	err = s.db.QueryRow(query, messageID).Scan(
		&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Pinned, &msg.CreatedAt, &msg.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get updated message: %w", err)
	}

	return msg, nil
}

func (s *MessagingService) ToggleGroupMessagePin(userID string, messageID string) (*models.GroupMessage, error) {
	// Verify user sent the message
	var senderID string
	err := s.db.QueryRow("SELECT sender_id FROM group_messages WHERE id = $1", messageID).Scan(&senderID)
	if err != nil || senderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Toggle pin
	query := `
		UPDATE group_messages
		SET pinned = NOT pinned, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
		RETURNING id, group_id, sender_id, content, pinned, created_at, updated_at
	`

	msg := &models.GroupMessage{}
	err = s.db.QueryRow(query, messageID).Scan(
		&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Pinned, &msg.CreatedAt, &msg.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to toggle pin: %w", err)
	}

	return msg, nil
}

func (s *MessagingService) DeleteGroupMessage(userID string, messageID string) (map[string]interface{}, error) {
	// Verify user sent the message
	var senderID string
	var groupID string
	err := s.db.QueryRow("SELECT sender_id, group_id FROM group_messages WHERE id = $1", messageID).Scan(&senderID, &groupID)
	if err != nil || senderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Delete message
	_, err = s.db.Exec("DELETE FROM group_messages WHERE id = $1", messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to delete message: %w", err)
	}

	return map[string]interface{}{
		"groupId":   groupID,
		"messageId": messageID,
	}, nil
}
