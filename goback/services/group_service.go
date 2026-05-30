package services

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

func buildEventShareLink(channelID, groupID, eventID string) string {
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "http://localhost:3000"
	}
	return fmt.Sprintf(
		"%s/channels/%s/group/%s?event=%s",
		strings.TrimRight(base, "/"),
		channelID,
		groupID,
		eventID,
	)
}

type GroupService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewGroupService(db *sql.DB, supabaseURL, supabaseKey string) *GroupService {
	return &GroupService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

// getChannelRoleForGroup returns the user's role in the channel that owns this group.
// Returns "" if the user is not a channel member or the group doesn't exist.
func (s *GroupService) getChannelRoleForGroup(groupID, userID string) (string, error) {
	var groups []models.Group
	err := s.supabase.GetClient().DB.From("groups").
		Select("channel_id").
		Eq("id", groupID).
		Execute(&groups)
	if err != nil || len(groups) == 0 {
		return "", nil
	}
	var channelMembers []models.ChannelMember
	err = s.supabase.GetClient().DB.From("channel_members").
		Select("role").
		Eq("channel_id", groups[0].ChannelID).
		Eq("user_id", userID).
		Execute(&channelMembers)
	if err != nil || len(channelMembers) == 0 {
		return "", nil
	}
	return channelMembers[0].Role, nil
}

func (s *GroupService) CreateGroupInProject(channelID, projectID, userID string, createData models.CreateGroupDto) (*models.Group, error) {
	var channelType string
	_ = s.db.QueryRow(`SELECT type FROM channels WHERE id = $1`, channelID).Scan(&channelType)
	if channelType != "WORKSPACE" {
		return nil, fmt.Errorf("use channel groups endpoint for normal channels")
	}

	projectSvc := NewProjectService(s.db)
	if _, err := projectSvc.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	var groups []models.Group
	err := s.supabase.GetClient().DB.From("groups").
		Insert(map[string]interface{}{
			"channel_id":  channelID,
			"project_id":  projectID,
			"name":        createData.Name,
			"description": createData.Description,
			"group_type":  createData.GroupType,
			"access_type": createData.AccessType,
		}).
		Execute(&groups)

	if err != nil {
		return nil, fmt.Errorf("failed to create group: %w", err)
	}
	if len(groups) == 0 {
		return nil, fmt.Errorf("failed to create group: no data returned")
	}

	var members []interface{}
	err = s.supabase.GetClient().DB.From("group_members").
		Insert(map[string]interface{}{
			"group_id": groups[0].ID,
			"user_id":  userID,
			"role":     "OWNER",
		}).
		Execute(&members)
	if err != nil {
		return nil, fmt.Errorf("failed to add owner as group member: %w", err)
	}
	return &groups[0], nil
}

func (s *GroupService) CreateGroup(channelID, userID string, createData models.CreateGroupDto) (*models.Group, error) {
	var channelType string
	_ = s.db.QueryRow(`SELECT type FROM channels WHERE id = $1`, channelID).Scan(&channelType)
	if channelType == "WORKSPACE" {
		return nil, fmt.Errorf("create groups inside a project for workspace channels")
	}

	var groups []models.Group
	err := s.supabase.GetClient().DB.From("groups").
		Insert(map[string]interface{}{
			"channel_id":  channelID,
			"name":        createData.Name,
			"description": createData.Description,
			"group_type":  createData.GroupType,
			"access_type": createData.AccessType,
		}).
		Execute(&groups)

	if err != nil {
		return nil, fmt.Errorf("failed to create group: %w", err)
	}

	if len(groups) == 0 {
		return nil, fmt.Errorf("failed to create group: no data returned")
	}

	// Add creator as owner
	var members []interface{}
	err = s.supabase.GetClient().DB.From("group_members").
		Insert(map[string]interface{}{
			"group_id": groups[0].ID,
			"user_id":  userID,
			"role":     "OWNER",
		}).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to add owner as group member: %w", err)
	}

	return &groups[0], nil
}

