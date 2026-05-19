package services

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type UserService struct {
	db       *sql.DB
	supabase *SupabaseClient
	socketIO *SocketIOService
}

func NewUserService(db *sql.DB, supabaseURL, supabaseKey string, socketIO *SocketIOService) *UserService {
	return &UserService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
		socketIO: socketIO,
	}
}

func (s *UserService) GetUserByID(userID, requestingUserID string) (*models.UserProfile, error) {
	// Get user details
	var users []models.User
	err := s.supabase.GetClient().DB.From("users").
		Select("*").
		Eq("id", userID).
		Execute(&users)

	if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	user := &users[0]

	// Get follower/following counts
	followersCount, _ := s.GetFollowersCount(userID)
	followingCount, _ := s.GetFollowingCount(userID)

	// Check if requesting user is following this user
	isFollowing := false
	if requestingUserID != "" && requestingUserID != userID {
		isFollowing, _ = s.IsFollowing(requestingUserID, userID)
	}

	profile := &models.UserProfile{
		User:        *user,
		Followers:   followersCount,
		Following:   followingCount,
		IsFollowing: isFollowing,
	}

	return profile, nil
}

func (s *UserService) GetMutualFollowers(userID string) ([]models.User, error) {
	// Get users that follow the current user
	var followers []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("following_id", userID).
		Execute(&followers)

	if err != nil {
		return nil, fmt.Errorf("failed to query followers: %w", err)
	}

	// Get users that the current user follows
	var following []models.Follow
	err = s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("follower_id", userID).
		Execute(&following)

	if err != nil {
		return nil, fmt.Errorf("failed to query following: %w", err)
	}

	// Find mutual follower IDs
	followerIDs := make(map[string]bool)
	for _, follower := range followers {
		followerIDs[follower.FollowerID] = true
	}

	mutualIDs := make([]string, 0)
	for _, following := range following {
		if followerIDs[following.FollowingID] && following.FollowingID != userID {
			mutualIDs = append(mutualIDs, following.FollowingID)
		}
	}

	// Get user details for mutual followers
	if len(mutualIDs) == 0 {
		return []models.User{}, nil
	}

	var users []models.User
	err = s.supabase.GetClient().DB.From("users").
		Select("*").
		In("id", mutualIDs).
		Execute(&users)

	if err != nil {
		return nil, fmt.Errorf("failed to query mutual follower details: %w", err)
	}

	// The users slice already contains the User structs from the query

	return users, nil
}

func (s *UserService) UpdateProfile(userID string, updateData models.UpdateUserInput) (*models.UserProfile, error) {
	log.Printf("[PROFILE] Updating user %s with data: %+v", userID, updateData)

	// Build update query dynamically
	query := "UPDATE users SET updated_at = NOW()"
	params := []interface{}{userID}
	paramCount := 2

	if updateData.Username != nil {
		query += fmt.Sprintf(", username = $%d", paramCount)
		params = append(params, updateData.Username)
		paramCount++
	}
	if updateData.AvatarURL != nil {
		query += fmt.Sprintf(", avatar_url = $%d", paramCount)
		params = append(params, updateData.AvatarURL)
		paramCount++
	}
	if updateData.PhoneNumber != nil {
		query += fmt.Sprintf(", phone_number = $%d", paramCount)
		params = append(params, updateData.PhoneNumber)
		paramCount++
	}
	if updateData.Bio != nil {
		query += fmt.Sprintf(", bio = $%d", paramCount)
		params = append(params, updateData.Bio)
		paramCount++
	}
	if updateData.Status != nil {
		query += fmt.Sprintf(", status = $%d", paramCount)
		params = append(params, updateData.Status)
		paramCount++
	}
	if updateData.Banner != nil {
		query += fmt.Sprintf(", banner = $%d", paramCount)
		params = append(params, updateData.Banner)
		paramCount++
	}
	if updateData.Logo != nil {
		query += fmt.Sprintf(", logo = $%d", paramCount)
		params = append(params, updateData.Logo)
		paramCount++
	}
	if updateData.Fullname != nil {
		query += fmt.Sprintf(", fullname = $%d", paramCount)
		params = append(params, updateData.Fullname)
		paramCount++
	}
	if updateData.XURL != nil {
		query += fmt.Sprintf(", x_url = $%d", paramCount)
		params = append(params, updateData.XURL)
		paramCount++
	}
	if updateData.WebsiteURL != nil {
		query += fmt.Sprintf(", website_url = $%d", paramCount)
		params = append(params, updateData.WebsiteURL)
		paramCount++
	}
	if updateData.EnterSoundURL != nil {
		query += fmt.Sprintf(", enter_sound_url = $%d", paramCount)
		params = append(params, updateData.EnterSoundURL)
		paramCount++
	}
	if updateData.NameEffect != nil {
		query += fmt.Sprintf(", name_effect = $%d", paramCount)
		params = append(params, updateData.NameEffect)
		paramCount++
	}
	if updateData.UserStatus != nil {
		query += fmt.Sprintf(", user_status = $%d", paramCount)
		params = append(params, updateData.UserStatus)
		paramCount++
	}
	if updateData.StatusMessage != nil {
		query += fmt.Sprintf(", status_message = $%d", paramCount)
		params = append(params, updateData.StatusMessage)
		paramCount++
	}

	query += " WHERE id = $1"

	res, err := s.db.Exec(query, params...)
	if err != nil {
		log.Printf("[PROFILE] SQL Error updating user %s: %v | Query: %s", userID, err, query)
		return nil, fmt.Errorf("failed to update user profile: %w", err)
	}

	rows, _ := res.RowsAffected()
	log.Printf("[PROFILE] Successfully updated user %s, rows affected: %d", userID, rows)

	// Convert to UserProfile format
	profile, err := s.GetUserByID(userID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated profile: %w", err)
	}

	return profile, nil
}

