package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/Hamza-agha-tec/goback/models"
)

type DodoPaymentService struct {
	db            *sql.DB
	apiKey        string
	webhookSecret string
	environment   string
	planIDPro     string
	planIDGeek    string
}

type DodoCheckoutRequest struct {
	Amount        float64           `json:"amount"`             // in cents
	Currency      string            `json:"currency"`           // e.g., "USD"
	SuccessURL    string            `json:"success_url"`        // redirect URL after successful payment
	CancelURL     string            `json:"cancel_url"`         // redirect URL after cancelled payment
	WebhookURL    string            `json:"webhook_url"`        // webhook URL for payment notifications
	CustomerEmail string            `json:"customer_email"`     // optional customer email
	Metadata      map[string]string `json:"metadata,omitempty"` // additional metadata
}

type DodoCheckoutResponse struct {
	ID          string `json:"id"`           // checkout session ID
	CheckoutURL string `json:"checkout_url"` // URL to redirect customer to
	Amount      int64  `json:"amount"`       // amount in cents
	Currency    string `json:"currency"`     // currency
	Status      string `json:"status"`       // "pending", "completed", "failed"
	CreatedAt   string `json:"created_at"`   // ISO timestamp
}

type DodoSubscriptionRequest struct {
	PlanID        string `json:"plan_id"`        // DODO_PLAN_ID_PRO or DODO_PLAN_ID_GEEK
	CustomerEmail string `json:"customer_email"` // customer email
	SuccessURL    string `json:"success_url"`    // success redirect URL
	CancelURL     string `json:"cancel_url"`     // cancel redirect URL
	WebhookURL    string `json:"webhook_url"`    // webhook URL
}

type DodoWebhookEvent struct {
	Type      string                 `json:"type"`      // "payment.completed", "payment.failed", "subscription.created", etc.
	Data      map[string]interface{} `json:"data"`      // event data
	Timestamp string                 `json:"timestamp"` // ISO timestamp
	Signature string                 `json:"signature"` // HMAC signature for verification
}

func NewDodoPaymentService(db *sql.DB) *DodoPaymentService {
	return &DodoPaymentService{
		db:            db,
		apiKey:        os.Getenv("DODO_PAYMENTS_API_KEY"),
		webhookSecret: os.Getenv("DODO_PAYMENTS_WEBHOOK_SECRET"),
		environment:   os.Getenv("DODO_PAYMENTS_ENVIRONMENT"),
		planIDPro:     os.Getenv("DODO_PLAN_ID_PRO"),
		planIDGeek:    os.Getenv("DODO_PLAN_ID_GEEK"),
	}
}

func (s *DodoPaymentService) CreateCheckoutSession(userID, productID, redirectURL string) (map[string]interface{}, error) {
	// Get product details from database
	product, err := s.getProduct(productID)
	if err != nil {
		return nil, fmt.Errorf("failed to get product: %w", err)
	}

	// Get user email
	userEmail, err := s.getUserEmail(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user email: %w", err)
	}

	// Create checkout request
	checkoutReq := DodoCheckoutRequest{
		Amount:        product.Price,
		Currency:      product.Currency,
		SuccessURL:    redirectURL,
		CancelURL:     redirectURL + "?cancelled=true",
		WebhookURL:    s.getWebhookURL(),
		CustomerEmail: userEmail,
		Metadata: map[string]string{
			"user_id":    userID,
			"product_id": productID,
		},
	}

	// Make API call to DodoPayments
	response, err := s.makeDodoAPICall("POST", "/checkout", checkoutReq)
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout session: %w", err)
	}

	var checkoutResp DodoCheckoutResponse
	if err := json.Unmarshal(response, &checkoutResp); err != nil {
		return nil, fmt.Errorf("failed to parse checkout response: %w", err)
	}

	// Save order to database
	orderID, err := s.createOrder(userID, checkoutResp.ID, product)
	if err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	return map[string]interface{}{
		"checkout_url": checkoutResp.CheckoutURL,
		"session_id":   checkoutResp.ID,
		"order_id":     orderID,
	}, nil
}

func (s *DodoPaymentService) GetSubscription(userID string) (*models.UserSubscription, error) {
	query := `
		SELECT id, user_id, dodo_subscription_id, dodo_customer_id, status, 
		       current_period_end, plan_type, created_at, updated_at
		FROM user_subscriptions 
		WHERE user_id = $1 AND status = 'active'
		ORDER BY created_at DESC
		LIMIT 1
	`

	subscription := &models.UserSubscription{}
	err := s.db.QueryRow(query, userID).Scan(
		&subscription.ID, &subscription.UserID, &subscription.DodoSubscriptionID,
		&subscription.DodoCustomerID, &subscription.Status, &subscription.CurrentPeriodEnd,
		&subscription.PlanType, &subscription.CreatedAt, &subscription.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("no active subscription found")
		}
		return nil, fmt.Errorf("failed to query subscription: %w", err)
	}

	return subscription, nil
}