func (s *GroupService) GetGroupsInChannel(channelID, requestingUserID string) ([]*models.Group, error) {
	var channelCount int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, requestingUserID).Scan(&channelCount)
	if err != nil || channelCount == 0 {
		return nil, fmt.Errorf("access denied")
	}

	rows, err := s.db.Query(`
		SELECT g.id, g.channel_id, g.name, g.description, g.is_general, g.created_at, g.group_type, g.access_type,
		       CASE
		           WHEN g.access_type = 'PUBLIC' THEN true
		           WHEN gm.user_id IS NOT NULL THEN true
		           ELSE false
		       END AS is_member
		FROM groups g
		LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2
		WHERE g.channel_id = $1 AND g.project_id IS NULL
		ORDER BY g.created_at ASC
	`, channelID, requestingUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to query groups: %w", err)
	}
	defer rows.Close()

	result := make([]*models.Group, 0)
	for rows.Next() {
		g := &models.Group{}
		err := rows.Scan(&g.ID, &g.ChannelID, &g.Name, &g.Description, &g.IsGeneral, &g.CreatedAt, &g.GroupType, &g.AccessType, &g.IsMember)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group: %w", err)
		}
		result = append(result, g)
	}
	return result, nil
}

func (s *GroupService) GetGroupMembers(groupID, requestingUserID string) ([]*models.GroupMemberResponse, error) {
	// Fetch all channel members for the channel that owns this group
	rows, err := s.db.Query(`
		SELECT cm.role, cm.joined_at,
		       u.id, u.username, u.avatar_url, u.banner, u.bio, u.sub_plan, u.is_verified, u.fullname
		FROM channel_members cm
		JOIN groups g ON g.channel_id = cm.channel_id
		JOIN users u ON u.id = cm.user_id
		WHERE g.id = $1
		ORDER BY cm.joined_at ASC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query members: %w", err)
	}
	defer rows.Close()

	result := make([]*models.GroupMemberResponse, 0)
	isMember := false
	for rows.Next() {
		var role string
		var joinedAt time.Time
		var subPlan *string
		var isVerified bool
		var u models.GroupMemberUser
		var username, fullname, avatarURL, banner, bio *string

		err := rows.Scan(&role, &joinedAt, &u.ID, &username, &avatarURL, &banner, &bio, &subPlan, &isVerified, &fullname)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}
		u.Username = derefStr(username)
		u.Fullname = derefStr(fullname)
		u.AvatarURL = avatarURL
		u.Banner = banner
		u.Bio = bio
		u.IsVerified = &isVerified
		if subPlan != nil {
			u.SubPlan = *subPlan
		}
		if u.ID == requestingUserID {
			isMember = true
		}
		result = append(result, &models.GroupMemberResponse{
			Role:     role,
			JoinedAt: joinedAt,
			User:     u,
		})
	}

	if !isMember {
		return nil, fmt.Errorf("access denied")
	}

	return result, nil
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *GroupService) UpdateGroup(groupID, userID string, updateData models.UpdateGroupDto) error {
	// Check if user is admin or owner
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("role").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&members)

	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	role := ""
	if len(members) > 0 {
		role = members[0].Role
	}
	if role != "OWNER" && role != "ADMIN" && role != "MODERATOR" {
		channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
		if channelRole == "OWNER" || channelRole == "ADMIN" {
			role = channelRole
		} else if role == "" {
			return fmt.Errorf("access denied")
		} else {
			return fmt.Errorf("insufficient permissions")
		}
	}

	// Build update map with only non-empty fields
	updateFields := make(map[string]interface{})
	if updateData.Name != "" {
		updateFields["name"] = updateData.Name
	}
	if updateData.Description != "" {
		updateFields["description"] = updateData.Description
	}
	if updateData.GroupType != "" {
		updateFields["group_type"] = updateData.GroupType
	}
	if updateData.AccessType != "" {
		updateFields["access_type"] = updateData.AccessType
	}
	updateFields["updated_at"] = "now()"

	var updatedGroups []models.Group
	err = s.supabase.GetClient().DB.From("groups").
		Update(updateFields).
		Filter("id", "eq", groupID).
		Execute(&updatedGroups)

	if err != nil {
		return fmt.Errorf("failed to update group: %w", err)
	}

	return nil
}

func (s *GroupService) DeleteGroup(groupID, userID string) error {
	// Only ADMIN members can delete the group
	var membership []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("role").
		Eq("group_id", groupID).
		Eq("user_id", userID).
		Execute(&membership)

	if err != nil {
		return fmt.Errorf("failed to check group ownership: %w", err)
	}

	memberRole := ""
	if len(membership) > 0 {
		memberRole = membership[0].Role
	}
	if memberRole != "OWNER" && memberRole != "ADMIN" {
		channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
		if channelRole != "OWNER" && channelRole != "ADMIN" {
			if len(membership) == 0 {
				return fmt.Errorf("group not found")
			}
			return fmt.Errorf("only group owner can delete group")
		}
	}

	// Delete group (cascade should handle members)
	err = s.supabase.GetClient().DB.From("groups").
		Delete().
		Filter("id", "eq", groupID).
		Execute(nil)

	if err != nil {
		return fmt.Errorf("failed to delete group: %w", err)
	}

	return nil
}

func (s *GroupService) AddMemberToGroup(groupID, userID string, addData models.AddGroupMemberDto) error {
	// Check if requesting user is admin or moderator
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("role").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&members)

	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	role := ""
	if len(members) > 0 {
		role = members[0].Role
	}
	if role != "OWNER" && role != "ADMIN" && role != "MODERATOR" {
		channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
		if channelRole == "OWNER" || channelRole == "ADMIN" {
			role = channelRole
		} else if role == "" {
			return fmt.Errorf("access denied")
		} else {
			return fmt.Errorf("insufficient permissions")
		}
	}

	// Check if user is already a member
	var existingMembers []models.GroupMember
	err = s.supabase.GetClient().DB.From("group_members").
		Select("user_id").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", addData.UserID).
		Execute(&existingMembers)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if len(existingMembers) > 0 {
		return fmt.Errorf("user is already a member")
	}

	// Add member
	var newMembers []models.GroupMember
	err = s.supabase.GetClient().DB.From("group_members").
		Insert(map[string]interface{}{
			"group_id":  groupID,
			"user_id":   addData.UserID,
			"role":      addData.Role,
			"joined_at": "now()",
		}).
		Execute(&newMembers)

	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	return nil
}

func (s *GroupService) UpdateGroupMemberRole(groupID, userID string, updateData models.AddGroupMemberDto) error {
	// Check if requesting user is admin
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("role").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&members)

	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	role := ""
	if len(members) > 0 {
		role = members[0].Role
	}
	if role != "OWNER" && role != "ADMIN" {
		channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
		if channelRole == "OWNER" || channelRole == "ADMIN" {
			role = channelRole
		} else if role == "" {
			return fmt.Errorf("access denied")
		} else {
			return fmt.Errorf("only admins can update member roles")
		}
	}

	// Update member role
	var updatedMembers []models.GroupMember
	err = s.supabase.GetClient().DB.From("group_members").
		Update(map[string]interface{}{"role": updateData.Role}).
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", updateData.UserID).
		Execute(&updatedMembers)

	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}

	return nil
}

func (s *GroupService) DeleteGroupMember(groupID, userID, memberID string) error {
	// Check if requesting user is admin or moderator
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("role").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&members)

	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	role := ""
	if len(members) > 0 {
		role = members[0].Role
	}
	if role != "OWNER" && role != "ADMIN" && role != "MODERATOR" {
		channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
		if channelRole == "OWNER" || channelRole == "ADMIN" {
			role = channelRole
		} else if role == "" {
			return fmt.Errorf("access denied")
		} else {
			return fmt.Errorf("insufficient permissions")
		}
	}

	// Remove member
	err = s.supabase.GetClient().DB.From("group_members").
		Delete().
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", memberID).
		Execute(nil)

	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	return nil
}

func (s *GroupService) RequestJoinGroup(groupID, userID string) error {
	var accessType, channelID string
	err := s.db.QueryRow(`SELECT access_type, channel_id FROM groups WHERE id = $1`, groupID).Scan(&accessType, &channelID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("group not found")
	}
	if err != nil {
		return fmt.Errorf("failed to check group: %w", err)
	}

	if accessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private groups")
	}

	var channelCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID).Scan(&channelCount)
	if err != nil || channelCount == 0 {
		return fmt.Errorf("must be a channel member to request joining")
	}

	var pending int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM group_join_requests WHERE group_id = $1 AND user_id = $2 AND status = 'PENDING'`, groupID, userID).Scan(&pending)
	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}
	if pending > 0 {
		return fmt.Errorf("join request already exists")
	}

	_, err = s.db.Exec(`INSERT INTO group_join_requests (group_id, user_id, status) VALUES ($1, $2, 'PENDING')`, groupID, userID)

	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}

	return nil
}

