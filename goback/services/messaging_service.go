package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/lib/pq"
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

	// Assign user data to conversations
	for _, c := range convs {
		if u, ok := users[c.UserOneID]; ok {
			c.UserOne = u
		}
		if u, ok := users[c.UserTwoID]; ok {
			c.UserTwo = u
		}
	}

	// Fetch last message for each conversation
	if len(convs) > 0 {
		convIDs := make([]string, len(convs))
		for i, c := range convs {
			convIDs[i] = c.ID
		}

		lmRows, err := s.db.Query(`
			SELECT DISTINCT ON (conversation_id)
				id, conversation_id, sender_id, content, file_url, created_at, type, status
			FROM direct_messages
			WHERE conversation_id = ANY($1)
			ORDER BY conversation_id, created_at DESC
		`, pq.Array(convIDs))
		if err == nil {
			defer lmRows.Close()
			lastMsgByConv := map[string]*models.DirectMessage{}
			for lmRows.Next() {
				var (
					id, convID, senderID string
					content, fileURL     sql.NullString
					msgType, status      sql.NullString
					createdAt            time.Time
				)
				if err := lmRows.Scan(&id, &convID, &senderID, &content, &fileURL, &createdAt, &msgType, &status); err == nil {
					msg := &models.DirectMessage{
						ID:             id,
						ConversationID: convID,
						SenderID:       senderID,
						CreatedAt:      createdAt,
						Status:         status.String,
					}
					if content.Valid {
						msg.Content = &content.String
					}
					if fileURL.Valid {
						msg.FileURL = &fileURL.String
					}
					if msgType.Valid {
						msg.Type = &msgType.String
					}
					lastMsgByConv[convID] = msg
				}
			}
			for _, c := range convs {
				if msg, ok := lastMsgByConv[c.ID]; ok {
					c.LastMessage = []models.DirectMessage{*msg}
				}
			}
		}
	}

	// Fetch unread counts per conversation for this user
	if len(convs) > 0 {
		convIDs := make([]string, len(convs))
		for i, c := range convs {
			convIDs[i] = c.ID
		}

		ucRows, err := s.db.Query(`
			SELECT conversation_id, COUNT(*) as cnt
			FROM direct_messages
			WHERE conversation_id = ANY($1)
			  AND sender_id != $2
			  AND status != 'read'
			GROUP BY conversation_id
		`, pq.Array(convIDs), userID)
		if err == nil {
			defer ucRows.Close()
			unreadByConv := map[string]int{}
			for ucRows.Next() {
				var convID string
				var cnt int
				if err := ucRows.Scan(&convID, &cnt); err == nil {
					unreadByConv[convID] = cnt
				}
			}
			for _, c := range convs {
				c.UnreadCount = unreadByConv[c.ID]
			}
		}
	}

	return convs, nil
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
	var existingConv models.DirectConversation
	err := s.db.QueryRow(`
		SELECT id, user_one_id, user_two_id, created_at
		FROM direct_conversations
		WHERE (user_one_id = $1 AND user_two_id = $2) OR (user_one_id = $2 AND user_two_id = $1)
		`, userID, dto.TargetUserID).Scan(&existingConv.ID, &existingConv.UserOneID, &existingConv.UserTwoID, &existingConv.CreatedAt)

	if err == nil {
		return &existingConv, nil
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check existing conversation: %w", err)
	}

	// Create new conversation
	query := `
		INSERT INTO direct_conversations (id, user_one_id, user_two_id, created_at)
		VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
		RETURNING id, user_one_id, user_two_id, created_at
	`

	conv := &models.DirectConversation{}
	err = s.db.QueryRow(query, userOneId, userTwoId).Scan(
		&conv.ID, &conv.UserOneID, &conv.UserTwoID, &conv.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create direct conversation: %w", err)
	}

	return conv, nil
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
			id, convID, senderID                       string
			content, fileURL, replyToID, msgType, mime sql.NullString
			status                                     string
			isPinned, isForwarded                      sql.NullBool
			createdAt                                  time.Time
			sID                                        sql.NullString
			sUsername, sFullName, sAvatarURL           sql.NullString
			sIsVerified                                sql.NullBool
			sSubPlan                                   sql.NullString
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
		if content.Valid {
			contentPtr = &content.String
		}
		var fileURLPtr *string
		if fileURL.Valid {
			fileURLPtr = &fileURL.String
		}
		var replyToIDPtr *string
		if replyToID.Valid {
			replyToIDPtr = &replyToID.String
		}
		var typePtr *string
		if msgType.Valid {
			typePtr = &msgType.String
		}
		var mimePtr *string
		if mime.Valid {
			mimePtr = &mime.String
		}

		var sender *models.DirectMessageSender
		if sID.Valid {
			var isVerifiedPtr *bool
			if sIsVerified.Valid {
				isVerifiedPtr = &sIsVerified.Bool
			}
			var usernamePtr, fullNamePtr, avatarPtr *string
			if sUsername.Valid {
				usernamePtr = &sUsername.String
			}
			if sFullName.Valid {
				fullNamePtr = &sFullName.String
			}
			if sAvatarURL.Valid {
				avatarPtr = &sAvatarURL.String
			}
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
	if dto.ReplyToId != "" {
		replyToID = &dto.ReplyToId
	}
	if dto.FileUrl != "" {
		fileURL = &dto.FileUrl
	}
	if dto.Mime != "" {
		mime = &dto.Mime
	}
	var content *string
	if dto.Content != "" {
		content = &dto.Content
	}

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
	if sUsername.Valid {
		usernamePtr = &sUsername.String
	}
	if sFullName.Valid {
		fullNamePtr = &sFullName.String
	}
	if sAvatarURL.Valid {
		avatarPtr = &sAvatarURL.String
	}
	if sIsVerified.Valid {
		isVerifiedPtr = &sIsVerified.Bool
	}

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
		Select("id", "conversation_id", "sender_id", "content", "created_at", "updated_at").
		Filter("id", "eq", messageID).
		Execute(&updatedMessages)

	if err != nil || len(updatedMessages) == 0 {
		return nil, fmt.Errorf("failed to get updated message: %w", err)
	}

	return &updatedMessages[0], nil
}