func (s *DodoPaymentService) CreateSubscription(userID, planType string) (map[string]interface{}, error) {
	// Determine plan ID based on type
	var planID string
	switch planType {
	case "pro":
		planID = s.planIDPro
	case "geek":
		planID = s.planIDGeek
	default:
		return nil, fmt.Errorf("invalid plan type: %s", planType)
	}

	// Get user email
	userEmail, err := s.getUserEmail(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user email: %w", err)
	}

	// Create subscription request
	subReq := DodoSubscriptionRequest{
		PlanID:        planID,
		CustomerEmail: userEmail,
		SuccessURL:    os.Getenv("FRONTEND_URL") + "/subscription/success",
		CancelURL:     os.Getenv("FRONTEND_URL") + "/subscription/cancelled",
		WebhookURL:    s.getWebhookURL(),
	}

	// Make API call to DodoPayments
	response, err := s.makeDodoAPICall("POST", "/subscriptions", subReq)
	if err != nil {
		return nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	var subResp map[string]interface{}
	if err := json.Unmarshal(response, &subResp); err != nil {
		return nil, fmt.Errorf("failed to parse subscription response: %w", err)
	}

	return subResp, nil
}

func (s *DodoPaymentService) GetCustomerPortalUrl(userID string) (string, error) {
	// DodoPayments might not have a customer portal like Stripe
	// Return subscription management URL or contact support URL
	return os.Getenv("FRONTEND_URL") + "/account/subscription", nil
}

func (s *DodoPaymentService) HandleWebhook(rawPayload string, headers map[string][]string) error {
	// Verify webhook signature
	signature := headers["Dodo-Signature"][0]
	if !s.verifyWebhookSignature(rawPayload, signature) {
		return fmt.Errorf("invalid webhook signature")
	}

	// Parse webhook event
	var event DodoWebhookEvent
	if err := json.Unmarshal([]byte(rawPayload), &event); err != nil {
		return fmt.Errorf("failed to parse webhook event: %w", err)
	}

	// Handle different event types
	switch event.Type {
	case "payment.completed":
		return s.handlePaymentCompleted(event.Data)
	case "payment.failed":
		return s.handlePaymentFailed(event.Data)
	case "subscription.created":
		return s.handleSubscriptionCreated(event.Data)
	case "subscription.cancelled":
		return s.handleSubscriptionCancelled(event.Data)
	default:
		fmt.Printf("Unhandled webhook event type: %s\n", event.Type)
	}

	return nil
}

// Helper methods

func (s *DodoPaymentService) makeDodoAPICall(method, endpoint string, body interface{}) ([]byte, error) {
	baseURL := "https://api.dodopayments.com"
	if s.environment == "sandbox" {
		baseURL = "https://api-sandbox.dodopayments.com"
	}

	url := baseURL + endpoint

	var reqBody []byte
	var err error
	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
	}

	req, err := http.NewRequest(method, url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make API call: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(responseBody))
	}

	return responseBody, nil
}

func (s *DodoPaymentService) verifyWebhookSignature(payload, signature string) bool {
	h := hmac.New(sha256.New, []byte(s.webhookSecret))
	h.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(h.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

func (s *DodoPaymentService) getWebhookURL() string {
	return os.Getenv("FRONTEND_URL") + "/api/payments/webhook"
}

func (s *DodoPaymentService) getProduct(productID string) (*models.Product, error) {
	query := `SELECT id, title, description, price, category, dodo_product_id, active FROM products WHERE id = $1`

	product := &models.Product{}
	err := s.db.QueryRow(query, productID).Scan(
		&product.ID, &product.Title, &product.Description, &product.Price,
		&product.Category, &product.DodoProductID, &product.Active,
	)

	if err != nil {
		return nil, err
	}

	return product, nil
}

func (s *DodoPaymentService) getUserEmail(userID string) (string, error) {
	query := `SELECT email FROM users WHERE id = $1`

	var email string
	err := s.db.QueryRow(query, userID).Scan(&email)

	if err != nil {
		return "", err
	}

	return email, nil
}

func (s *DodoPaymentService) createOrder(userID, dodoID string, product *models.Product) (string, error) {
	query := `
		INSERT INTO orders (id, user_id, customer_email, amount_total, status, product_id, created_at, updated_at, dodo_order_id, currency)
		VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, $6)
		RETURNING id
	`

	var orderID string
	err := s.db.QueryRow(query, userID, "", product.Price, product.ID, dodoID, "").Scan(&orderID)

	if err != nil {
		return "", err
	}

	return orderID, nil
}

func (s *DodoPaymentService) handlePaymentCompleted(data map[string]interface{}) error {
	// Update order status to completed
	orderID := data["order_id"].(string)
	query := `UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE dodo_order_id = $1`

	_, err := s.db.Exec(query, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}
	return nil
}

func (s *DodoPaymentService) handlePaymentFailed(data map[string]interface{}) error {
	// Update order status to failed
	orderID := data["order_id"].(string)
	query := `UPDATE orders SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE dodo_order_id = $1`

	_, err := s.db.Exec(query, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}
	return nil
}

func (s *DodoPaymentService) handleSubscriptionCreated(data map[string]interface{}) error {
	// Save subscription to database
	subID := data["id"].(string)
	planType := data["plan_type"].(string)
	userID := data["metadata"].(map[string]interface{})["user_id"].(string)

	query := `
		INSERT INTO user_subscriptions (id, user_id, dodo_subscription_id, dodo_customer_id, status, plan_type, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, '', 'active', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`

	_, err := s.db.Exec(query, userID, subID, planType)
	return err
}

func (s *DodoPaymentService) handleSubscriptionCancelled(data map[string]interface{}) error {
	// Update subscription status
	subID := data["id"].(string)
	query := `UPDATE user_subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE dodo_subscription_id = $1`

	_, err := s.db.Exec(query, subID)
	return err
}