func (s *GroupService) GetJoinRequests(groupID, userID string) ([]*models.GroupJoinRequest, error) {
	// Only channel owners/admins can see join requests
	channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
	if channelRole != "OWNER" && channelRole != "ADMIN" {
		return nil, fmt.Errorf("access denied")
	}

	rows, err := s.db.Query(`
		SELECT gjr.id, gjr.status, gjr.created_at, u.id, u.username, u.avatar_url
		FROM group_join_requests gjr
		JOIN users u ON u.id = gjr.user_id
		WHERE gjr.group_id = $1 AND gjr.status = 'PENDING'
		ORDER BY gjr.created_at ASC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query join requests: %w", err)
	}
	defer rows.Close()

	result := make([]*models.GroupJoinRequest, 0)
	for rows.Next() {
		req := &models.GroupJoinRequest{}
		user := &models.JoinRequestUser{}
		err := rows.Scan(&req.ID, &req.Status, &req.CreatedAt, &user.ID, &user.Username, &user.AvatarURL)
		if err != nil {
			return nil, fmt.Errorf("failed to scan join request: %w", err)
		}
		req.User = user
		result = append(result, req)
	}
	return result, nil
}

func (s *GroupService) RespondToJoinRequest(groupID, requestID, status, userID string) error {
	channelRole, _ := s.getChannelRoleForGroup(groupID, userID)
	if channelRole != "OWNER" && channelRole != "ADMIN" {
		return fmt.Errorf("access denied")
	}

	var requestingUserID string
	err := s.db.QueryRow(`
		SELECT user_id FROM group_join_requests WHERE id = $1 AND group_id = $2 AND status = 'PENDING'
	`, requestID, groupID).Scan(&requestingUserID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("join request not found")
	}
	if err != nil {
		return fmt.Errorf("failed to get join request: %w", err)
	}

	_, err = s.db.Exec(`UPDATE group_join_requests SET status = $1 WHERE id = $2`, status, requestID)
	if err != nil {
		return fmt.Errorf("failed to update join request: %w", err)
	}

	if status == "ACCEPTED" {
		var count int
		_ = s.db.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, requestingUserID).Scan(&count)
		if count == 0 {
			_, err = s.db.Exec(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'MEMBER')`, groupID, requestingUserID)
			if err != nil {
				return fmt.Errorf("failed to add member: %w", err)
			}
		}
	}

	return nil
}

