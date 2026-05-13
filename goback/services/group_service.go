package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

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

func (s *GroupService) CreateGroup(channelID, userID string, createData models.CreateGroupDto) (*models.Group, error) {
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
	// Check if user is a member of the channel
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

	var groups []models.Group
	err = s.supabase.GetClient().DB.From("groups").
		Select("*").
		Eq("channel_id", channelID).
		Execute(&groups)

	if err != nil {
		return nil, fmt.Errorf("failed to query groups (channelID=%s): %w", channelID, err)
	}

	// Convert to slice of pointers
	var result []*models.Group
	for i := range groups {
		result = append(result, &groups[i])
	}

	return result, nil
}

func (s *GroupService) GetGroupMembers(groupID, requestingUserID string) ([]*models.GroupMemberResponse, error) {
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("*").
		Eq("group_id", groupID).
		Eq("user_id", requestingUserID).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to check group membership: %w", err)
	}

	if len(members) == 0 {
		channelRole, _ := s.getChannelRoleForGroup(groupID, requestingUserID)
		if channelRole != "OWNER" && channelRole != "ADMIN" {
			return nil, fmt.Errorf("access denied")
		}
	}

	var allMembers []models.GroupMember
	err = s.supabase.GetClient().DB.From("group_members").
		Select("*").
		Eq("group_id", groupID).
		Execute(&allMembers)

	if err != nil {
		return nil, fmt.Errorf("failed to query group members: %w", err)
	}

	// If no member has OWNER role (legacy groups), treat the earliest member as owner
	hasOwner := false
	for _, m := range allMembers {
		if m.Role == "OWNER" {
			hasOwner = true
			break
		}
	}
	var ownerID string
	if !hasOwner && len(allMembers) > 0 {
		earliest := allMembers[0]
		for _, m := range allMembers[1:] {
			if m.JoinedAt.Before(earliest.JoinedAt) {
				earliest = m
			}
		}
		ownerID = earliest.UserID
	}

	var result []*models.GroupMemberResponse
	for _, member := range allMembers {
		var userSlice []models.User
		err := s.supabase.GetClient().DB.From("users").
			Select("*").
			Eq("id", member.UserID).
			Execute(&userSlice)
		if err != nil || len(userSlice) == 0 {
			continue
		}
		u := userSlice[0]
		role := member.Role
		if !hasOwner && member.UserID == ownerID {
			role = "OWNER"
		}
		result = append(result, &models.GroupMemberResponse{
			Role:     role,
			JoinedAt: member.JoinedAt,
			User: models.GroupMemberUser{
				ID:         u.ID,
				Email:      u.Email,
				Fullname:   u.Fullname,
				Username:   u.Username,
				AvatarURL:  u.AvatarURL,
				Banner:     u.Banner,
				Bio:        u.Bio,
				IsVerified: u.IsVerified,
				SubPlan:    u.SubPlan,
			},
		})
	}

	return result, nil
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
		Select("id").
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
	// Check if group is private
	var groups []models.Group
	err := s.supabase.GetClient().DB.From("groups").
		Select("access_type").
		Filter("id", "eq", groupID).
		Execute(&groups)

	if err != nil {
		return fmt.Errorf("failed to check group access type: %w", err)
	}

	if len(groups) == 0 {
		return fmt.Errorf("group not found")
	}

	if groups[0].AccessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private groups")
	}

	// Check if already a member
	var existingMembers []models.GroupMember
	err = s.supabase.GetClient().DB.From("group_members").
		Select("id").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&existingMembers)

	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if len(existingMembers) > 0 {
		return fmt.Errorf("already a member")
	}

	// Check if request already exists
	var existingRequests []models.GroupJoinRequest
	err = s.supabase.GetClient().DB.From("group_join_requests").
		Select("id").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Filter("status", "eq", "PENDING").
		Execute(&existingRequests)

	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}

	if len(existingRequests) > 0 {
		return fmt.Errorf("join request already exists")
	}

	// Create join request
	var requests []models.GroupJoinRequest
	err = s.supabase.GetClient().DB.From("group_join_requests").
		Insert(map[string]interface{}{
			"group_id":   groupID,
			"user_id":    userID,
			"status":     "PENDING",
			"message":    "",
			"created_at": "now()",
			"updated_at": "now()",
		}).
		Execute(&requests)

	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}

	return nil
}

func (s *GroupService) GetJoinRequests(groupID, userID string) ([]*models.GroupJoinRequest, error) {
	// Check if user is admin or moderator
	var members []models.GroupMember
	err := s.supabase.GetClient().DB.From("group_members").
		Select("role").
		Filter("group_id", "eq", groupID).
		Filter("user_id", "eq", userID).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to check user role: %w", err)
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
			return nil, fmt.Errorf("access denied")
		} else {
			return nil, fmt.Errorf("insufficient permissions")
		}
	}

	var requests []models.GroupJoinRequest
	err = s.supabase.GetClient().DB.From("group_join_requests").
		Select("id, group_id, user_id, status, message, created_at, updated_at").
		Filter("group_id", "eq", groupID).
		Filter("status", "eq", "PENDING").
		Execute(&requests)

	if err != nil {
		return nil, fmt.Errorf("failed to query join requests: %w", err)
	}

	// Convert to slice of pointers
	var result []*models.GroupJoinRequest
	for i := range requests {
		result = append(result, &requests[i])
	}

	return result, nil
}

func (s *GroupService) RespondToJoinRequest(groupID, requestID, status, userID string) error {
	// Check if user is admin or moderator
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

	// Get request details
	var requests []models.GroupJoinRequest
	err = s.supabase.GetClient().DB.From("group_join_requests").
		Select("user_id").
		Filter("id", "eq", requestID).
		Filter("group_id", "eq", groupID).
		Execute(&requests)

	if err != nil {
		return fmt.Errorf("failed to get join request: %w", err)
	}

	if len(requests) == 0 {
		return fmt.Errorf("join request not found")
	}

	requestingUserID := requests[0].UserID

	// Update request status
	var updatedRequests []models.GroupJoinRequest
	err = s.supabase.GetClient().DB.From("group_join_requests").
		Update(map[string]interface{}{
			"status":     status,
			"updated_at": "now()",
		}).
		Filter("id", "eq", requestID).
		Filter("group_id", "eq", groupID).
		Execute(&updatedRequests)

	if err != nil {
		return fmt.Errorf("failed to update join request: %w", err)
	}

	// If accepted, add user as member
	if status == "ACCEPTED" {
		var newMembers []models.GroupMember
		err = s.supabase.GetClient().DB.From("group_members").
			Insert(map[string]interface{}{
				"group_id":  groupID,
				"user_id":   requestingUserID,
				"role":      "MEMBER",
				"joined_at": "now()",
			}).
			Execute(&newMembers)

		if err != nil {
			return fmt.Errorf("failed to add member: %w", err)
		}
	}

	return nil
}
