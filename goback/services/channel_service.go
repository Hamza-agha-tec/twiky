package services

import (
	"database/sql"
	"fmt"
	"strings"

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

	_, err = s.db.Exec(`
		INSERT INTO channel_members (channel_id, user_id, role)
		VALUES ($1, $2, 'OWNER')
	`, channel.ID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to add owner to channel_members: %w", err)
	}

	var generalGroupID string
	err = s.db.QueryRow(`
		INSERT INTO groups (channel_id, name, description, is_general, group_type, access_type)
		VALUES ($1, 'general', 'Default group for general discussion', true, 'text', 'PUBLIC')
		RETURNING id
	`, channel.ID).Scan(&generalGroupID)
	if err != nil {
		return nil, fmt.Errorf("failed to create general group: %w", err)
	}

	_, err = s.db.Exec(`
		INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'OWNER')
	`, generalGroupID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to add owner to general group: %w", err)
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

	channels := make([]*models.Channel, 0)

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
	rows, err := s.db.Query(`
		SELECT
			c.id, c.name, c.description, c.avatar_url, c.banner_url, c.owner_id,
			c.access_type, c.type, c.invite_code, c.created_at,
			COUNT(cm2.user_id) AS member_count,
			CASE
				WHEN cm.user_id IS NOT NULL THEN 'member'
				WHEN cjr.id IS NOT NULL THEN 'requested'
				ELSE 'none'
			END AS membership_status
		FROM channels c
		LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $1
		LEFT JOIN channel_join_requests cjr ON cjr.channel_id = c.id AND cjr.user_id = $1 AND cjr.status = 'PENDING'
		LEFT JOIN channel_members cm2 ON cm2.channel_id = c.id
		GROUP BY c.id, c.name, c.description, c.avatar_url, c.banner_url, c.owner_id,
		         c.access_type, c.type, c.invite_code, c.created_at, cm.user_id, cjr.id
		ORDER BY c.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to discover channels: %w", err)
	}
	defer rows.Close()

	result := make([]*models.Channel, 0)
	for rows.Next() {
		ch := &models.Channel{}
		if err := rows.Scan(
			&ch.ID, &ch.Name, &ch.Description, &ch.AvatarURL, &ch.BannerURL, &ch.OwnerID,
			&ch.AccessType, &ch.Type, &ch.InviteCode, &ch.CreatedAt,
			&ch.MemberCount, &ch.MembershipStatus,
		); err != nil {
			return nil, fmt.Errorf("failed to scan channel: %w", err)
		}
		result = append(result, ch)
	}
	return result, nil
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
	setClauses := []string{}
	args := []interface{}{}
	i := 1

	if updateData.Name != "" {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", i))
		args = append(args, updateData.Name)
		i++
	}
	if updateData.Description != "" {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", i))
		args = append(args, updateData.Description)
		i++
	}
	if updateData.AvatarURL != "" {
		setClauses = append(setClauses, fmt.Sprintf("avatar_url = $%d", i))
		args = append(args, updateData.AvatarURL)
		i++
	}
	if updateData.BannerURL != "" {
		setClauses = append(setClauses, fmt.Sprintf("banner_url = $%d", i))
		args = append(args, updateData.BannerURL)
		i++
	}
	if updateData.AccessType != "" {
		setClauses = append(setClauses, fmt.Sprintf("access_type = $%d", i))
		args = append(args, updateData.AccessType)
		i++
	}

	if len(setClauses) == 0 {
		return nil
	}

	args = append(args, channelID)
	query := fmt.Sprintf("UPDATE channels SET %s WHERE id = $%d",
		strings.Join(setClauses, ", "), i)

	_, err := s.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}

	return nil
}

func (s *ChannelService) GetChannelJoinRequests(channelID string) ([]*models.ChannelJoinRequestWithUser, error) {
	rows, err := s.db.Query(`
		SELECT cjr.id, cjr.status, cjr.created_at, u.id, u.username, u.avatar_url
		FROM channel_join_requests cjr
		JOIN users u ON cjr.user_id = u.id
		WHERE cjr.channel_id = $1 AND cjr.status = 'PENDING'
		ORDER BY cjr.created_at ASC
	`, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query join requests: %w", err)
	}
	defer rows.Close()

	result := make([]*models.ChannelJoinRequestWithUser, 0)
	for rows.Next() {
		req := &models.ChannelJoinRequestWithUser{}
		err := rows.Scan(&req.ID, &req.Status, &req.CreatedAt, &req.User.ID, &req.User.Username, &req.User.AvatarURL)
		if err != nil {
			return nil, fmt.Errorf("failed to scan join request: %w", err)
		}
		result = append(result, req)
	}
	return result, nil
}

func (s *ChannelService) RespondToChannelJoinRequest(channelID, requestID, status string) error {
	var userID string
	err := s.db.QueryRow(`
		SELECT user_id FROM channel_join_requests WHERE id = $1 AND channel_id = $2 AND status = 'PENDING'
	`, requestID, channelID).Scan(&userID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("join request not found")
	}
	if err != nil {
		return fmt.Errorf("failed to fetch join request: %w", err)
	}

	_, err = s.db.Exec(`
		UPDATE channel_join_requests SET status = $1, updated_at = NOW() WHERE id = $2
	`, status, requestID)
	if err != nil {
		return fmt.Errorf("failed to update join request: %w", err)
	}

	if status == "ACCEPTED" {
		var count int
		_ = s.db.QueryRow(`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID).Scan(&count)
		if count == 0 {
			_, err = s.db.Exec(`
				INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'MEMBER')
			`, channelID, userID)
		}
		if err != nil {
			return fmt.Errorf("failed to add member: %w", err)
		}
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
	rows, err := s.db.Query(`
		SELECT cm.role, cm.joined_at,
		       u.id, u.username, u.avatar_url, u.bio, u.banner, u.sub_plan, u.is_verified
		FROM channel_members cm
		JOIN users u ON u.id = cm.user_id
		WHERE cm.channel_id = $1
		ORDER BY cm.joined_at ASC
	`, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query members: %w", err)
	}
	defer rows.Close()

	result := make([]*models.ChannelMemberResponse, 0)
	isMember := false
	for rows.Next() {
		var m models.ChannelMemberResponse
		var u models.ChannelMemberUser
		var isVerified bool
		var subPlan *string
		err := rows.Scan(
			&m.Role, &m.JoinedAt,
			&u.ID, &u.Username, &u.AvatarURL, &u.Bio, &u.Banner, &subPlan, &isVerified,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}
		if subPlan != nil {
			u.SubPlan = *subPlan
		}
		u.IsVerified = &isVerified
		m.User = u
		if u.ID == requestingUserID {
			isMember = true
		}
		result = append(result, &m)
	}

	if !isMember {
		return nil, fmt.Errorf("access denied")
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
	var accessType string
	err := s.db.QueryRow(`SELECT access_type FROM channels WHERE id = $1`, channelID).Scan(&accessType)
	if err == sql.ErrNoRows {
		return fmt.Errorf("channel not found")
	}
	if err != nil {
		return fmt.Errorf("failed to check channel: %w", err)
	}

	if accessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private channels")
	}

	var memberCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID).Scan(&memberCount)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if memberCount > 0 {
		return fmt.Errorf("already a member")
	}

	var pendingCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM channel_join_requests WHERE channel_id = $1 AND user_id = $2 AND status = 'PENDING'`, channelID, userID).Scan(&pendingCount)
	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}
	if pendingCount > 0 {
		return fmt.Errorf("join request already pending")
	}

	_, err = s.db.Exec(`INSERT INTO channel_join_requests (channel_id, user_id, status) VALUES ($1, $2, 'PENDING')`, channelID, userID)

	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}

	return nil
}
