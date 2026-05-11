package models

type CreatePostRequest struct {
	Caption   string   `json:"caption"`
	MediaURLs []string `json:"media_urls"`
}

type CreateStoryRequest struct {
	MediaURL        string `json:"media_url" validate:"required"`
	Type            string `json:"type" validate:"required"`
	Caption         string `json:"caption"`
	MusicPreviewURL string `json:"music_preview_url"`
	MusicTitle      string `json:"music_title"`
	MusicArtist     string `json:"music_artist"`
	MusicCoverURL   string `json:"music_cover_url"`
}

type CreateProductRequest struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Price         float64  `json:"price"`
	Category      string   `json:"category"`
	Features      []string `json:"features"`
	Slug          string   `json:"slug"`
	Active        bool     `json:"active"`
	DodoProductID string   `json:"dodo_product_id"`
	Discount      float64  `json:"discount"`
	Images        []string `json:"images"`
}

type UpdateProductRequest struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Price         float64  `json:"price"`
	Category      string   `json:"category"`
	Features      []string `json:"features"`
	Slug          string   `json:"slug"`
	Active        bool     `json:"active"`
	Sales         int      `json:"sales"`
	DodoProductID string   `json:"dodo_product_id"`
	Discount      float64  `json:"discount"`
	Images        []string `json:"images"`
}