func (s *UserService) GetSettings(userID string) (*models.UserSettings, error) {
	var settings []models.UserSettings

	res := s.supabase.GetClient().DB.
		From("user_settings").
		Select("*").
		Eq("user_id", userID).
		Execute(&settings)

	if res != nil {
		return nil, res
	}

	log.Printf("RAW SETTINGS: %+v", settings)

	return &settings[0], nil
}

func (s *UserService) UpdateSettings(userID string, updateData map[string]interface{}) (*models.UserSettings, error) {
	var result []models.UserSettings
	err := s.supabase.GetClient().DB.From("user_settings").
		Update(updateData).
		Eq("user_id", userID).
		Execute(&result)

	if err != nil {
		log.Printf("UpdateSettings supabase error: %v | data sent: %+v", err, updateData)
		return nil, fmt.Errorf("failed to update user settings: %w", err)
	}

	if len(result) == 0 {
		log.Printf("UpdateSettings: no rows returned for userID=%s", userID)
		return nil, fmt.Errorf("settings not found")
	}

	return &result[0], nil
}

func (s *UserService) SearchByUsername(username string, requestingUserID string) ([]*models.User, error) {
	query := `
		SELECT id, username, avatar_url, created_at, bio, status, banner, logo, fullname, x_url, website_url, is_verified, sub_plan 
		FROM users 
		WHERE username ILIKE $1
	`
	rows, err := s.db.Query(query, "%"+username+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		u := &models.User{}
		err := rows.Scan(
			&u.ID, &u.Username, &u.AvatarURL, &u.CreatedAt, &u.Bio, &u.Status,
			&u.Banner, &u.Logo, &u.Fullname, &u.XURL, &u.WebsiteURL, &u.IsVerified, &u.SubPlan,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, u)
	}

	return users, nil
}

func (s *UserService) FollowUser(userID, followingID string) error {
	if userID == followingID {
		return fmt.Errorf("cannot follow yourself")
	}

	// Check if already following
	isFollowing, err := s.IsFollowing(userID, followingID)
	if err != nil {
		return fmt.Errorf("failed to check follow status: %w", err)
	}
	if isFollowing {
		return fmt.Errorf("already following this user")
	}

	followData := map[string]interface{}{
		"follower_id":  userID,
		"following_id": followingID,
		"created_at":   time.Now(),
	}

	var result []models.Follow
	err = s.supabase.GetClient().DB.From("follows").
		Insert(followData).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to follow user: %w", err)
	}

	// Check if mutual follow and notify the other user
	isMutual, _ := s.IsFollowing(followingID, userID)
	if s.socketIO != nil {
		s.socketIO.EmitToUser(followingID, "follow_update", map[string]interface{}{
			"follower_id": userID,
			"is_mutual":   isMutual,
		})
	}

	return nil
}

