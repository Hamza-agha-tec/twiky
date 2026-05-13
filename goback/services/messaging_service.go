package services

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type MessagingService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewMessagingService(db *sql.DB, supabaseURL, supabaseKey string) *MessagingService {
	return &MessagingService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

// --- DIRECT CONVERSATIONS ---

func (s *MessagingService) GetDirectConversations(userID string) ([]*models.DirectConversationResponse, error) {
	// Get conversations where user is participant
	var conversations []models.DirectConversation

	// Add better error handling for the Supabase query
	err := s.supabase.GetClient().DB.From("direct_conversations").
		Select("*").
		Execute(&conversations)

	if err != nil {
		return nil, fmt.Errorf("failed to get direct conversations: %w", err)
	}

	// Initialize empty slice if nil to prevent JSON parsing issues
	if conversations == nil {
		conversations = make([]models.DirectConversation, 0)
	}

	// Filter conversations where user is participant
	var result []*models.DirectConversationResponse
	for _, conv := range conversations {
		if conv.UserOneID == userID || conv.UserTwoID == userID {
			// Get user details for both participants
			var userOneSlice, userTwoSlice []models.User
			err1 := s.supabase.GetClient().DB.From("users").
				Select("*").
				Eq("id", conv.UserOneID).
				Execute(&userOneSlice)

			if err1 != nil {
				return nil, fmt.Errorf("failed to get user one details (ID=%s): %w", conv.UserOneID, err1)
			}

			err2 := s.supabase.GetClient().DB.From("users").
				Select("*").
				Eq("id", conv.UserTwoID).
				Execute(&userTwoSlice)

			if err2 != nil {
				return nil, fmt.Errorf("failed to get user two details (ID=%s): %w", conv.UserTwoID, err2)
			}

			if len(userOneSlice) == 0 {
				return nil, fmt.Errorf("user one not found (ID=%s)", conv.UserOneID)
			}

			if len(userTwoSlice) == 0 {
				return nil, fmt.Errorf("user two not found (ID=%s)", conv.UserTwoID)
			}

			// Map user one to simplified struct
			userOne := models.DirectConversationUser{
				ID:         userOneSlice[0].ID,
				Banner:     userOneSlice[0].Banner,
				SubPlan:    userOneSlice[0].SubPlan,
				Username:   userOneSlice[0].Username,
				AvatarURL:  userOneSlice[0].AvatarURL,
				IsVerified: userOneSlice[0].IsVerified,
				LastSeenAt: userOneSlice[0].LastSeenAt,
			}

			// Map user two to simplified struct
			userTwo := models.DirectConversationUser{
				ID:         userTwoSlice[0].ID,
				Banner:     userTwoSlice[0].Banner,
				SubPlan:    userTwoSlice[0].SubPlan,
				Username:   userTwoSlice[0].Username,
				AvatarURL:  userTwoSlice[0].AvatarURL,
				IsVerified: userTwoSlice[0].IsVerified,
				LastSeenAt: userTwoSlice[0].LastSeenAt,
			}

			// Parse unread_count as int
			unreadCount := 0
			if conv.UnreadCount != "" {
				fmt.Sscanf(conv.UnreadCount, "%d", &unreadCount)
			}

			// Build conversation with simplified user details
			convResponse := &models.DirectConversationResponse{
				ID:          conv.ID,
				UserOneID:   conv.UserOneID,
				UserTwoID:   conv.UserTwoID,
				CreatedAt:   conv.CreatedAt,
				LastMessage: []map[string]interface{}{},
				UserOne:     userOne,
				UserTwo:     userTwo,
				UnreadCount: unreadCount,
			}
			result = append(result, convResponse)
		}
	}

	return result, nil
}

func (s *MessagingService) CreateDirectConversation(userID string, dto models.StartDirectConversationDto) (*models.DirectConversation, error) {
	// Enforce MUTUAL FOLLOW RULE
	// Ensure A follows B
	var followA []models.Follow
	errA := s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("follower_id", userID).
		Eq("following_id", dto.TargetUserID).
		Execute(&followA)

	// Ensure B follows A
	var followB []models.Follow
	errB := s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("follower_id", dto.TargetUserID).
		Eq("following_id", userID).
		Execute(&followB)

	if errA != nil || errB != nil {
		return nil, fmt.Errorf("failed to check follow relationships: %v", errA)
	}

	if len(followA) == 0 || len(followB) == 0 {
		return nil, fmt.Errorf("you can only message mutual followers")
	}

	// Sort alphabetically to prevent duplicate conversations (A->B and B->A)
	userOneId, userTwoId := userID, dto.TargetUserID
	if userOneId > userTwoId {
		userOneId, userTwoId = userTwoId, userOneId
	}

	// Check if conversation already exists
	var existing []models.DirectConversation
	err := s.supabase.GetClient().DB.From("direct_conversations").
		Select("*").
		Eq("user_one_id", userOneId).
		Eq("user_two_id", userTwoId).
		Execute(&existing)

	if err != nil {
		return nil, fmt.Errorf("failed to check existing conversation: %w", err)
	}

	if len(existing) > 0 {
		return &existing[0], nil
	}

	// Create new conversation
	var conversations []models.DirectConversation
	err = s.supabase.GetClient().DB.From("direct_conversations").
		Insert(map[string]interface{}{
			"user_one_id": userOneId,
			"user_two_id": userTwoId,
			"created_at":  "now()",
			"updated_at":  "now()",
		}).
		Execute(&conversations)

	if err != nil {
		return nil, fmt.Errorf("failed to create direct conversation: %w", err)
	}

	if len(conversations) == 0 {
		return nil, fmt.Errorf("failed to create direct conversation: no data returned")
	}

	return &conversations[0], nil
}

func (s *MessagingService) GetDirectMessages(userID string, conversationID string) ([]*models.DirectMessageResponse, error) {
	// Verify access via raw SQL
	var convID string
	err := s.db.QueryRow(`
		SELECT id FROM direct_conversations
		WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)
		LIMIT 1
	`, conversationID, userID).Scan(&convID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found or access denied")
	}

	rows, err := s.db.Query(`
		SELECT
			dm.id, dm.conversation_id, dm.sender_id,
			dm.content, dm.file_url, dm.reply_to_id,
			dm.status, dm.type, dm.mime,
			dm.is_pinned, dm.is_forwarded, dm.created_at,
			u.id, u.username, u.fullname, u.avatar_url, u.is_verified, u.sub_plan
		FROM direct_messages dm
		LEFT JOIN users u ON u.id = dm.sender_id
		WHERE dm.conversation_id = $1
		ORDER BY dm.created_at ASC
	`, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get direct messages: %w", err)
	}
	defer rows.Close()

	var result []*models.DirectMessageResponse
	for rows.Next() {
		var (
			id, convID, senderID string
			content, fileURL, replyToID, msgType, mime sql.NullString
			status                                      string
			isPinned, isForwarded                       sql.NullBool
			createdAt                                   time.Time
			sID                                         sql.NullString
			sUsername, sFullName, sAvatarURL            sql.NullString
			sIsVerified                                 sql.NullBool
			sSubPlan                                    sql.NullString
		)
		if err := rows.Scan(
			&id, &convID, &senderID,
			&content, &fileURL, &replyToID,
			&status, &msgType, &mime,
			&isPinned, &isForwarded, &createdAt,
			&sID, &sUsername, &sFullName, &sAvatarURL, &sIsVerified, &sSubPlan,
		); err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}

		var contentPtr *string
		if content.Valid { contentPtr = &content.String }
		var fileURLPtr *string
		if fileURL.Valid { fileURLPtr = &fileURL.String }
		var replyToIDPtr *string
		if replyToID.Valid { replyToIDPtr = &replyToID.String }
		var typePtr *string
		if msgType.Valid { typePtr = &msgType.String }
		var mimePtr *string
		if mime.Valid { mimePtr = &mime.String }

		var sender *models.DirectMessageSender
		if sID.Valid {
			var isVerifiedPtr *bool
			if sIsVerified.Valid { isVerifiedPtr = &sIsVerified.Bool }
			var usernamePtr, fullNamePtr, avatarPtr *string
			if sUsername.Valid { usernamePtr = &sUsername.String }
			if sFullName.Valid { fullNamePtr = &sFullName.String }
			if sAvatarURL.Valid { avatarPtr = &sAvatarURL.String }
			sender = &models.DirectMessageSender{
				ID:         sID.String,
				Username:   usernamePtr,
				Fullname:   fullNamePtr,
				FullName:   fullNamePtr,
				AvatarURL:  avatarPtr,
				IsVerified: isVerifiedPtr,
				SubPlan:    sSubPlan.String,
			}
		}

		result = append(result, &models.DirectMessageResponse{
			ID:             id,
			ConversationID: convID,
			SenderID:       senderID,
			Content:        contentPtr,
			Type:           typePtr,
			FileURL:        fileURLPtr,
			Mime:           mimePtr,
			ReplyToID:      replyToIDPtr,
			IsPinned:       isPinned.Bool,
			IsForwarded:    isForwarded.Bool,
			Status:         status,
			FileURLs:       []string{},
			Reactions:      []map[string]interface{}{},
			CreatedAt:      createdAt,
			Sender:         sender,
		})
	}

	if result == nil {
		result = []*models.DirectMessageResponse{}
	}
	return result, nil
}

