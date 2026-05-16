package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/lib/pq"
)

type BoardService struct {
	db       *sql.DB
	supabase *SupabaseClient
	socket   *SocketIOService
}

func NewBoardService(db *sql.DB, supabaseURL, supabaseKey string, socket *SocketIOService) *BoardService {
	return &BoardService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
		socket:   socket,
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *BoardService) isGroupMember(groupID, userID string) bool {
	var count int
	s.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`,
		groupID, userID,
	).Scan(&count)
	if count > 0 {
		return true
	}
	// Any channel member can access groups within that channel
	s.db.QueryRow(`
		SELECT COUNT(*) FROM channel_members cm
		JOIN groups g ON g.channel_id = cm.channel_id
		WHERE g.id = $1 AND cm.user_id = $2
	`, groupID, userID).Scan(&count)
	return count > 0
}

func (s *BoardService) isGroupAdmin(groupID, userID string) bool {
	var role string
	err := s.db.QueryRow(
		`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
		groupID, userID,
	).Scan(&role)
	if err == nil && (role == "OWNER" || role == "ADMIN") {
		return true
	}
	// Fall back to channel admin check
	var count int
	s.db.QueryRow(`
		SELECT COUNT(*) FROM channel_members cm
		JOIN groups g ON g.channel_id = cm.channel_id
		WHERE g.id = $1 AND cm.user_id = $2 AND cm.role IN ('OWNER', 'ADMIN')
	`, groupID, userID).Scan(&count)
	return count > 0
}

