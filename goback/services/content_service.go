package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type ContentService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewContentService(db *sql.DB, supabaseURL, supabaseKey string) *ContentService {
	return &ContentService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

// --- POSTS ---

func (s *ContentService) CreatePost(userID string, req models.CreatePostRequest) (*models.Post, error) {
	urlsJSON, _ := json.Marshal(req.MediaURLs)

	query := `
		INSERT INTO user_posts (id, user_id, caption, media_urls, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP)
		RETURNING id, user_id, caption, media_urls, created_at
	`

	post := &models.Post{}
	var mediaURLs []byte

	err := s.db.QueryRow(query, userID, req.Caption, urlsJSON).Scan(
		&post.ID, &post.UserID, &post.Caption, &mediaURLs, &post.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create post: %w", err)
	}

	if mediaURLs != nil {
		json.Unmarshal(mediaURLs, &post.MediaURLs)
	}

	return post, nil
}

func (s *ContentService) GetUserPosts(userID string) ([]*models.PostWithUser, error) {
	// Get posts first
	var posts []models.UserPost
	err := s.supabase.GetClient().DB.From("user_posts").
		Select("*").
		Eq("user_id", userID).
		Execute(&posts)

	if err != nil {
		return nil, fmt.Errorf("failed to query posts: %w", err)
	}

	// Get user data using same approach as UserService
	var users []models.User
	err = s.supabase.GetClient().DB.From("users").
		Select("*").
		Eq("id", userID).
		Execute(&users)

	// Convert to PostWithUser with actual user data
	var result []*models.PostWithUser
	for i := range posts {
		postWithUser := &models.PostWithUser{
			ID:        posts[i].ID,
			UserID:    posts[i].UserID,
			Caption: func() string {
				if posts[i].Caption != nil {
					return *posts[i].Caption
				}
				return ""
			}(),
			MediaURLs: posts[i].MediaURLs,
			CreatedAt: posts[i].CreatedAt,
		}

		// Add user data if available
		if len(users) > 0 {
			postWithUser.Users = models.PostUser{
				ID: users[0].ID,
				Username: func() string {
					if users[0].Username != nil {
						return *users[0].Username
					} else {
						return ""
					}
				}(),
				AvatarURL: func() string {
					if users[0].AvatarURL != nil {
						return *users[0].AvatarURL
					} else {
						return ""
					}
				}(),
			}
		} else {
			postWithUser.Users = models.PostUser{
				ID:        userID,
				Username:  "",
				AvatarURL: "",
			}
		}

		result = append(result, postWithUser)
	}

	return result, nil
}

func (s *ContentService) AddComment(userID string, postID string, req models.CreateCommentRequest) (*models.PostComment, error) {
	var comments []models.PostComment
	err := s.supabase.GetClient().DB.From("post_comments").
		Insert(map[string]interface{}{
			"user_id": userID,
			"post_id": postID,
			"content": req.Content,
		}).
		Execute(&comments)

	if err != nil {
		return nil, fmt.Errorf("failed to add comment: %w", err)
	}

	if len(comments) == 0 {
		return nil, fmt.Errorf("failed to add comment: no data returned")
	}

	return &comments[0], nil
}

func (s *ContentService) LikePost(userID string, postID string) (*models.PostLike, error) {
	var likes []models.PostLike
	err := s.supabase.GetClient().DB.From("post_likes").
		Insert(map[string]interface{}{
			"user_id": userID,
			"post_id": postID,
		}).
		Execute(&likes)

	if err != nil {
		return nil, fmt.Errorf("failed to like post: %w", err)
	}

	if len(likes) == 0 {
		return nil, fmt.Errorf("failed to like post: no data returned")
	}

	return &likes[0], nil
}

func (s *ContentService) UnlikePost(userID string, postID string) error {
	var result []map[string]interface{}
	err := s.supabase.GetClient().DB.From("post_likes").
		Delete().
		Eq("user_id", userID).
		Eq("post_id", postID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to unlike post: %w", err)
	}

	return nil
}

// --- STORIES ---

func (s *ContentService) CreateStory(userID string, req models.CreateStoryRequest) (*models.Story, error) {
	query := `
		INSERT INTO stories (id, user_id, media_url, type, caption, music_preview_url, music_title, music_artist, music_cover_url, created_at, expires_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')
		RETURNING id, user_id, media_url, type, caption, music_preview_url, music_title, music_artist, music_cover_url, created_at, expires_at
	`

	story := &models.Story{}
	err := s.db.QueryRow(query,
		userID, req.MediaURL, req.Type, req.Caption, req.MusicPreviewURL, req.MusicTitle, req.MusicArtist, req.MusicCoverURL,
	).Scan(
		&story.ID, &story.UserID, &story.MediaURL, &story.Type, &story.Caption, &story.MusicPreviewURL, &story.MusicTitle, &story.MusicArtist, &story.MusicCoverURL, &story.CreatedAt, &story.ExpiresAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create story: %w", err)
	}

	return story, nil
}

func (s *ContentService) GetFeed(userID string) ([]*models.FeedGroup, error) {
	// Get stories from mutual followers and self with user information
	query := `
		SELECT 
			s.id, s.user_id, s.media_url, s.type, s.caption, s.music_preview_url, s.music_title, s.music_artist, s.music_cover_url, s.created_at, s.expires_at,
			u.id, u.username, u.avatar_url, u.sub_plan
		FROM stories s
		LEFT JOIN users u ON s.user_id = u.id
		WHERE s.expires_at > CURRENT_TIMESTAMP
		AND (
			s.user_id = $1
			OR s.user_id IN (
				SELECT f.following_id
					FROM follows f
					WHERE f.follower_id = $1
					AND f.following_id IN (
						SELECT f2.follower_id
						FROM follows f2
						WHERE f2.following_id = $1
					)
			)
		)
		ORDER BY s.user_id, s.created_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query story feed: %w", err)
	}
	defer rows.Close()

	// Group stories by user
	userStoriesMap := make(map[string]*models.FeedGroup)
	for rows.Next() {
		story := &models.Story{}
		user := &models.StoryUser{}

		err := rows.Scan(
			&story.ID, &story.UserID, &story.MediaURL, &story.Type, &story.Caption, &story.MusicPreviewURL, &story.MusicTitle, &story.MusicArtist, &story.MusicCoverURL, &story.CreatedAt, &story.ExpiresAt,
			&user.ID, &user.Username, &user.AvatarURL, &user.SubPlan,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan story feed: %w", err)
		}

		if _, exists := userStoriesMap[story.UserID]; !exists {
			userStoriesMap[story.UserID] = &models.FeedGroup{
				User:    *user,
				Stories: []models.Story{},
			}
		}

		userStoriesMap[story.UserID].Stories = append(userStoriesMap[story.UserID].Stories, *story)
	}

	// Convert map to slice
	var result []*models.FeedGroup
	for _, group := range userStoriesMap {
		result = append(result, group)
	}

	fmt.Printf("GetFeed query returned %d story groups for user %s\n", len(result), userID)
	return result, nil
}

func (s *ContentService) GetStoryById(userID string, storyID string) (*models.Story, error) {
	query := `
		SELECT id, user_id, media_url, type, caption, music_preview_url, music_title, music_artist, music_cover_url, created_at, expires_at
		FROM stories
		WHERE id = $1
	`

	story := &models.Story{}
	err := s.db.QueryRow(query, storyID).Scan(
		&story.ID, &story.UserID, &story.MediaURL, &story.Type, &story.Caption, &story.MusicPreviewURL, &story.MusicTitle, &story.MusicArtist, &story.MusicCoverURL, &story.CreatedAt, &story.ExpiresAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get story: %w", err)
	}

	return story, nil
}

func (s *ContentService) RecordView(userID string, storyID string) (*models.StoryViewResult, error) {
	// Get story owner
	var ownerID string
	err := s.db.QueryRow("SELECT user_id FROM stories WHERE id = $1", storyID).Scan(&ownerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get story: %w", err)
	}

	// Check if already viewed
	var views []models.StoryView
	err = s.supabase.GetClient().DB.From("story_views").
		Select("id").
		Filter("story_id", "eq", storyID).
		Filter("user_id", "eq", userID).
		Execute(&views)

	if len(views) == 0 {
		// Record view
		var newViews []models.StoryView
		err = s.supabase.GetClient().DB.From("story_views").
			Insert(map[string]interface{}{
				"story_id": storyID,
				"user_id":  userID,
			}).
			Execute(&newViews)
		if err != nil {
			return nil, fmt.Errorf("failed to record view: %w", err)
		}
	}

	// Get total views count
	var viewsCount int
	s.db.QueryRow("SELECT COUNT(*) FROM story_views WHERE story_id = $1", storyID).Scan(&viewsCount)

	return &models.StoryViewResult{
		StoryID:    storyID,
		ViewsCount: viewsCount,
		OwnerID:    ownerID,
	}, nil
}

func (s *ContentService) GetStoryViewers(userID string, storyID string) ([]map[string]interface{}, error) {
	// Only the story owner may see viewers
	var ownerID string
	if err := s.db.QueryRow("SELECT user_id FROM stories WHERE id = $1", storyID).Scan(&ownerID); err != nil {
		return nil, fmt.Errorf("failed to get story: %w", err)
	}
	if ownerID != userID {
		return []map[string]interface{}{}, nil
	}

	query := `
		SELECT sv.viewed_at, u.id, u.username, u.avatar_url
		FROM story_views sv
		JOIN users u ON u.id = sv.user_id
		WHERE sv.story_id = $1
		ORDER BY sv.viewed_at DESC
	`

	rows, err := s.db.Query(query, storyID)
	if err != nil {
		return nil, fmt.Errorf("failed to query story viewers: %w", err)
	}
	defer rows.Close()

	// reactions keyed by user_id for this story
	reactionByUser := map[string]string{}
	rRows, err := s.db.Query(`SELECT user_id, reaction FROM story_reactions WHERE story_id = $1`, storyID)
	if err == nil {
		defer rRows.Close()
		for rRows.Next() {
			var uid, reaction string
			if err := rRows.Scan(&uid, &reaction); err == nil {
				reactionByUser[uid] = reaction
			}
		}
	}

	viewers := []map[string]interface{}{}
	for rows.Next() {
		var viewedAt time.Time
		var uid, username string
		var avatarURL sql.NullString
		if err := rows.Scan(&viewedAt, &uid, &username, &avatarURL); err != nil {
			return nil, fmt.Errorf("failed to scan story viewer: %w", err)
		}
		var avatar interface{} = nil
		if avatarURL.Valid {
			avatar = avatarURL.String
		}
		var reaction interface{} = nil
		if r, ok := reactionByUser[uid]; ok {
			reaction = r
		}
		viewers = append(viewers, map[string]interface{}{
			"viewed_at": viewedAt,
			"user": map[string]interface{}{
				"id":         uid,
				"username":   username,
				"avatar_url": avatar,
			},
			"reaction": reaction,
		})
	}

	return viewers, nil
}

func (s *ContentService) ReactToStory(userID string, storyID string, reaction string) (*models.StoryReactionResult, error) {
	// Get story owner
	var ownerID string
	err := s.db.QueryRow("SELECT user_id FROM stories WHERE id = $1", storyID).Scan(&ownerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get story: %w", err)
	}

	// Upsert reaction
	_, err = s.db.Exec(`
		INSERT INTO story_reactions (story_id, user_id, reaction) 
		VALUES ($1, $2, $3)
		ON CONFLICT (story_id, user_id) 
		DO UPDATE SET reaction = $3
	`, storyID, userID, reaction)

	if err != nil {
		return nil, fmt.Errorf("failed to react to story: %w", err)
	}

	// Get reactions count
	var reactionsCount int
	s.db.QueryRow("SELECT COUNT(*) FROM story_reactions WHERE story_id = $1", storyID).Scan(&reactionsCount)

	return &models.StoryReactionResult{
		StoryID:        storyID,
		ReactionsCount: reactionsCount,
		OwnerID:        ownerID,
	}, nil
}

func (s *ContentService) RemoveReaction(userID string, storyID string) error {
	err := s.supabase.GetClient().DB.From("story_reactions").
		Delete().
		Filter("story_id", "eq", storyID).
		Filter("user_id", "eq", userID).
		Execute(nil)
	if err != nil {
		return fmt.Errorf("failed to remove reaction: %w", err)
	}
	return nil
}

func (s *ContentService) DeleteStory(userID string, storyID string) error {
	err := s.supabase.GetClient().DB.From("stories").
		Delete().
		Filter("id", "eq", storyID).
		Filter("user_id", "eq", userID).
		Execute(nil)
	if err != nil {
		return fmt.Errorf("failed to delete story: %w", err)
	}
	return nil
}

// --- STORE (PRODUCTS) ---

func (s *ContentService) CreateProduct(req models.CreateProductRequest) (*models.Product, error) {
	featuresJSON, _ := json.Marshal(req.Features)
	imagesJSON, _ := json.Marshal(req.Images)

	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Insert(map[string]interface{}{
			"title":           req.Title,
			"description":     req.Description,
			"price":           req.Price,
			"category":        req.Category,
			"features":        featuresJSON,
			"slug":            req.Slug,
			"active":          req.Active,
			"dodo_product_id": req.DodoProductID,
			"discount":        req.Discount,
			"images":          imagesJSON,
		}).
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to create product: %w", err)
	}

	if len(products) == 0 {
		return nil, fmt.Errorf("failed to create product: no data returned")
	}

	// No need to reassign if types match, but let's ensure we return what was sent
	products[0].Features = req.Features
	products[0].Images = req.Images

	return &products[0], nil
}

func (s *ContentService) GetProducts() ([]*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("active", "true").
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to query products: %w", err)
	}

	// Convert to pointer slice
	var productPtrs []*models.Product
	for i := range products {
		productPtrs = append(productPtrs, &products[i])
	}

	return productPtrs, nil
}

func (s *ContentService) GetActiveProducts() ([]*models.Product, error) {
	return s.GetProducts()
}

func (s *ContentService) GetFeaturedProducts() ([]*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("active", "true").
		Eq("featured", "true").
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to query featured products: %w", err)
	}

	// Convert to pointer slice
	var productPtrs []*models.Product
	for i := range products {
		productPtrs = append(productPtrs, &products[i])
	}

	return productPtrs, nil
}

func (s *ContentService) GetProductsByCategory(category string) ([]*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("active", "true").
		Eq("category", category).
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to query products by category: %w", err)
	}

	// Convert to pointer slice
	var productPtrs []*models.Product
	for i := range products {
		productPtrs = append(productPtrs, &products[i])
	}

	return productPtrs, nil
}

func (s *ContentService) SearchProducts(query string) ([]*models.Product, error) {
	// Use raw SQL for OR condition since supabase-go doesn't support OR operations
	sqlQuery := `
		SELECT id, title, description, price, category, features, slug, active, 
		       dodo_product_id, discount, images, created_at, updated_at
		FROM products 
		WHERE active = true 
		AND (title ILIKE $1 OR description ILIKE $2)
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(sqlQuery, "%"+query+"%", "%"+query+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to search products: %w", err)
	}
	defer rows.Close()

	var products []*models.Product
	for rows.Next() {
		product := &models.Product{}
		var featuresJSON, imagesJSON []byte

		err := rows.Scan(
			&product.ID, &product.Title, &product.Description, &product.Price,
			&product.Category, &featuresJSON, &product.Slug, &product.Active,
			&product.DodoProductID, &product.Discount, &imagesJSON,
			&product.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan product: %w", err)
		}

		// Unmarshal JSON fields
		if featuresJSON != nil {
			json.Unmarshal(featuresJSON, &product.Features)
		}
		if imagesJSON != nil {
			json.Unmarshal(imagesJSON, &product.Images)
		}

		products = append(products, product)
	}

	return products, nil
}

func (s *ContentService) GetProductsByPriceRange(minPrice, maxPrice float64) ([]*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("active", "true").
		Gte("price", fmt.Sprintf("%.2f", minPrice)).
		Lte("price", fmt.Sprintf("%.2f", maxPrice)).
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to query products by price range: %w", err)
	}

	// Convert to pointer slice
	var productPtrs []*models.Product
	for i := range products {
		productPtrs = append(productPtrs, &products[i])
	}

	return productPtrs, nil
}