func (s *MessagingService) SendDirectMessage(userID string, conversationID string, dto models.SendDirectMessageDto) (*models.DirectMessageResponse, error) {
	// Verify access
	var convID string
	err := s.db.QueryRow(`
		SELECT id FROM direct_conversations
		WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)
		LIMIT 1
	`, conversationID, userID).Scan(&convID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found or access denied")
	}

	msgType := dto.Type
	if msgType == "" {
		msgType = "text"
	}

	var replyToID, fileURL, mime *string
	if dto.ReplyToId != "" { replyToID = &dto.ReplyToId }
	if dto.FileUrl != "" { fileURL = &dto.FileUrl }
	if dto.Mime != "" { mime = &dto.Mime }
	var content *string
	if dto.Content != "" { content = &dto.Content }

	var msgID string
	var createdAt time.Time
	err = s.db.QueryRow(`
		INSERT INTO direct_messages
			(conversation_id, sender_id, content, type, file_url, reply_to_id, mime, is_forwarded, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent')
		RETURNING id, created_at
	`, conversationID, userID, content, msgType, fileURL, replyToID, mime, dto.IsForwarded).
		Scan(&msgID, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to send direct message: %w", err)
	}

	// Fetch sender info
	var sUsername, sFullName, sAvatarURL sql.NullString
	var sIsVerified sql.NullBool
	var sSubPlan sql.NullString
	_ = s.db.QueryRow(`
		SELECT username, fullname, avatar_url, is_verified, sub_plan
		FROM users WHERE id = $1
	`, userID).Scan(&sUsername, &sFullName, &sAvatarURL, &sIsVerified, &sSubPlan)

	var usernamePtr, fullNamePtr, avatarPtr *string
	var isVerifiedPtr *bool
	if sUsername.Valid { usernamePtr = &sUsername.String }
	if sFullName.Valid { fullNamePtr = &sFullName.String }
	if sAvatarURL.Valid { avatarPtr = &sAvatarURL.String }
	if sIsVerified.Valid { isVerifiedPtr = &sIsVerified.Bool }

	sender := &models.DirectMessageSender{
		ID:         userID,
		Username:   usernamePtr,
		Fullname:   fullNamePtr,
		FullName:   fullNamePtr,
		AvatarURL:  avatarPtr,
		IsVerified: isVerifiedPtr,
		SubPlan:    sSubPlan.String,
	}

	t := msgType
	return &models.DirectMessageResponse{
		ID:             msgID,
		ConversationID: conversationID,
		SenderID:       userID,
		Content:        content,
		Type:           &t,
		FileURL:        fileURL,
		Mime:           mime,
		ReplyToID:      replyToID,
		IsForwarded:    dto.IsForwarded,
		IsPinned:       false,
		Status:         "sent",
		FileURLs:       []string{},
		Reactions:      []map[string]interface{}{},
		CreatedAt:      createdAt,
		Sender:         sender,
	}, nil
}