func (s *BoardService) emitToGroup(groupID, event string, data interface{}) {
	s.socket.BroadcastToRoom("group_"+groupID, event, data)
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

func (s *BoardService) GetTags(groupID, userID string) ([]*models.BoardTag, error) {
	if !s.isGroupMember(groupID, userID) {
		return nil, fmt.Errorf("not a group member")
	}

	rows, err := s.db.Query(
		`SELECT id, group_id, name, color, created_at FROM board_tags WHERE group_id = $1 ORDER BY created_at ASC`,
		groupID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tags: %w", err)
	}
	defer rows.Close()

	var tags []*models.BoardTag
	for rows.Next() {
		t := &models.BoardTag{}
		if err := rows.Scan(&t.ID, &t.GroupID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []*models.BoardTag{}
	}
	return tags, nil
}

func (s *BoardService) CreateTag(groupID, userID string, req models.CreateBoardTagRequest) (*models.BoardTag, error) {
	if !s.isGroupAdmin(groupID, userID) {
		return nil, fmt.Errorf("only admins can create tags")
	}
	if req.Name == "" {
		return nil, fmt.Errorf("tag name is required")
	}
	color := req.Color
	if color == "" {
		color = "#6366f1"
	}

	t := &models.BoardTag{}
	err := s.db.QueryRow(
		`INSERT INTO board_tags (group_id, name, color) VALUES ($1, $2, $3)
		 RETURNING id, group_id, name, color, created_at`,
		groupID, req.Name, color,
	).Scan(&t.ID, &t.GroupID, &t.Name, &t.Color, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create tag: %w", err)
	}
	return t, nil
}

func (s *BoardService) DeleteTag(groupID, tagID, userID string) error {
	if !s.isGroupAdmin(groupID, userID) {
		return fmt.Errorf("only admins can delete tags")
	}
	_, err := s.db.Exec(
		`DELETE FROM board_tags WHERE id = $1 AND group_id = $2`,
		tagID, groupID,
	)
	if err != nil {
		return fmt.Errorf("failed to delete tag: %w", err)
	}
	return nil
}

// ─── Posts ────────────────────────────────────────────────────────────────────

func (s *BoardService) scanPost(rows *sql.Rows) (*models.BoardPost, error) {
	p := &models.BoardPost{}
	var mediaURLs pq.StringArray
	var authorAvatarURL sql.NullString
	var authorIsVerified sql.NullBool
	var authorSubPlan sql.NullString
	var content sql.NullString

	err := rows.Scan(
		&p.ID, &p.GroupID, &p.AuthorID, &p.Title, &content,
		&mediaURLs, &p.IsPinned, &p.IsLocked, &p.LastActivityAt, &p.CreatedAt,
		&p.LikeCount, &p.CommentCount, &p.IsLiked,
		&p.Author.ID, &p.Author.Username, &authorAvatarURL, &authorIsVerified, &authorSubPlan,
	)
	if err != nil {
		return nil, err
	}
	p.MediaURLs = []string(mediaURLs)
	if p.MediaURLs == nil {
		p.MediaURLs = []string{}
	}
	if content.Valid {
		p.Content = &content.String
	}
	if authorAvatarURL.Valid {
		p.Author.AvatarURL = &authorAvatarURL.String
	}
	if authorIsVerified.Valid {
		p.Author.IsVerified = &authorIsVerified.Bool
	}
	if authorSubPlan.Valid {
		p.Author.SubPlan = &authorSubPlan.String
	}
	p.Tags = []models.BoardTag{}
	return p, nil
}

const postSelectSQL = `
	SELECT
		bp.id, bp.group_id, bp.author_id, bp.title, bp.content,
		bp.media_urls, bp.is_pinned, bp.is_locked, bp.last_activity_at, bp.created_at,
		(SELECT COUNT(*) FROM board_post_likes bpl WHERE bpl.post_id = bp.id)::int AS like_count,
		(SELECT COUNT(*) FROM board_post_comments bpc WHERE bpc.post_id = bp.id)::int AS comment_count,
		EXISTS(SELECT 1 FROM board_post_likes bpl WHERE bpl.post_id = bp.id AND bpl.user_id = $%d) AS is_liked,
		u.id, u.username, u.avatar_url, u.is_verified, u.sub_plan
	FROM board_posts bp
	JOIN users u ON u.id = bp.author_id
`

func (s *BoardService) loadTagsForPosts(posts []*models.BoardPost) error {
	if len(posts) == 0 {
		return nil
	}
	ids := make([]string, len(posts))
	for i, p := range posts {
		ids[i] = p.ID
	}

	rows, err := s.db.Query(`
		SELECT bpt.post_id, bt.id, bt.group_id, bt.name, bt.color, bt.created_at
		FROM board_post_tags bpt
		JOIN board_tags bt ON bt.id = bpt.tag_id
		WHERE bpt.post_id = ANY($1)
	`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	tagsByPost := make(map[string][]models.BoardTag)
	for rows.Next() {
		var postID string
		t := models.BoardTag{}
		if err := rows.Scan(&postID, &t.ID, &t.GroupID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return err
		}
		tagsByPost[postID] = append(tagsByPost[postID], t)
	}
	for _, p := range posts {
		if tags, ok := tagsByPost[p.ID]; ok {
			p.Tags = tags
		}
	}
	return nil
}

func (s *BoardService) GetPosts(groupID, userID string) ([]*models.BoardPost, error) {
	if !s.isGroupMember(groupID, userID) {
		return nil, fmt.Errorf("not a group member")
	}

	query := fmt.Sprintf(postSelectSQL, 1) + `
		WHERE bp.group_id = $2
		ORDER BY bp.is_pinned DESC, bp.last_activity_at DESC
	`

	rows, err := s.db.Query(query, userID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch posts: %w", err)
	}
	defer rows.Close()

	var posts []*models.BoardPost
	for rows.Next() {
		p, err := s.scanPost(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}
		posts = append(posts, p)
	}
	if posts == nil {
		posts = []*models.BoardPost{}
	}
	if err := s.loadTagsForPosts(posts); err != nil {
		return nil, err
	}
	return posts, nil
}

func (s *BoardService) GetPost(postID, userID string) (*models.BoardPost, error) {
	query := fmt.Sprintf(postSelectSQL, 1) + ` WHERE bp.id = $2`

	rows, err := s.db.Query(query, userID, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch post: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("post not found")
	}
	p, err := s.scanPost(rows)
	if err != nil {
		return nil, fmt.Errorf("failed to scan post: %w", err)
	}
	if !s.isGroupMember(p.GroupID, userID) {
		return nil, fmt.Errorf("not a group member")
	}
	if err := s.loadTagsForPosts([]*models.BoardPost{p}); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *BoardService) CreatePost(groupID, userID string, req models.CreateBoardPostRequest) (*models.BoardPost, error) {
	if !s.isGroupMember(groupID, userID) {
		return nil, fmt.Errorf("not a group member")
	}
	if req.Title == "" {
		return nil, fmt.Errorf("title is required")
	}

	mediaURLs := req.MediaURLs
	if mediaURLs == nil {
		mediaURLs = []string{}
	}

	var postID string
	err := s.db.QueryRow(
		`INSERT INTO board_posts (group_id, author_id, title, content, media_urls)
		 VALUES ($1, $2, $3, NULLIF($4, ''), $5)
		 RETURNING id`,
		groupID, userID, req.Title, req.Content, pq.Array(mediaURLs),
	).Scan(&postID)
	if err != nil {
		return nil, fmt.Errorf("failed to create post: %w", err)
	}

	// Attach tags
	if len(req.TagIDs) > 0 {
		for _, tagID := range req.TagIDs {
			s.db.Exec(
				`INSERT INTO board_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				postID, tagID,
			)
		}
	}

	post, err := s.GetPost(postID, userID)
	if err != nil {
		return nil, err
	}

	s.emitToGroup(groupID, "board:new_post", map[string]interface{}{
		"groupId": groupID,
		"post":    post,
	})
	return post, nil
}

func (s *BoardService) UpdatePost(postID, userID string, req models.UpdateBoardPostRequest) (*models.BoardPost, error) {
	var authorID, groupID string
	err := s.db.QueryRow(
		`SELECT author_id, group_id FROM board_posts WHERE id = $1`, postID,
	).Scan(&authorID, &groupID)
	if err != nil {
		return nil, fmt.Errorf("post not found")
	}

	if authorID != userID && !s.isGroupAdmin(groupID, userID) {
		return nil, fmt.Errorf("not allowed to edit this post")
	}

	_, err = s.db.Exec(`
		UPDATE board_posts SET
			title = COALESCE(NULLIF($1, ''), title),
			content = CASE WHEN $2 = '' THEN content ELSE $2 END,
			is_pinned = COALESCE($3, is_pinned),
			is_locked = COALESCE($4, is_locked)
		WHERE id = $5
	`, req.Title, req.Content, req.IsPinned, req.IsLocked, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to update post: %w", err)
	}

	post, err := s.GetPost(postID, userID)
	if err != nil {
		return nil, err
	}
	s.emitToGroup(groupID, "board:post_updated", map[string]interface{}{"groupId": groupID, "post": post})
	return post, nil
}

func (s *BoardService) DeletePost(postID, userID string) error {
	var authorID, groupID string
	err := s.db.QueryRow(
		`SELECT author_id, group_id FROM board_posts WHERE id = $1`, postID,
	).Scan(&authorID, &groupID)
	if err != nil {
		return fmt.Errorf("post not found")
	}

	if authorID != userID && !s.isGroupAdmin(groupID, userID) {
		return fmt.Errorf("not allowed to delete this post")
	}

	_, err = s.db.Exec(`DELETE FROM board_posts WHERE id = $1`, postID)
	if err != nil {
		return fmt.Errorf("failed to delete post: %w", err)
	}
	s.emitToGroup(groupID, "board:post_deleted", map[string]interface{}{"groupId": groupID, "postId": postID})
	return nil
}

// ─── Comments ────────────────────────────────────────────────────────────────

func (s *BoardService) GetComments(postID, userID string) ([]*models.BoardComment, error) {
	var groupID string
	err := s.db.QueryRow(`SELECT group_id FROM board_posts WHERE id = $1`, postID).Scan(&groupID)
	if err != nil {
		return nil, fmt.Errorf("post not found")
	}
	if !s.isGroupMember(groupID, userID) {
		return nil, fmt.Errorf("not a group member")
	}

	rows, err := s.db.Query(`
		SELECT
			bc.id, bc.post_id, bc.author_id, bc.content,
			bc.media_urls, bc.parent_comment_id, bc.created_at,
			u.id, u.username, u.avatar_url, u.is_verified, u.sub_plan
		FROM board_post_comments bc
		JOIN users u ON u.id = bc.author_id
		WHERE bc.post_id = $1
		ORDER BY bc.created_at ASC
	`, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch comments: %w", err)
	}
	defer rows.Close()

	all := []*models.BoardComment{}
	byID := map[string]*models.BoardComment{}

	for rows.Next() {
		c := &models.BoardComment{}
		var mediaURLs pq.StringArray
		var parentID sql.NullString
		var avatarURL sql.NullString
		var isVerified sql.NullBool
		var subPlan sql.NullString

		err := rows.Scan(
			&c.ID, &c.PostID, &c.AuthorID, &c.Content,
			&mediaURLs, &parentID, &c.CreatedAt,
			&c.Author.ID, &c.Author.Username, &avatarURL, &isVerified, &subPlan,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan comment: %w", err)
		}
		c.MediaURLs = []string(mediaURLs)
		if c.MediaURLs == nil {
			c.MediaURLs = []string{}
		}
		if parentID.Valid {
			c.ParentCommentID = &parentID.String
		}
		if avatarURL.Valid {
			c.Author.AvatarURL = &avatarURL.String
		}
		if isVerified.Valid {
			c.Author.IsVerified = &isVerified.Bool
		}
		if subPlan.Valid {
			c.Author.SubPlan = &subPlan.String
		}
		c.Replies = []models.BoardComment{}
		all = append(all, c)
		byID[c.ID] = c
	}

	// Build tree
	roots := []*models.BoardComment{}
	for _, c := range all {
		if c.ParentCommentID == nil {
			roots = append(roots, c)
		} else {
			parent, ok := byID[*c.ParentCommentID]
			if ok {
				parent.Replies = append(parent.Replies, *c)
			} else {
				roots = append(roots, c)
			}
		}
	}
	return roots, nil
}

func (s *BoardService) AddComment(postID, userID string, req models.CreateBoardCommentRequest) (*models.BoardComment, error) {
	var groupID string
	var isLocked bool
	var authorID string
	err := s.db.QueryRow(
		`SELECT group_id, is_locked, author_id FROM board_posts WHERE id = $1`, postID,
	).Scan(&groupID, &isLocked, &authorID)
	if err != nil {
		return nil, fmt.Errorf("post not found")
	}
	if isLocked {
		return nil, fmt.Errorf("post is locked")
	}
	if !s.isGroupMember(groupID, userID) {
		return nil, fmt.Errorf("not a group member")
	}
	if req.Content == "" {
		return nil, fmt.Errorf("content is required")
	}

	commentMediaURLs := req.MediaURLs
	if commentMediaURLs == nil {
		commentMediaURLs = []string{}
	}

	var parentID interface{} = nil
	if req.ParentCommentID != nil && *req.ParentCommentID != "" {
		parentID = *req.ParentCommentID
	}

	c := &models.BoardComment{}
	var commentMediaScan pq.StringArray
	var avatarURL sql.NullString
	var isVerified sql.NullBool
	var subPlan sql.NullString
	var pID sql.NullString

	err = s.db.QueryRow(`
		WITH inserted AS (
			INSERT INTO board_post_comments (post_id, author_id, content, media_urls, parent_comment_id)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, post_id, author_id, content, media_urls, parent_comment_id, created_at
		)
		SELECT i.id, i.post_id, i.author_id, i.content, i.media_urls, i.parent_comment_id, i.created_at,
		       u.id, u.username, u.avatar_url, u.is_verified, u.sub_plan
		FROM inserted i
		JOIN users u ON u.id = i.author_id
	`, postID, userID, req.Content, pq.Array(commentMediaURLs), parentID,
	).Scan(
		&c.ID, &c.PostID, &c.AuthorID, &c.Content, &commentMediaScan, &pID, &c.CreatedAt,
		&c.Author.ID, &c.Author.Username, &avatarURL, &isVerified, &subPlan,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to add comment: %w", err)
	}

	c.MediaURLs = []string(commentMediaScan)
	if c.MediaURLs == nil {
		c.MediaURLs = []string{}
	}
	if pID.Valid {
		c.ParentCommentID = &pID.String
	}
	if avatarURL.Valid {
		c.Author.AvatarURL = &avatarURL.String
	}
	if isVerified.Valid {
		c.Author.IsVerified = &isVerified.Bool
	}
	if subPlan.Valid {
		c.Author.SubPlan = &subPlan.String
	}
	c.Replies = []models.BoardComment{}

	// Update last_activity_at on the post
	s.db.Exec(`UPDATE board_posts SET last_activity_at = NOW() WHERE id = $1`, postID)

	s.emitToGroup(groupID, "board:new_comment", map[string]interface{}{
		"groupId": groupID,
		"postId":  postID,
		"comment": c,
	})
	return c, nil
}

func (s *BoardService) UpdateComment(commentID, userID, content string) (*models.BoardComment, error) {
	if content == "" {
		return nil, fmt.Errorf("content is required")
	}

	var authorID string
	err := s.db.QueryRow(`SELECT author_id FROM board_post_comments WHERE id = $1`, commentID).Scan(&authorID)
	if err != nil {
		return nil, fmt.Errorf("comment not found")
	}
	if authorID != userID {
		return nil, fmt.Errorf("not your comment")
	}

	c := &models.BoardComment{}
	var updateMediaScan pq.StringArray
	var avatarURL sql.NullString
	var isVerified sql.NullBool
	var subPlan sql.NullString
	var pID sql.NullString

	err = s.db.QueryRow(`
		WITH updated AS (
			UPDATE board_post_comments SET content = $1 WHERE id = $2
			RETURNING id, post_id, author_id, content, media_urls, parent_comment_id, created_at
		)
		SELECT u2.id, u2.post_id, u2.author_id, u2.content, u2.media_urls, u2.parent_comment_id, u2.created_at,
		       u.id, u.username, u.avatar_url, u.is_verified, u.sub_plan
		FROM updated u2
		JOIN users u ON u.id = u2.author_id
	`, content, commentID,
	).Scan(
		&c.ID, &c.PostID, &c.AuthorID, &c.Content, &updateMediaScan, &pID, &c.CreatedAt,
		&c.Author.ID, &c.Author.Username, &avatarURL, &isVerified, &subPlan,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update comment: %w", err)
	}

	c.MediaURLs = []string(updateMediaScan)
	if c.MediaURLs == nil {
		c.MediaURLs = []string{}
	}
	if pID.Valid {
		c.ParentCommentID = &pID.String
	}
	if avatarURL.Valid {
		c.Author.AvatarURL = &avatarURL.String
	}
	if isVerified.Valid {
		c.Author.IsVerified = &isVerified.Bool
	}
	if subPlan.Valid {
		c.Author.SubPlan = &subPlan.String
	}
	c.Replies = []models.BoardComment{}
	return c, nil
}

func (s *BoardService) DeleteComment(commentID, userID string) error {
	var authorID, postID string
	err := s.db.QueryRow(
		`SELECT author_id, post_id FROM board_post_comments WHERE id = $1`, commentID,
	).Scan(&authorID, &postID)
	if err != nil {
		return fmt.Errorf("comment not found")
	}

	var groupID string
	s.db.QueryRow(`SELECT group_id FROM board_posts WHERE id = $1`, postID).Scan(&groupID)

	if authorID != userID && !s.isGroupAdmin(groupID, userID) {
		return fmt.Errorf("not allowed to delete this comment")
	}

	_, err = s.db.Exec(`DELETE FROM board_post_comments WHERE id = $1`, commentID)
	if err != nil {
		return fmt.Errorf("failed to delete comment: %w", err)
	}
	return nil
}

// ─── Likes ────────────────────────────────────────────────────────────────────

func (s *BoardService) LikePost(postID, userID string) (int, error) {
	var groupID string
	err := s.db.QueryRow(`SELECT group_id FROM board_posts WHERE id = $1`, postID).Scan(&groupID)
	if err != nil {
		return 0, fmt.Errorf("post not found")
	}

	_, err = s.db.Exec(
		`INSERT INTO board_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		postID, userID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to like post: %w", err)
	}

	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM board_post_likes WHERE post_id = $1`, postID).Scan(&count)

	s.emitToGroup(groupID, "board:like_update", map[string]interface{}{
		"groupId":   groupID,
		"postId":    postID,
		"likeCount": count,
		"likedBy":   userID,
	})
	return count, nil
}

func (s *BoardService) UnlikePost(postID, userID string) (int, error) {
	var groupID string
	err := s.db.QueryRow(`SELECT group_id FROM board_posts WHERE id = $1`, postID).Scan(&groupID)
	if err != nil {
		return 0, fmt.Errorf("post not found")
	}

	_, err = s.db.Exec(
		`DELETE FROM board_post_likes WHERE post_id = $1 AND user_id = $2`,
		postID, userID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to unlike post: %w", err)
	}

	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM board_post_likes WHERE post_id = $1`, postID).Scan(&count)

	s.emitToGroup(groupID, "board:like_update", map[string]interface{}{
		"groupId":   groupID,
		"postId":    postID,
		"likeCount": count,
		"likedBy":   nil,
	})
	return count, nil
}
