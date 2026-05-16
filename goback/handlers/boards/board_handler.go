package boards

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type BoardHandler struct {
	boardService *services.BoardService
}

func NewBoardHandler(boardService *services.BoardService) *BoardHandler {
	return &BoardHandler{boardService: boardService}
}

func userID(c echo.Context) string {
	return c.Get("user").(*middleware.AuthenticatedUser).UserID
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

func (h *BoardHandler) GetTags(c echo.Context) error {
	groupID := c.Param("groupId")
	tags, err := h.boardService.GetTags(groupID, userID(c))
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, tags)
}

func (h *BoardHandler) CreateTag(c echo.Context) error {
	groupID := c.Param("groupId")
	var req models.CreateBoardTagRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	tag, err := h.boardService.CreateTag(groupID, userID(c), req)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, tag)
}

func (h *BoardHandler) DeleteTag(c echo.Context) error {
	groupID := c.Param("groupId")
	tagID := c.Param("tagId")
	if err := h.boardService.DeleteTag(groupID, tagID, userID(c)); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

// ─── Posts ────────────────────────────────────────────────────────────────────

func (h *BoardHandler) GetPosts(c echo.Context) error {
	groupID := c.Param("groupId")
	posts, err := h.boardService.GetPosts(groupID, userID(c))
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, posts)
}

func (h *BoardHandler) CreatePost(c echo.Context) error {
	groupID := c.Param("groupId")
	var req models.CreateBoardPostRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	post, err := h.boardService.CreatePost(groupID, userID(c), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, post)
}

func (h *BoardHandler) GetPost(c echo.Context) error {
	postID := c.Param("postId")
	post, err := h.boardService.GetPost(postID, userID(c))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, post)
}

func (h *BoardHandler) UpdatePost(c echo.Context) error {
	postID := c.Param("postId")
	var req models.UpdateBoardPostRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	post, err := h.boardService.UpdatePost(postID, userID(c), req)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, post)
}

func (h *BoardHandler) DeletePost(c echo.Context) error {
	postID := c.Param("postId")
	if err := h.boardService.DeletePost(postID, userID(c)); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

// ─── Comments ────────────────────────────────────────────────────────────────

func (h *BoardHandler) GetComments(c echo.Context) error {
	postID := c.Param("postId")
	comments, err := h.boardService.GetComments(postID, userID(c))
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	if comments == nil {
		comments = []*models.BoardComment{}
	}
	return c.JSON(http.StatusOK, comments)
}

func (h *BoardHandler) AddComment(c echo.Context) error {
	postID := c.Param("postId")
	var req models.CreateBoardCommentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	comment, err := h.boardService.AddComment(postID, userID(c), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, comment)
}

func (h *BoardHandler) UpdateComment(c echo.Context) error {
	commentID := c.Param("commentId")
	var req models.UpdateBoardCommentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	comment, err := h.boardService.UpdateComment(commentID, userID(c), req.Content)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, comment)
}

func (h *BoardHandler) DeleteComment(c echo.Context) error {
	commentID := c.Param("commentId")
	if err := h.boardService.DeleteComment(commentID, userID(c)); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

// ─── Likes ────────────────────────────────────────────────────────────────────

func (h *BoardHandler) LikePost(c echo.Context) error {
	postID := c.Param("postId")
	count, err := h.boardService.LikePost(postID, userID(c))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]int{"like_count": count})
}

func (h *BoardHandler) UnlikePost(c echo.Context) error {
	postID := c.Param("postId")
	count, err := h.boardService.UnlikePost(postID, userID(c))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]int{"like_count": count})
}
