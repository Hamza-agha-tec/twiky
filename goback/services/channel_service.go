package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type ChannelService struct {
	db *sql.DB
}

func NewChannelService(db *sql.DB) *ChannelService {
	return &ChannelService{
		db: db,
	}
}

func (s *ChannelService) CreateChannel(userID string, createData models.CreateChannelDto) (*models.Channel, error) {
	query := `
		INSERT INTO channels (id, name, description, avatar_url, owner_id, access_type, is_archived, member_count, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, avatar_url, owner_id, access_type, is_archived, member_count, created_at, updated_at
	`

	channel := &models.Channel{}
	err := s.db.QueryRow(query,
		createData.Name, createData.Description, createData.AvatarURL,
		userID, createData.AccessType,
	).Scan(
		&channel.ID, &channel.Name, &channel.Description, &channel.AvatarURL,
		&channel.OwnerID, &channel.AccessType, &channel.IsArchived,
		&channel.MemberCount, &channel.CreatedAt, &channel.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create channel: %w", err)
	}

	// Add owner as member
	_, err = s.db.Exec(`
		INSERT INTO channel_members (id, channel_id, user_id, role, joined_at)
		VALUES (gen_random_uuid(), $1, $2, 'ADMIN', CURRENT_TIMESTAMP)
	`, channel.ID, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to add owner as channel member: %w", err)
	}

	return channel, nil
}

func (s *ChannelService) GetUserChannels(userID string) ([]*models.Channel, error) {
	query := `
		SELECT c.id, c.name, c.description, c.avatar_url, c.owner_id, c.access_type, 
		       c.is_archived, c.member_count, c.created_at, c.updated_at
		FROM channels c
		INNER JOIN channel_members cm ON c.id = cm.channel_id
		WHERE cm.user_id = $1
		ORDER BY c.created_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user channels: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel
	for rows.Next() {
		channel := &models.Channel{}
		err := rows.Scan(
			&channel.ID, &channel.Name, &channel.Description, &channel.AvatarURL,
			&channel.OwnerID, &channel.AccessType, &channel.IsArchived,
			&channel.MemberCount, &channel.CreatedAt, &channel.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel row: %w", err)
		}
		channels = append(channels, channel)
	}

	return channels, nil
}

func (s *ChannelService) DiscoverChannels(userID string) ([]*models.Channel, error) {
	query := `
		SELECT c.id, c.name, c.description, c.avatar_url, c.owner_id, c.access_type, 
		       c.is_archived, c.member_count, c.created_at, c.updated_at
		FROM channels c
		WHERE c.access_type = 'PUBLIC' 
		  AND c.id NOT IN (
		    SELECT channel_id FROM channel_members WHERE user_id = $1
		  )
		  AND c.is_archived = false
		ORDER BY c.member_count DESC
		LIMIT 20
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query discoverable channels: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel
	for rows.Next() {
		channel := &models.Channel{}
		err := rows.Scan(
			&channel.ID, &channel.Name, &channel.Description, &channel.AvatarURL,
			&channel.OwnerID, &channel.AccessType, &channel.IsArchived,
			&channel.MemberCount, &channel.CreatedAt, &channel.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel row: %w", err)
		}
		channels = append(channels, channel)
	}

	return channels, nil
}

func (s *ChannelService) GetChannelDetails(channelID string) (*models.Channel, error) {
	query := `
		SELECT id, name, description, avatar_url, owner_id, access_type, 
		       is_archived, member_count, created_at, updated_at
		FROM channels 
		WHERE id = $1
	`

	channel := &models.Channel{}
	err := s.db.QueryRow(query, channelID).Scan(
		&channel.ID, &channel.Name, &channel.Description, &channel.AvatarURL,
		&channel.OwnerID, &channel.AccessType, &channel.IsArchived,
		&channel.MemberCount, &channel.CreatedAt, &channel.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, fmt.Errorf("failed to query channel: %w", err)
	}

	return channel, nil
}

func (s *ChannelService) UpdateChannel(channelID string, updateData models.UpdateChannelDto) error {
	query := `
		UPDATE channels 
		SET name = COALESCE($1, name),
		    description = COALESCE($2, description),
		    avatar_url = COALESCE($3, avatar_url),
		    access_type = COALESCE($4, access_type),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
	`

	_, err := s.db.Exec(query,
		updateData.Name, updateData.Description, updateData.AvatarURL,
		updateData.AccessType, channelID,
	)

	if err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}

	return nil
}

func (s *ChannelService) DeleteChannel(userID, channelID string) error {
	// Check if user is channel owner
	var ownerID string
	err := s.db.QueryRow("SELECT owner_id FROM channels WHERE id = $1", channelID).Scan(&ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("channel not found")
		}
		return fmt.Errorf("failed to check channel ownership: %w", err)
	}

	if ownerID != userID {
		return fmt.Errorf("only channel owner can delete channel")
	}

	// Delete channel (cascade should handle members, groups, etc.)
	_, err = s.db.Exec("DELETE FROM channels WHERE id = $1", channelID)
	if err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}

	return nil
}