func (s *GroupService) GetGroupEvents(groupID, requestingUserID string) ([]*models.VoiceEvent, error) {
	// Enforce security: check if user is channel member
	var channelID string
	err := s.db.QueryRow(`SELECT channel_id FROM groups WHERE id = $1`, groupID).Scan(&channelID)
	if err != nil {
		return nil, fmt.Errorf("group not found")
	}

	var channelCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, requestingUserID).Scan(&channelCount)
	if err != nil || channelCount == 0 {
		return nil, fmt.Errorf("access denied")
	}

	rows, err := s.db.Query(`
		SELECT id, group_id, COALESCE(channel_id, $2), title, description, scheduled_start, scheduled_end, started_at, started_by, creator_id, created_at
		FROM voice_events
		WHERE group_id = $1
		ORDER BY scheduled_start ASC
	`, groupID, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	result := make([]*models.VoiceEvent, 0)
	for rows.Next() {
		ev := &models.VoiceEvent{}
		var desc sql.NullString
		var sEnd, startedAt sql.NullTime
		var startedBy sql.NullString
		err := rows.Scan(
			&ev.ID, &ev.GroupID, &ev.ChannelID, &ev.Title, &desc,
			&ev.ScheduledStart, &sEnd, &startedAt, &startedBy,
			&ev.CreatorID, &ev.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}
		applyVoiceEventNulls(ev, desc, sEnd, startedAt, startedBy)
		result = append(result, ev)
	}
	return result, nil
}