func (s *UserService) UnfollowUser(userID, followingID string) error {
	var result []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Delete().
		Eq("follower_id", userID).
		Eq("following_id", followingID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to unfollow user: %w", err)
	}

	if len(result) == 0 {
		return fmt.Errorf("not following this user")
	}

	return nil
}

func (s *UserService) IsFollowing(userID, followingID string) (bool, error) {
	var follows []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("follower_id", userID).
		Eq("following_id", followingID).
		Execute(&follows)

	if err != nil {
		return false, fmt.Errorf("failed to check follow status: %w", err)
	}

	return len(follows) > 0, nil
}

func (s *UserService) GetFollowersCount(userID string) (int, error) {
	var follows []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Select("id").
		Eq("following_id", userID).
		Execute(&follows)

	if err != nil {
		return 0, fmt.Errorf("failed to get followers count: %w", err)
	}

	return len(follows), nil
}

func (s *UserService) GetFollowingCount(userID string) (int, error) {
	var follows []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Select("id").
		Eq("follower_id", userID).
		Execute(&follows)

	if err != nil {
		return 0, fmt.Errorf("failed to get following count: %w", err)
	}

	return len(follows), nil
}

func (s *UserService) GetFollowers(userID string, requestingUserID string) ([]*models.FollowerResponse, error) {
	// Get follow relationships
	var follows []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("following_id", userID).
		Execute(&follows)

	if err != nil {
		return nil, fmt.Errorf("failed to get followers: %w", err)
	}

	if len(follows) == 0 {
		return []*models.FollowerResponse{}, nil
	}

	// Get user data for each follower and build response
	var result []*models.FollowerResponse
	for i := range follows {
		var singleUser []models.User
		err := s.supabase.GetClient().DB.From("users").
			Select("*").
			Eq("id", follows[i].FollowerID).
			Execute(&singleUser)

		if err == nil && len(singleUser) > 0 {
			result = append(result, &models.FollowerResponse{
				FollowerID: follows[i].FollowerID,
				Users: &models.FollowUser{
					ID:        singleUser[0].ID,
					Username:  singleUser[0].Username,
					AvatarURL: singleUser[0].AvatarURL,
					Bio:       singleUser[0].Bio,
					SubPlan:   singleUser[0].SubPlan,
				},
			})
		}
	}

	return result, nil
}

func (s *UserService) GetFollowing(userID string, requestingUserID string) ([]*models.FollowingResponse, error) {
	// Get follow relationships
	var follows []models.Follow
	err := s.supabase.GetClient().DB.From("follows").
		Select("*").
		Eq("follower_id", userID).
		Execute(&follows)

	if err != nil {
		return nil, fmt.Errorf("failed to get following: %w", err)
	}

	if len(follows) == 0 {
		return []*models.FollowingResponse{}, nil
	}

	// Get user data for each followed user and build response
	var result []*models.FollowingResponse
	for i := range follows {
		var singleUser []models.User
		err := s.supabase.GetClient().DB.From("users").
			Select("*").
			Eq("id", follows[i].FollowingID).
			Execute(&singleUser)

		if err == nil && len(singleUser) > 0 {
			result = append(result, &models.FollowingResponse{
				FollowingID: follows[i].FollowingID,
				Users: &models.FollowUser{
					ID:        singleUser[0].ID,
					Username:  singleUser[0].Username,
					AvatarURL: singleUser[0].AvatarURL,
					Bio:       singleUser[0].Bio,
					SubPlan:   singleUser[0].SubPlan,
				},
			})
		}
	}

	return result, nil
}

func getString(data map[string]interface{}, key string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func getStringPtr(data map[string]interface{}, key string) *string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return &str
		}
	}
	return nil
}

func (s *UserService) GetUsers() ([]*models.User, error) {
	var users []models.User
	err := s.supabase.GetClient().DB.From("users").
		Select("*").
		Execute(&users)

	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}

	// Convert to pointer slice
	var userPtrs []*models.User
	for i := range users {
		userPtrs = append(userPtrs, &users[i])
	}

	return userPtrs, nil
}
