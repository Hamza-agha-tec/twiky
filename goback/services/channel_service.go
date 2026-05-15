package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type ChannelService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewChannelService(db *sql.DB, supabaseURL, supabaseKey string) *ChannelService {
	return &ChannelService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *ChannelService) CreateChannel(userID string, createData models.CreateChannelDto) (*models.Channel, error) {
	channel := &models.Channel{}

	err := s.db.QueryRow(`
		INSERT INTO channels ( name, description, avatar_url, banner_url, owner_id, access_type, type, invite_code )
		VALUES ($1, $2, $3, $4, $5, $6, $7, gen_random_uuid())
		RETURNING id, name, description, avatar_url, banner_url, owner_id, access_type, type, invite_code, created_at
	`,
		createData.Name, createData.Description, createData.AvatarURL, createData.BannerURL,
		userID, createData.AccessType, createData.Type,
	).Scan(
		&channel.ID, &channel.Name, &channel.Description, &channel.AvatarURL, &channel.BannerURL,
		&channel.OwnerID, &channel.AccessType, &channel.Type, &channel.InviteCode, &channel.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create channel: %w", err)
	}

	var generalGroupID string

	err = s.db.QueryRow(`
		SELECT id
		FROM groups
		WHERE channel_id = $1
		AND name = '#general'
		LIMIT 1
	`, channel.ID).Scan(&generalGroupID)

	if err == nil {
		_, err = s.db.Exec(`
			INSERT INTO group_members (group_id, user_id, role)
			VALUES ($1, $2, 'OWNER')
		`, generalGroupID, userID)

		if err != nil {
			return nil, fmt.Errorf("failed to add owner to general group: %w", err)
		}

		// notifyMemberJoined equivalent here
	}

	return channel, nil
}

