package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type PaymentService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewPaymentService(db *sql.DB, supabaseURL, supabaseKey string) *PaymentService {
	return &PaymentService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *PaymentService) CreateCheckoutSession(userID, productID, redirectURL string) (map[string]interface{}, error) {
	// Use DodoPayments service
	dodoService := NewDodoPaymentService(s.db)
	return dodoService.CreateCheckoutSession(userID, productID, redirectURL)
}

func (s *PaymentService) GetSubscription(userID string) (*models.UserSubscription, error) {
	var subscriptions []models.UserSubscription
	err := s.supabase.GetClient().DB.From("user_subscriptions").
		Select("*").
		Eq("user_id", userID).
		Eq("status", "active").
		Execute(&subscriptions)

	if err != nil {
		return nil, fmt.Errorf("failed to query subscription: %w", err)
	}

	if len(subscriptions) == 0 {
		return nil, fmt.Errorf("no active subscription found")
	}

	return &subscriptions[0], nil
}

func (s *PaymentService) GetCustomerPortalUrl(userID string) (string, error) {
	// Use DodoPayments service
	dodoService := NewDodoPaymentService(s.db)
	return dodoService.GetCustomerPortalUrl(userID)
}

func (s *PaymentService) HandleWebhook(rawPayload string, headers map[string][]string) error {
	// Use DodoPayments service
	dodoService := NewDodoPaymentService(s.db)
	return dodoService.HandleWebhook(rawPayload, headers)
}

type ProductPaymentsService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewProductPaymentsService(db *sql.DB, supabaseURL, supabaseKey string) *ProductPaymentsService {
	return &ProductPaymentsService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *ProductPaymentsService) CreateProductCheckout(userID string, dto models.ProductCheckoutDto) (map[string]interface{}, error) {
	// Use DodoPayments service
	dodoService := NewDodoPaymentService(s.db)
	return dodoService.CreateCheckoutSession(userID, dto.ProductID, "")
}

func (s *ProductPaymentsService) GetOrders(userID string) ([]*models.Order, error) {
	var orders []models.Order
	err := s.supabase.GetClient().DB.From("orders").
		Select("*").
		Eq("user_id", userID).
		Execute(&orders)

	if err != nil {
		return nil, fmt.Errorf("failed to query orders: %w", err)
	}

	// Convert to pointer slice
	var orderPtrs []*models.Order
	for i := range orders {
		orderPtrs = append(orderPtrs, &orders[i])
	}

	return orderPtrs, nil
}

func (s *ProductPaymentsService) GetOrderByID(userID, orderID string) (*models.Order, error) {
	var orders []models.Order
	err := s.supabase.GetClient().DB.From("orders").
		Select("*").
		Eq("id", orderID).
		Eq("user_id", userID).
		Execute(&orders)

	if err != nil {
		return nil, fmt.Errorf("failed to query order: %w", err)
	}

	if len(orders) == 0 {
		return nil, fmt.Errorf("order not found")
	}

	return &orders[0], nil
}