func (s *GroupService) GetGroupChannelID(groupID string) (string, error) {
	var channelID string
	err := s.db.QueryRow(`SELECT channel_id FROM groups WHERE id = $1`, groupID).Scan(&channelID)
	return channelID, err
}

func (s *GroupService) isChannelMember(channelID, userID string) error {
	var channelCount int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID).Scan(&channelCount)
	if err != nil || channelCount == 0 {
		return fmt.Errorf("access denied")
	}
	return nil
}

func (s *GroupService) isChannelAdmin(channelID, userID string) bool {
	var role string
	err := s.db.QueryRow(`SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID).Scan(&role)
	return err == nil && (role == "OWNER" || role == "ADMIN")
}

func applyVoiceEventNulls(
	ev *models.VoiceEvent,
	desc sql.NullString,
	sEnd sql.NullTime,
	startedAt sql.NullTime,
	startedBy sql.NullString,
) {
	if desc.Valid {
		ev.Description = &desc.String
	}
	if sEnd.Valid {
		ev.ScheduledEnd = &sEnd.Time
	}
	if startedAt.Valid {
		ev.StartedAt = &startedAt.Time
	}
	if startedBy.Valid {
		ev.StartedBy = &startedBy.String
	}
	if ev.ChannelID != "" {
		ev.ShareLink = buildEventShareLink(ev.ChannelID, ev.GroupID, ev.ID)
	}
}

func (s *GroupService) GetChannelEvents(channelID, requestingUserID string) ([]*models.VoiceEvent, error) {
	if err := s.isChannelMember(channelID, requestingUserID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT ve.id, ve.group_id, g.name, COALESCE(ve.channel_id, g.channel_id), ve.title, ve.description,
			ve.scheduled_start, ve.scheduled_end, ve.started_at, ve.started_by, ve.creator_id, ve.created_at
		FROM voice_events ve
		INNER JOIN groups g ON g.id = ve.group_id
		WHERE g.channel_id = $1 AND g.group_type = 'voice'
		ORDER BY ve.scheduled_start ASC
	`, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	result := make([]*models.VoiceEvent, 0)
	for rows.Next() {
		ev := &models.VoiceEvent{}
		var groupName string
		var desc sql.NullString
		var sEnd, startedAt sql.NullTime
		var startedBy sql.NullString
		err := rows.Scan(
			&ev.ID, &ev.GroupID, &groupName, &ev.ChannelID, &ev.Title, &desc,
			&ev.ScheduledStart, &sEnd, &startedAt, &startedBy,
			&ev.CreatorID, &ev.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}
		ev.GroupName = &groupName
		applyVoiceEventNulls(ev, desc, sEnd, startedAt, startedBy)
		result = append(result, ev)
	}
	return result, nil
}

func (s *GroupService) CreateChannelEvent(channelID, creatorID string, dto models.CreateChannelEventDto) (*models.VoiceEvent, error) {
	if err := s.isChannelMember(channelID, creatorID); err != nil {
		return nil, err
	}

	var groupChannelID, groupType string
	err := s.db.QueryRow(`SELECT channel_id, group_type FROM groups WHERE id = $1`, dto.GroupID).Scan(&groupChannelID, &groupType)
	if err != nil {
		return nil, fmt.Errorf("voice room not found")
	}
	if groupChannelID != channelID {
		return nil, fmt.Errorf("voice room does not belong to this channel")
	}
	if groupType != "voice" {
		return nil, fmt.Errorf("events can only be scheduled in voice rooms")
	}

	return s.CreateGroupEvent(dto.GroupID, creatorID, models.CreateVoiceEventDto{
		Title:          dto.Title,
		Description:    dto.Description,
		ScheduledStart: dto.ScheduledStart,
		ScheduledEnd:   dto.ScheduledEnd,
	})
}

func (s *GroupService) CreateGroupEvent(groupID, creatorID string, dto models.CreateVoiceEventDto) (*models.VoiceEvent, error) {
	var channelID string
	var groupType string
	err := s.db.QueryRow(`SELECT channel_id, group_type FROM groups WHERE id = $1`, groupID).Scan(&channelID, &groupType)
	if err != nil {
		return nil, fmt.Errorf("group not found")
	}
	if groupType != "voice" {
		return nil, fmt.Errorf("events can only be scheduled in voice rooms")
	}
	if err := s.isChannelMember(channelID, creatorID); err != nil {
		return nil, err
	}

	var ev models.VoiceEvent
	var desc sql.NullString
	if dto.Description != "" {
		desc = sql.NullString{String: dto.Description, Valid: true}
	}
	var sEnd sql.NullTime
	if dto.ScheduledEnd != nil {
		sEnd = sql.NullTime{Time: *dto.ScheduledEnd, Valid: true}
	}

	var startedAt sql.NullTime
	var startedBy sql.NullString

	err = s.db.QueryRow(`
		INSERT INTO voice_events (group_id, channel_id, title, description, scheduled_start, scheduled_end, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, group_id, channel_id, title, description, scheduled_start, scheduled_end, started_at, started_by, creator_id, created_at
	`, groupID, channelID, dto.Title, desc, dto.ScheduledStart, sEnd, creatorID).Scan(
		&ev.ID, &ev.GroupID, &ev.ChannelID, &ev.Title, &desc,
		&ev.ScheduledStart, &sEnd, &startedAt, &startedBy,
		&ev.CreatorID, &ev.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create event: %w", err)
	}

	applyVoiceEventNulls(&ev, desc, sEnd, startedAt, startedBy)

	return &ev, nil
}

func (s *GroupService) StartGroupEvent(groupID, eventID, userID string) (*models.VoiceEvent, error) {
	var channelID string
	err := s.db.QueryRow(`SELECT channel_id FROM groups WHERE id = $1`, groupID).Scan(&channelID)
	if err != nil {
		return nil, fmt.Errorf("group not found")
	}
	if !s.isChannelAdmin(channelID, userID) {
		return nil, fmt.Errorf("only channel owners and admins can start events")
	}

	var ev models.VoiceEvent
	var desc sql.NullString
	var sEnd, startedAt sql.NullTime
	var startedBy sql.NullString

	err = s.db.QueryRow(`
		UPDATE voice_events
		SET
			started_at = COALESCE(started_at, NOW()),
			started_by = COALESCE(started_by, $3::uuid),
			channel_id = COALESCE(channel_id, $4::uuid)
		WHERE id = $1 AND group_id = $2
		RETURNING id, group_id, channel_id, title, description, scheduled_start, scheduled_end, started_at, started_by, creator_id, created_at
	`, eventID, groupID, userID, channelID).Scan(
		&ev.ID, &ev.GroupID, &ev.ChannelID, &ev.Title, &desc,
		&ev.ScheduledStart, &sEnd, &startedAt, &startedBy,
		&ev.CreatorID, &ev.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("event not found")
		}
		return nil, fmt.Errorf("failed to start event: %w", err)
	}

	applyVoiceEventNulls(&ev, desc, sEnd, startedAt, startedBy)
	return &ev, nil
}

