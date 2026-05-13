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
}

func NewUserService(db *sql.DB, supabaseURL, supabaseKey string) *UserService {
	return &UserService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
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

func (s *UserService) UpdateProfile(userID string, updateData models.UpdateUserInput) error {
	// Build update map with only non-nil fields
	updateMap := make(map[string]interface{})
	if updateData.Username != nil {
		updateMap["username"] = *updateData.Username
	}
	if updateData.AvatarURL != nil {
		updateMap["avatar_url"] = *updateData.AvatarURL
	}
	if updateData.PhoneNumber != nil {
		updateMap["phone_number"] = *updateData.PhoneNumber
	}
	if updateData.Bio != nil {
		updateMap["bio"] = *updateData.Bio
	}
	if updateData.Status != nil {
		updateMap["status"] = *updateData.Status
	}
	if updateData.Banner != nil {
		updateMap["banner"] = *updateData.Banner
	}
	if updateData.Logo != nil {
		updateMap["logo"] = *updateData.Logo
	}
	if updateData.Fullname != nil {
		updateMap["full_name"] = *updateData.Fullname
	}
	if updateData.XURL != nil {
		updateMap["x_url"] = *updateData.XURL
	}
	if updateData.WebsiteURL != nil {
		updateMap["website_url"] = *updateData.WebsiteURL
	}
	if updateData.EnterSoundURL != nil {
		updateMap["enter_sound_url"] = *updateData.EnterSoundURL
	}
	updateMap["updated_at"] = time.Now()

	var result []models.User
	err := s.supabase.GetClient().DB.From("users").
		Update(updateMap).
		Eq("id", userID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to update user profile: %w", err)
	}

	return nil
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

	if len(settings) == 0 {
		return nil, fmt.Errorf("settings not found")
	}

	return &settings[0], nil
}

func (s *UserService) SearchByUsername(username string, requestingUserID string) ([]*models.User, error) {
	var users []models.User
	err := s.supabase.GetClient().DB.From("users").
		Select("*").
		Like("username", "%"+username+"%").
		Execute(&users)

	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}

	// Convert to pointer slice
	var userPtrs []*models.User
	for i := range users {
		userPtrs = append(userPtrs, &users[i])
	}

	return userPtrs, nil
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