func (s *ChannelService) GetUserChannels(userID string) ([]*models.Channel, error) {
	query := `
		SELECT 
			c.id,
			c.name,
			c.description,
			c.avatar_url,
			c.banner_url,
			c.owner_id,
			c.access_type,
			c.type,
			c.invite_code,
			c.created_at,
			cm.role
		FROM channels c
		INNER JOIN channel_members cm ON c.id = cm.channel_id
		WHERE cm.user_id = $1
		ORDER BY c.created_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel

	for rows.Next() {
		ch := &models.Channel{}
		var role string

		err := rows.Scan(
			&ch.ID,
			&ch.Name,
			&ch.Description,
			&ch.AvatarURL,
			&ch.BannerURL,
			&ch.OwnerID,
			&ch.AccessType,
			&ch.Type,
			&ch.InviteCode,
			&ch.CreatedAt,
			&role,
		)

		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}

		ch.Role = role
		channels = append(channels, ch)
	}

	return channels, nil
}

func (s *ChannelService) DiscoverChannels(userID string) ([]*models.Channel, error) {
	// Get channels user is member of
	var members []models.ChannelMember
	err := s.supabase.GetClient().DB.From("channel_members").
		Select("channel_id").
		Eq("user_id", userID).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to get user channel memberships: %w", err)
	}

	// Extract channel IDs
	var channelIDs []string
	for _, member := range members {
		channelIDs = append(channelIDs, member.ChannelID)
	}

	// Get public channels not already joined
	var channels []models.Channel
	err = s.supabase.GetClient().DB.From("channels").
		Select("*").
		Eq("access_type", "PUBLIC").
		Execute(&channels)

	if err != nil {
		return nil, fmt.Errorf("failed to query discoverable channels: %w", err)
	}

	// Filter out channels user is already a member of
	var filteredChannels []*models.Channel
	for _, channel := range channels {
		isMember := false
		for _, memberChannelID := range channelIDs {
			if channel.ID == memberChannelID {
				isMember = true
				break
			}
		}
		if !isMember {
			filteredChannels = append(filteredChannels, &channel)
		}
	}

	return filteredChannels, nil
}

func (s *ChannelService) GetChannelDetails(channelID string) (*models.Channel, error) {
	query := `
		SELECT id, name, description, avatar_url, owner_id, access_type, created_at
		FROM channels 
		WHERE id = $1
	`

	channel := &models.Channel{}
	err := s.db.QueryRow(query, channelID).Scan(
		&channel.ID, &channel.Name, &channel.Description, &channel.AvatarURL, &channel.OwnerID,
		&channel.AccessType, &channel.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to query channel: %w", err)
	}

	return channel, nil
}

func (s *ChannelService) UpdateChannel(channelID string, updateData models.UpdateChannelDto) error {
	// Build update map with only non-empty fields
	updateFields := make(map[string]interface{})
	if updateData.Name != "" {
		updateFields["name"] = updateData.Name
	}
	if updateData.Description != "" {
		updateFields["description"] = updateData.Description
	}
	if updateData.AvatarURL != "" {
		updateFields["avatar_url"] = updateData.AvatarURL
	}
	if updateData.AccessType != "" {
		updateFields["access_type"] = updateData.AccessType
	}

	var updatedChannels []models.Channel
	err := s.supabase.GetClient().DB.From("channels").
		Update(updateFields).
		Eq("id", channelID).
		Execute(&updatedChannels)

	if err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}

	return nil
}

func (s *ChannelService) DeleteChannel(userID, channelID string) error {
	// Check if user is channel owner
	var channels []models.Channel
	err := s.supabase.GetClient().DB.From("channels").
		Select("owner_id").
		Eq("id", channelID).
		Execute(&channels)

	if err != nil {
		return fmt.Errorf("failed to check channel ownership: %w", err)
	}

	if len(channels) == 0 {
		return fmt.Errorf("channel not found")
	}

	if channels[0].OwnerID != userID {
		return fmt.Errorf("only channel owner can delete channel")
	}

	// Delete channel (cascade should handle members, etc.)
	err = s.supabase.GetClient().DB.From("channels").
		Delete().
		Eq("id", channelID).
		Execute(nil)

	if err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}

	return nil
}

func (s *ChannelService) GetMembers(channelID, requestingUserID string) ([]*models.ChannelMemberResponse, error) {
	// Check if requesting user is a member
	var members []models.ChannelMember
	err := s.supabase.GetClient().DB.From("channel_members").
		Select("*").
		Eq("channel_id", channelID).
		Eq("user_id", requestingUserID).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to check channel membership (channelID=%s, userID=%s): %w", channelID, requestingUserID, err)
	}

	if len(members) == 0 {
		return nil, fmt.Errorf("access denied: user is not a member of this channel")
	}

	// Get all members
	var allMembers []models.ChannelMember
	err = s.supabase.GetClient().DB.From("channel_members").
		Select("*").
		Eq("channel_id", channelID).
		Execute(&allMembers)

	if err != nil {
		return nil, fmt.Errorf("failed to query channel members (channelID=%s): %w", channelID, err)
	}

	// Build response with user details
	var result []*models.ChannelMemberResponse
	for _, member := range allMembers {
		// Get user details
		var userSlice []models.User
		err := s.supabase.GetClient().DB.From("users").
			Select("*").
			Eq("id", member.UserID).
			Execute(&userSlice)

		if err != nil {
			return nil, fmt.Errorf("failed to get user details (userID=%s): %w", member.UserID, err)
		}

		if len(userSlice) == 0 {
			return nil, fmt.Errorf("user not found (userID=%s)", member.UserID)
		}

		// Map user to simplified struct
		user := models.ChannelMemberUser{
			ID:         userSlice[0].ID,
			Bio:        userSlice[0].Bio,
			Banner:     userSlice[0].Banner,
			SubPlan:    userSlice[0].SubPlan,
			Username:   userSlice[0].Username,
			AvatarURL:  userSlice[0].AvatarURL,
			IsVerified: &userSlice[0].IsVerified,
		}

		// Build member response
		memberResponse := &models.ChannelMemberResponse{
			Role:     member.Role,
			JoinedAt: member.JoinedAt,
			User:     user,
		}
		result = append(result, memberResponse)
	}

	return result, nil
}

func (s *ChannelService) AddMember(channelID string, addData models.AddMemberDto) error {
	// Check if user is already a member
	var existingMembers []models.ChannelMember
	err := s.supabase.GetClient().DB.From("channel_members").
		Select("user_id").
		Eq("channel_id", channelID).
		Eq("user_id", addData.UserID).
		Execute(&existingMembers)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if len(existingMembers) > 0 {
		return fmt.Errorf("user is already a member")
	}

	// Add member
	var newMembers []models.ChannelMember
	err = s.supabase.GetClient().DB.From("channel_members").
		Insert(map[string]interface{}{
			"channel_id": channelID,
			"user_id":    addData.UserID,
			"role":       addData.Role,
		}).
		Execute(&newMembers)

	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	return nil
}

func (s *ChannelService) KickMember(channelID, requestingUserID, targetUserID string) error {
	// Check if requesting user is admin or moderator
	var members []models.ChannelMember
	err := s.supabase.GetClient().DB.From("channel_members").
		Select("role").
		Eq("channel_id", channelID).
		Eq("user_id", requestingUserID).
		Execute(&members)

	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	if len(members) == 0 {
		return fmt.Errorf("access denied")
	}

	role := members[0].Role
	if role != "ADMIN" && role != "MODERATOR" {
		return fmt.Errorf("insufficient permissions")
	}

	// Remove member
	err = s.supabase.GetClient().DB.From("channel_members").
		Delete().
		Eq("channel_id", channelID).
		Eq("user_id", targetUserID).
		Execute(nil)

	if err != nil {
		return fmt.Errorf("failed to kick member: %w", err)
	}

	return nil
}

func (s *ChannelService) JoinChannel(userID, channelID string) error {
	// Check if channel is public
	var channels []models.Channel
	err := s.supabase.GetClient().DB.From("channels").
		Select("access_type").
		Eq("id", channelID).
		Execute(&channels)

	if err != nil {
		return fmt.Errorf("failed to check channel access type: %w", err)
	}

	if len(channels) == 0 {
		return fmt.Errorf("channel not found")
	}

	if channels[0].AccessType != "PUBLIC" {
		return fmt.Errorf("cannot join private channel directly")
	}

	// Check if already a member
	var existingMembers []models.ChannelMember
	err = s.supabase.GetClient().DB.From("channel_members").
		Select("user_id").
		Eq("channel_id", channelID).
		Eq("user_id", userID).
		Execute(&existingMembers)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if len(existingMembers) > 0 {
		return fmt.Errorf("already a member")
	}

	// Add member
	var newMembers []models.ChannelMember
	err = s.supabase.GetClient().DB.From("channel_members").
		Insert(map[string]interface{}{
			"channel_id": channelID,
			"user_id":    userID,
			"role":       "MEMBER",
		}).
		Execute(&newMembers)

	if err != nil {
		return fmt.Errorf("failed to join channel: %w", err)
	}

	return nil
}

func (s *ChannelService) RequestJoinChannel(userID, channelID string) error {
	// Check if channel is private
	var channels []models.Channel
	err := s.supabase.GetClient().DB.From("channels").
		Select("access_type").
		Eq("id", channelID).
		Execute(&channels)

	if err != nil {
		return fmt.Errorf("failed to check channel access type: %w", err)
	}

	if len(channels) == 0 {
		return fmt.Errorf("channel not found")
	}

	if channels[0].AccessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private channels")
	}

	// Check if already a member
	var existingMembers []models.ChannelMember
	err = s.supabase.GetClient().DB.From("channel_members").
		Select("user_id").
		Eq("channel_id", channelID).
		Eq("user_id", userID).
		Execute(&existingMembers)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if len(existingMembers) > 0 {
		return fmt.Errorf("already a member")
	}

	// Check if request already exists
	var existingRequests []models.ChannelJoinRequest
	err = s.supabase.GetClient().DB.From("channel_join_requests").
		Select("id").
		Eq("channel_id", channelID).
		Eq("user_id", userID).
		Eq("status", "PENDING").
		Execute(&existingRequests)

	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}

	if len(existingRequests) > 0 {
		return fmt.Errorf("join request already exists")
	}

	// Create join request
	var requests []models.ChannelJoinRequest
	err = s.supabase.GetClient().DB.From("channel_join_requests").
		Insert(map[string]interface{}{
			"channel_id": channelID,
			"user_id":    userID,
			"status":     "PENDING",
		}).
		Execute(&requests)

	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}

	return nil
}