func (s *MessagingService) ToggleDirectMessageReaction(userID string, messageID string, emoji string) (*models.DirectMessage, error) {
	// Verify user sent the message
	var messages []models.DirectMessage
	err := s.supabase.GetClient().DB.From("direct_messages").
		Select("sender_id").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || messages[0].SenderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Upsert reaction - first check if reaction exists
	var reactions []models.MessageReaction
	err = s.supabase.GetClient().DB.From("message_reactions").
		Select("id").
		Filter("message_id", "eq", messageID).
		Filter("user_id", "eq", userID).
		Execute(&reactions)

	if err != nil {
		return nil, fmt.Errorf("failed to check existing reaction: %w", err)
	}

	if len(reactions) > 0 {
		// Update existing reaction
		var updatedReactions []models.MessageReaction
		err = s.supabase.GetClient().DB.From("message_reactions").
			Update(map[string]interface{}{"emoji": emoji}).
			Filter("message_id", "eq", messageID).
			Filter("user_id", "eq", userID).
			Execute(&updatedReactions)
		if err != nil {
			return nil, fmt.Errorf("failed to update reaction: %w", err)
		}
	} else {
		// Insert new reaction
		var newReactions []models.MessageReaction
		err = s.supabase.GetClient().DB.From("message_reactions").
			Insert(map[string]interface{}{
				"message_id": messageID,
				"user_id":    userID,
				"emoji":      emoji,
				"created_at": "now()",
			}).
			Execute(&newReactions)
		if err != nil {
			return nil, fmt.Errorf("failed to create reaction: %w", err)
		}
	}

	// Return updated message
	var updatedMessages []models.DirectMessage
	err = s.supabase.GetClient().DB.From("direct_messages").
		Select("id, conversation_id, sender_id, content, created_at, updated_at").
		Filter("id", "eq", messageID).
		Execute(&updatedMessages)

	if err != nil || len(updatedMessages) == 0 {
		return nil, fmt.Errorf("failed to get updated message: %w", err)
	}

	return &updatedMessages[0], nil
}

