package content

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type ContentHandler struct {
	contentService *services.ContentService
}

func NewContentHandler(contentService *services.ContentService) *ContentHandler {
	return &ContentHandler{
		contentService: contentService,
	}
}

// --- POSTS ---

func (h *ContentHandler) CreatePost(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.CreatePostRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	post, err := h.contentService.CreatePost(userID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, post)
}

func (h *ContentHandler) GetUserPosts(c echo.Context) error {
	userID := c.Param("userId")
	if userID == "" {
		userID = c.Get("userID").(string) // fallback to self
	}

	posts, err := h.contentService.GetUserPosts(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if posts == nil {
		posts = []*models.PostWithUser{}
	}

	return c.JSON(http.StatusOK, posts)
}

func (h *ContentHandler) AddComment(c echo.Context) error {
	userID := c.Get("userID").(string)
	postID := c.Param("id")

	var req models.CreateCommentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	comment, err := h.contentService.AddComment(userID, postID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, comment)
}

func (h *ContentHandler) LikePost(c echo.Context) error {
	userID := c.Get("userID").(string)
	postID := c.Param("id")

	like, err := h.contentService.LikePost(userID, postID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, like)
}

func (h *ContentHandler) UnlikePost(c echo.Context) error {
	userID := c.Get("userID").(string)
	postID := c.Param("id")

	err := h.contentService.UnlikePost(userID, postID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}

// --- STORIES ---

func (h *ContentHandler) CreateStory(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.CreateStoryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.MediaURL == "" || req.Type == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "media_url and type are required"})
	}

	story, err := h.contentService.CreateStory(userID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, story)
}

func (h *ContentHandler) GetFeed(c echo.Context) error {
	userID := c.Get("userID").(string)

	// Add debug logging
	fmt.Printf("GetFeed called for userID: %s\n", userID)

	stories, err := h.contentService.GetFeed(userID)
	if err != nil {
		fmt.Printf("GetFeed service error: %v\n", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if stories == nil {
		fmt.Printf("GetFeed returned nil, initializing empty array\n")
		stories = []*models.FeedGroup{}
	}

	fmt.Printf("GetFeed returning %d feed groups\n", len(stories))
	return c.JSON(http.StatusOK, stories)
}

func (h *ContentHandler) GetStoryById(c echo.Context) error {
	userID := c.Get("userID").(string)
	storyID := c.Param("id")

	story, err := h.contentService.GetStoryById(userID, storyID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, story)
}

func (h *ContentHandler) RecordView(c echo.Context) error {
	userID := c.Get("userID").(string)
	storyID := c.Param("id")

	result, err := h.contentService.RecordView(userID, storyID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *ContentHandler) GetStoryViewers(c echo.Context) error {
	userID := c.Get("userID").(string)
	storyID := c.Param("id")

	viewers, err := h.contentService.GetStoryViewers(userID, storyID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if viewers == nil {
		viewers = []map[string]interface{}{}
	}

	return c.JSON(http.StatusOK, viewers)
}

func (h *ContentHandler) ReactToStory(c echo.Context) error {
	userID := c.Get("userID").(string)
	storyID := c.Param("id")

	var req models.ReactStoryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	result, err := h.contentService.ReactToStory(userID, storyID, req.Reaction)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return a valid result instead of null
	if result == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to react to story"})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *ContentHandler) RemoveReaction(c echo.Context) error {
	userID := c.Get("userID").(string)
	storyID := c.Param("id")

	err := h.contentService.RemoveReaction(userID, storyID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *ContentHandler) DeleteStory(c echo.Context) error {
	userID := c.Get("userID").(string)
	storyID := c.Param("id")

	err := h.contentService.DeleteStory(userID, storyID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}

// --- STORE (PRODUCTS) ---

func (h *ContentHandler) CreateProduct(c echo.Context) error {
	var req models.CreateProductRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	product, err := h.contentService.CreateProduct(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, product)
}

func (h *ContentHandler) GetActiveProducts(c echo.Context) error {
	products, err := h.contentService.GetActiveProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}

func (h *ContentHandler) GetFeaturedProducts(c echo.Context) error {
	products, err := h.contentService.GetFeaturedProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}

func (h *ContentHandler) GetProductsByCategory(c echo.Context) error {
	category := c.Param("category")

	products, err := h.contentService.GetProductsByCategory(category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}

func (h *ContentHandler) SearchProducts(c echo.Context) error {
	query := c.QueryParam("q")
	if query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query parameter is required"})
	}

	products, err := h.contentService.SearchProducts(query)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}

func (h *ContentHandler) GetProductsByPriceRange(c echo.Context) error {
	minPrice := c.QueryParam("min")
	maxPrice := c.QueryParam("max")

	if minPrice == "" || maxPrice == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "min and max parameters are required"})
	}

	minPriceFloat, err1 := strconv.ParseFloat(minPrice, 64)
	maxPriceFloat, err2 := strconv.ParseFloat(maxPrice, 64)

	if err1 != nil || err2 != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid price values"})
	}

	products, err := h.contentService.GetProductsByPriceRange(minPriceFloat, maxPriceFloat)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}

func (h *ContentHandler) GetOnSaleProducts(c echo.Context) error {
	products, err := h.contentService.GetOnSaleProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}

func (h *ContentHandler) GetProductById(c echo.Context) error {
	id := c.Param("id")

	product, err := h.contentService.GetProductById(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, product)
}

func (h *ContentHandler) GetProductBySlug(c echo.Context) error {
	slug := c.Param("slug")

	product, err := h.contentService.GetProductBySlug(slug)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, product)
}

func (h *ContentHandler) UpdateProduct(c echo.Context) error {
	id := c.Param("id")

	var req models.UpdateProductRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	product, err := h.contentService.UpdateProduct(id, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, product)
}

func (h *ContentHandler) DeleteProduct(c echo.Context) error {
	id := c.Param("id")

	err := h.contentService.DeleteProduct(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *ContentHandler) GetProducts(c echo.Context) error {
	products, err := h.contentService.GetProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Ensure we always return an empty array instead of null
	if products == nil {
		products = []*models.Product{}
	}

	return c.JSON(http.StatusOK, products)
}