func (s *ContentService) GetOnSaleProducts() ([]*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("active", "true").
		Gt("discount", "0").
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to query on sale products: %w", err)
	}

	// Convert to pointer slice
	var productPtrs []*models.Product
	for i := range products {
		productPtrs = append(productPtrs, &products[i])
	}

	return productPtrs, nil
}

func (s *ContentService) GetProductById(id string) (*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("id", id).
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to get product: %w", err)
	}

	if len(products) == 0 {
		return nil, fmt.Errorf("product not found")
	}

	// Convert to pointer slice
	var productPtrs []*models.Product
	for i := range products {
		productPtrs = append(productPtrs, &products[i])
	}

	return productPtrs[0], nil
}

func (s *ContentService) GetProductBySlug(slug string) (*models.Product, error) {
	var products []models.Product
	err := s.supabase.GetClient().DB.From("products").
		Select("*").
		Eq("slug", slug).
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to get product: %w", err)
	}

	if len(products) == 0 {
		return nil, fmt.Errorf("product not found")
	}

	return &products[0], nil
}

func (s *ContentService) DeleteProduct(id string) error {
	err := s.supabase.GetClient().DB.From("products").
		Delete().
		Filter("id", "eq", id).
		Execute(nil)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	return nil
}

func (s *ContentService) UpdateProduct(id string, req models.UpdateProductRequest) (*models.Product, error) {
	// Marshal JSON fields
	featuresJSON, err := json.Marshal(req.Features)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal features: %w", err)
	}

	imagesJSON, err := json.Marshal(req.Images)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal images: %w", err)
	}

	// Update product
	var products []models.Product
	err = s.supabase.GetClient().DB.From("products").
		Update(map[string]interface{}{
			"title":           req.Title,
			"description":     req.Description,
			"price":           req.Price,
			"category":        req.Category,
			"features":        featuresJSON,
			"slug":            req.Slug,
			"active":          req.Active,
			"dodo_product_id": req.DodoProductID,
			"discount":        req.Discount,
			"images":          imagesJSON,
			"updated_at":      "now()",
		}).
		Filter("id", "eq", id).
		Execute(&products)

	if err != nil {
		return nil, fmt.Errorf("failed to update product: %w", err)
	}

	if len(products) == 0 {
		return nil, fmt.Errorf("product not found")
	}

	return &products[0], nil
}