func (s *ChannelService) GetMembers(channelID, requestingUserID string) ([]*models.ChannelMember, error) {
	// Check if requesting user is a member
	var isMember bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)
	`, channelID, requestingUserID).Scan(&isMember)

	if err != nil {
		return nil, fmt.Errorf("failed to check membership: %w", err)
	}

	if !isMember {
		return nil, fmt.Errorf("access denied")
	}

	query := `
		SELECT id, channel_id, user_id, role, joined_at
		FROM channel_members 
		WHERE channel_id = $1
		ORDER BY joined_at ASC
	`

	rows, err := s.db.Query(query, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query channel members: %w", err)
	}
	defer rows.Close()

	var members []*models.ChannelMember
	for rows.Next() {
		member := &models.ChannelMember{}
		err := rows.Scan(
			&member.ID, &member.ChannelID, &member.UserID,
			&member.Role, &member.JoinedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member row: %w", err)
		}
		members = append(members, member)
	}

	return members, nil
}

func (s *ChannelService) AddMember(channelID string, addData models.AddMemberDto) error {
	// Check if user is already a member
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)
	`, channelID, addData.UserID).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if exists {
		return fmt.Errorf("user is already a member")
	}

	// Add member
	_, err = s.db.Exec(`
		INSERT INTO channel_members (id, channel_id, user_id, role, joined_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP)
	`, channelID, addData.UserID, addData.Role)

	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	// Update member count
	_, err = s.db.Exec(`
		UPDATE channels SET member_count = member_count + 1 WHERE id = $1
	`, channelID)

	if err != nil {
		return fmt.Errorf("failed to update member count: %w", err)
	}

	return nil
}

func (s *ChannelService) KickMember(channelID, requestingUserID, targetUserID string) error {
	// Check if requesting user is admin or owner
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2
	`, channelID, requestingUserID).Scan(&role)

	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("access denied")
		}
		return fmt.Errorf("failed to check user role: %w", err)
	}

	if role != "ADMIN" && role != "MODERATOR" {
		return fmt.Errorf("insufficient permissions")
	}

	// Remove member
	_, err = s.db.Exec(`
		DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2
	`, channelID, targetUserID)

	if err != nil {
		return fmt.Errorf("failed to kick member: %w", err)
	}

	// Update member count
	_, err = s.db.Exec(`
		UPDATE channels SET member_count = member_count - 1 WHERE id = $1
	`, channelID)

	if err != nil {
		return fmt.Errorf("failed to update member count: %w", err)
	}

	return nil
}

func (s *ChannelService) JoinChannel(userID, channelID string) error {
	// Check if channel is public
	var accessType string
	err := s.db.QueryRow("SELECT access_type FROM channels WHERE id = $1", channelID).Scan(&accessType)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("channel not found")
		}
		return fmt.Errorf("failed to check channel access type: %w", err)
	}

	if accessType != "PUBLIC" {
		return fmt.Errorf("cannot join private channel directly")
	}

	// Check if already a member
	var exists bool
	err = s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)
	`, channelID, userID).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if exists {
		return fmt.Errorf("already a member")
	}

	// Add member
	_, err = s.db.Exec(`
		INSERT INTO channel_members (id, channel_id, user_id, role, joined_at)
		VALUES (gen_random_uuid(), $1, $2, 'MEMBER', CURRENT_TIMESTAMP)
	`, channelID, userID)

	if err != nil {
		return fmt.Errorf("failed to join channel: %w", err)
	}

	// Update member count
	_, err = s.db.Exec(`
		UPDATE channels SET member_count = member_count + 1 WHERE id = $1
	`, channelID)

	if err != nil {
		return fmt.Errorf("failed to update member count: %w", err)
	}

	return nil
}

func (s *ChannelService) RequestJoinChannel(userID, channelID string) error {
	// Check if channel is private
	var accessType string
	err := s.db.QueryRow("SELECT access_type FROM channels WHERE id = $1", channelID).Scan(&accessType)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("channel not found")
		}
		return fmt.Errorf("failed to check channel access type: %w", err)
	}

	if accessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private channels")
	}

	// Check if already a member
	var exists bool
	err = s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)
	`, channelID, userID).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if exists {
		return fmt.Errorf("already a member")
	}

	// Check if request already exists
	var requestExists bool
	err = s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channel_join_requests WHERE channel_id = $1 AND user_id = $2 AND status = 'PENDING')
	`, channelID, userID).Scan(&requestExists)

	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}

	if requestExists {
		return fmt.Errorf("join request already pending")
	}

	// Create join request
	_, err = s.db.Exec(`
		INSERT INTO channel_join_requests (id, channel_id, user_id, status, message, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'PENDING', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, channelID, userID)

	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}

	return nil
}