// --- GROUP MESSAGING ---

func (s *MessagingService) GetGroupMessages(userID string, groupID string) ([]*models.GroupMessageResponse, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM channel_members cm
		JOIN groups g ON g.channel_id = cm.channel_id
		WHERE g.id = $1 AND cm.user_id = $2
	`, groupID, userID).Scan(&count)
	if err != nil || count == 0 {
		return nil, fmt.Errorf("group not found or access denied")
	}

	rows, err := s.db.Query(`
		SELECT
			m.id, m.group_id, m.sender_id, m.content, m.type, m.file_url,
			m.reply_to_id, m.mime, m.duration, m.size, m.is_pinned, m.created_at,
			u.id, u.username, u.avatar_url, u.sub_plan, u.is_verified
		FROM group_messages m
		LEFT JOIN users u ON u.id = m.sender_id
		WHERE m.group_id = $1
		ORDER BY m.created_at ASC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group messages: %w", err)
	}
	defer rows.Close()

	result := make([]*models.GroupMessageResponse, 0)
	for rows.Next() {
		msg := &models.GroupMessageResponse{
			EntityMentions: []map[string]interface{}{},
			Reactions:      []map[string]interface{}{},
			FileURLs:       []string{},
			Status:         "sent",
		}
		var sender models.GroupMessageSender
		var senderID, senderUsername, senderAvatar, senderSubPlan *string
		var senderVerified *bool

		err := rows.Scan(
			&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Type, &msg.FileURL,
			&msg.ReplyToID, &msg.Mime, &msg.Duration, &msg.Size, &msg.IsPinned, &msg.CreatedAt,
			&senderID, &senderUsername, &senderAvatar, &senderSubPlan, &senderVerified,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		if senderID != nil {
			sender.ID = *senderID
			sender.Username = senderUsername
			sender.AvatarURL = senderAvatar
			sender.IsVerified = senderVerified
			if senderSubPlan != nil {
				sender.SubPlan = *senderSubPlan
			}
			msg.Sender = &sender
		}
		result = append(result, msg)
	}

	return result, nil
}