// --- GROUP MESSAGING ---

func (s *MessagingService) GetGroupMessages(userID string, groupID string) ([]*models.GroupMessageResponse, error) {
	// Verify user is member of group
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("*").
		Eq("group_id", groupID).
		Eq("user_id", userID).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to check group membership (groupID=%s, userID=%s): %w", groupID, userID, err)
	}

	if len(members) == 0 {
		return nil, fmt.Errorf("group not found or access denied: user is not a member of this group")
	}

	var messages []models.GroupMessage
	err = s.supabase.GetClient().DB.From("group_messages").
		Select("*").
		Eq("group_id", groupID).
		Execute(&messages)

	if err != nil {
		return nil, fmt.Errorf("failed to get group messages (groupID=%s): %w", groupID, err)
	}

	// Build response with sender details
	var result []*models.GroupMessageResponse
	for _, msg := range messages {
		var sender *models.GroupMessageSender
		if msg.SenderID != "" {
			// Get sender details
			var userSlice []models.User
			err := s.supabase.GetClient().DB.From("users").
				Select("*").
				Eq("id", msg.SenderID).
				Execute(&userSlice)

			if err != nil {
				return nil, fmt.Errorf("failed to get sender details (senderID=%s): %w", msg.SenderID, err)
			}

			if len(userSlice) > 0 {
				sender = &models.GroupMessageSender{
					ID:         userSlice[0].ID,
					Fullname:   userSlice[0].FullName,
					SubPlan:    userSlice[0].SubPlan,
					Username:   userSlice[0].Username,
					AvatarURL:  userSlice[0].AvatarURL,
					IsVerified: userSlice[0].IsVerified,
				}
			}
		}

		// Build message response
		senderIDPtr := &msg.SenderID
		if msg.SenderID == "" {
			senderIDPtr = nil
		}

		messageResponse := &models.GroupMessageResponse{
			ID:             msg.ID,
			GroupID:        msg.GroupID,
			SenderID:       senderIDPtr,
			Content:        msg.Content,
			FileURL:        nil,
			ReplyToID:      nil,
			CreatedAt:      msg.CreatedAt,
			Status:         "sent",
			IsEdited:       false,
			EntityMentions: []map[string]interface{}{},
			Reactions:      []map[string]interface{}{},
			IsPinned:       msg.Pinned,
			FileURLs:       []string{},
			Type:           nil,
			Mime:           nil,
			Duration:       nil,
			Size:           nil,
			Sender:         sender,
		}
		result = append(result, messageResponse)
	}

	return result, nil
}

func (s *MessagingService) SendGroupMessage(userID string, groupID string, dto models.SendGroupMessageDto) (*models.GroupMessage, error) {
	// Verify user is member of group
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("id").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&members)

	if err != nil || len(members) == 0 {
		return nil, fmt.Errorf("group not found or access denied")
	}

	// Create message
	var messages []models.GroupMessage
	err = s.supabase.GetClient().DB.From("group_messages").
		Insert(map[string]interface{}{
			"group_id":   groupID,
			"sender_id":  userID,
			"content":    dto.Content,
			"pinned":     false,
			"created_at": "now()",
			"updated_at": "now()",
		}).
		Execute(&messages)

	if err != nil {
		return nil, fmt.Errorf("failed to send group message: %w", err)
	}

	if len(messages) == 0 {
		return nil, fmt.Errorf("failed to send group message: no data returned")
	}

	return &messages[0], nil
}