func (s *GroupService) DeleteGroupEvent(groupID, eventID, requestingUserID string) error {
	var channelID, creatorID string
	err := s.db.QueryRow(`SELECT channel_id FROM groups WHERE id = $1`, groupID).Scan(&channelID)
	if err != nil {
		return fmt.Errorf("group not found")
	}
	if err := s.isChannelMember(channelID, requestingUserID); err != nil {
		return err
	}

	err = s.db.QueryRow(`SELECT creator_id FROM voice_events WHERE id = $1 AND group_id = $2`, eventID, groupID).Scan(&creatorID)
	if err != nil {
		return fmt.Errorf("event not found")
	}

	if creatorID != requestingUserID {
		var channelRole, groupRole string
		_ = s.db.QueryRow(`SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, requestingUserID).Scan(&channelRole)
		_ = s.db.QueryRow(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, requestingUserID).Scan(&groupRole)
		if channelRole != "OWNER" && channelRole != "ADMIN" && groupRole != "OWNER" && groupRole != "ADMIN" && groupRole != "MODERATOR" {
			return fmt.Errorf("insufficient permissions to delete events")
		}
	}

	_, err = s.db.Exec(`DELETE FROM voice_events WHERE id = $1 AND group_id = $2`, eventID, groupID)
	if err != nil {
		return fmt.Errorf("failed to delete event: %w", err)
	}

	return nil
}