func (s *MessagingService) SendGroupMessage(userID string, groupID string, dto models.SendGroupMessageDto) (*models.GroupMessageResponse, error) {
	// Verify user is a member of the channel that owns this group
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM channel_members cm
		JOIN groups g ON g.channel_id = cm.channel_id
		WHERE g.id = $1 AND cm.user_id = $2
	`, groupID, userID).Scan(&count)
	if err != nil || count == 0 {
		return nil, fmt.Errorf("group not found or access denied")
	}

	msgType := dto.Type
	if msgType == "" {
		msgType = "text"
	}

	msg := &models.GroupMessageResponse{
		EntityMentions: []map[string]interface{}{},
		Reactions:      []map[string]interface{}{},
		FileURLs:       []string{},
		Status:         "sent",
	}

	mentionsJSON := "[]"
	if len(dto.EntityMentions) > 0 {
		if b, err := json.Marshal(dto.EntityMentions); err == nil {
			mentionsJSON = string(b)
		}
	}

	var mentionsBytes []byte
	err = s.db.QueryRow(`
		INSERT INTO group_messages (group_id, sender_id, content, type, file_url, reply_to_id, mime, duration, size, is_pinned, entity_mentions)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)
		RETURNING id, group_id, sender_id, content, type, file_url, reply_to_id, mime, duration, size, is_pinned, entity_mentions, created_at
	`,
		groupID, userID,
		nullableString(dto.Content),
		msgType,
		nullableString(dto.FileUrl),
		nullableString(dto.ReplyToId),
		nullableString(dto.Mime),
		dto.Duration,
		dto.Size,
		mentionsJSON,
	).Scan(
		&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Type,
		&msg.FileURL, &msg.ReplyToID, &msg.Mime, &msg.Duration, &msg.Size,
		&msg.IsPinned, &mentionsBytes, &msg.CreatedAt,
	)

	if err == nil && len(mentionsBytes) > 0 {
		_ = json.Unmarshal(mentionsBytes, &msg.EntityMentions)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to send group message: %w", err)
	}

	// Fetch sender data so the socket broadcast includes name + avatar
	var sender models.GroupMessageSender
	var username, avatarURL *string
	var isVerified *bool
	var subPlan string
	err = s.db.QueryRow(`SELECT id, username, avatar_url, sub_plan, is_verified FROM users WHERE id = $1`, userID).
		Scan(&sender.ID, &username, &avatarURL, &subPlan, &isVerified)
	if err == nil {
		sender.Username = username
		sender.AvatarURL = avatarURL
		sender.SubPlan = subPlan
		sender.IsVerified = isVerified
		msg.Sender = &sender
	}

	return msg, nil
}

func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func (s *MessagingService) ToggleGroupMessageReaction(userID string, messageID string, emoji string) (*models.GroupMessage, error) {
	// Verify user sent the message
	var messages []models.GroupMessage
	err := s.supabase.GetClient().DB.From("group_messages").
		Select("sender_id").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || (messages[0].SenderID != nil && *messages[0].SenderID != userID) {
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
		Select("id", "group_id", "sender_id", "content", "is_pinned", "created_at").
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
		Select("sender_id", "is_pinned").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || (messages[0].SenderID != nil && *messages[0].SenderID != userID) {
		return nil, fmt.Errorf("message not found or access denied")
	}

	// Toggle pin
	var updatedMessages []models.GroupMessage
	err = s.supabase.GetClient().DB.From("group_messages").
		Update(map[string]interface{}{
			"is_pinned": !messages[0].IsPinned,
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
		Select("user_one_id", "user_two_id").
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
		Select("sender_id", "group_id").
		Filter("id", "eq", messageID).
		Execute(&messages)

	if err != nil || len(messages) == 0 || (messages[0].SenderID != nil && *messages[0].SenderID != userID) {
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