func (s *MessagingService) ToggleGroupMessageReaction(userID string, messageID string, emoji string) (*models.GroupMessage, error) {
	// Verify user sent the message
	var messages []models.GroupMessage
	err := s.supabase.GetClient().DB.From("group_messages").
		Select("sender_id").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || messages[0].SenderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Upsert reaction - first check if reaction exists
	var reactions []models.MessageReaction
	err = s.supabase.GetClient().DB.From("message_reactions").
		Select("id").
		Filter("message_id", "eq", messageID).
		Filter("user_id", "eq", userID).
		Execute(&reactions)

	if err != nil {
		return nil, fmt.Errorf("failed to check existing reaction: %w", err)
	}

	if len(reactions) > 0 {
		// Update existing reaction
		var updatedReactions []models.MessageReaction
		err = s.supabase.GetClient().DB.From("message_reactions").
			Update(map[string]interface{}{"emoji": emoji}).
			Filter("message_id", "eq", messageID).
			Filter("user_id", "eq", userID).
			Execute(&updatedReactions)
		if err != nil {
			return nil, fmt.Errorf("failed to update reaction: %w", err)
		}
	} else {
		// Insert new reaction
		var newReactions []models.MessageReaction
		err = s.supabase.GetClient().DB.From("message_reactions").
			Insert(map[string]interface{}{
				"message_id": messageID,
				"user_id":    userID,
				"emoji":      emoji,
				"created_at": "now()",
			}).
			Execute(&newReactions)
		if err != nil {
			return nil, fmt.Errorf("failed to create reaction: %w", err)
		}
	}

	// Return updated message
	var updatedMessages []models.GroupMessage
	err = s.supabase.GetClient().DB.From("group_messages").
		Select("id, group_id, sender_id, content, pinned, created_at, updated_at").
		Filter("id", "eq", messageID).
		Execute(&updatedMessages)

	if err != nil || len(updatedMessages) == 0 {
		return nil, fmt.Errorf("failed to get updated message: %w", err)
	}

	return &updatedMessages[0], nil
}

func (s *MessagingService) ToggleGroupMessagePin(userID string, messageID string) (*models.GroupMessage, error) {
	// Verify user sent the message
	var messages []models.GroupMessage
	err := s.supabase.GetClient().DB.From("group_messages").
		Select("sender_id, pinned").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || messages[0].SenderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Toggle pin
	var updatedMessages []models.GroupMessage
	err = s.supabase.GetClient().DB.From("group_messages").
		Update(map[string]interface{}{
			"pinned":     !messages[0].Pinned,
			"updated_at": "now()",
		}).
		Filter("id", "eq", messageID).
		Execute(&updatedMessages)

	if err != nil || len(updatedMessages) == 0 {
		return nil, fmt.Errorf("failed to toggle pin: %w", err)
	}

	return &updatedMessages[0], nil
}

func (s *MessagingService) DeleteDirectConversation(userID string, conversationID string) (map[string]interface{}, error) {
	// Verify user is part of conversation
	var conv []models.DirectConversation
	err := s.supabase.GetClient().DB.From("direct_conversations").
		Select("user_one_id, user_two_id").
		Filter("id", "eq", conversationID).
		Execute(&conv)

	if err != nil || len(conv) == 0 {
		return nil, fmt.Errorf("conversation not found")
	}

	conversation := conv[0]
	if conversation.UserOneID != userID && conversation.UserTwoID != userID {
		return nil, fmt.Errorf("access denied")
	}

	// Delete conversation
	err = s.supabase.GetClient().DB.From("direct_conversations").
		Delete().
		Filter("id", "eq", conversationID).
		Execute(nil)

	if err != nil {
		return nil, fmt.Errorf("failed to delete conversation: %w", err)
	}

	return map[string]interface{}{"success": true}, nil
}

func (s *MessagingService) DeleteGroupMessage(userID string, messageID string) (map[string]interface{}, error) {
	// Verify user sent the message
	var messages []models.GroupMessage
	err := s.supabase.GetClient().DB.From("group_messages").
		Select("sender_id, group_id").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || messages[0].SenderID != userID {
		return nil, fmt.Errorf("message not found or access denied")
	}

	groupID := messages[0].GroupID

	// Delete message
	err = s.supabase.GetClient().DB.From("group_messages").
		Delete().
		Filter("id", "eq", messageID).
		Execute(nil)

	if err != nil {
		return nil, fmt.Errorf("failed to delete message: %w", err)
	}

	return map[string]interface{}{
		"groupId":   groupID,
		"messageId": messageID,
	}, nil
}
